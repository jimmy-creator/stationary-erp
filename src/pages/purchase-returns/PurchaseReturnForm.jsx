import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ProductSearchSelect } from '../../components/ProductSearchSelect'
import { Plus, Trash2, AlertCircle } from 'lucide-react'

export function PurchaseReturnForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const prefilledPoId = searchParams.get('po_id') || ''
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEditing = Boolean(id)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [receivedPos, setReceivedPos] = useState([])

  // Parent-PO context: items + already-returned quantities, used to cap per-line qty.
  const [parentPoItems, setParentPoItems] = useState([])
  const [previouslyReturned, setPreviouslyReturned] = useState({})

  const [formData, setFormData] = useState({
    return_date: new Date().toISOString().split('T')[0],
    po_id: '',
    supplier_id: '',
    supplier_name: '',
    refund_method: 'debit_note',
    refund_status: 'refunded',
    amount_refunded: '',
    reason: '',
    notes: '',
    status: 'completed',
  })

  const [items, setItems] = useState([
    { product_id: '', product_name: '', po_item_id: null, unit: 'Pcs', quantity: 1, unit_price: 0, total_price: 0 },
  ])
  const [autoFocusIndex, setAutoFocusIndex] = useState(null)

  useEffect(() => {
    fetchData().then(() => {
      if (!isEditing && !prefilledPoId) setAutoFocusIndex(0)
    })
    if (isEditing) fetchReturn()
    else if (prefilledPoId) loadFromPo(prefilledPoId)
  }, [id])

  const fetchData = async () => {
    const [suppliersRes, productsRes, posRes] = await Promise.all([
      supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
      supabase.from('products').select('id, name, selling_price, cost_price, stock_quantity, unit').eq('is_active', true).order('name'),
      supabase.from('purchase_orders').select('id, po_number, supplier_name, po_date, grand_total').eq('status', 'received').order('po_date', { ascending: false }).limit(200),
    ])
    setSuppliers(suppliersRes.data || [])
    setProducts(productsRes.data || [])
    setReceivedPos(posRes.data || [])
  }

  const fetchReturn = async () => {
    setLoading(true)
    try {
      const [retRes, itemsRes] = await Promise.all([
        supabase.from('purchase_returns').select('*').eq('id', id).single(),
        supabase.from('purchase_return_items').select('*').eq('return_id', id),
      ])
      if (retRes.error) throw retRes.error
      const ret = retRes.data

      setFormData({
        return_date: ret.return_date,
        po_id: ret.po_id || '',
        supplier_id: ret.supplier_id || '',
        supplier_name: ret.supplier_name || '',
        refund_method: ret.refund_method || 'debit_note',
        refund_status: ret.refund_status || 'refunded',
        amount_refunded: ret.amount_refunded?.toString() || '',
        reason: ret.reason || '',
        notes: ret.notes || '',
        status: ret.status || 'completed',
      })

      if (itemsRes.data?.length) {
        setItems(itemsRes.data.map((it) => ({
          id: it.id,
          product_id: it.product_id || '',
          product_name: it.product_name,
          po_item_id: it.po_item_id || null,
          unit: it.unit || 'Pcs',
          quantity: parseFloat(it.quantity) || 0,
          unit_price: parseFloat(it.unit_price) || 0,
          total_price: parseFloat(it.total_price) || 0,
          applied_quantity: parseFloat(it.applied_quantity) || 0,
          applied_landed_cost: parseFloat(it.applied_landed_cost) || 0,
        })))
      }

      if (ret.po_id) await loadParentPoContext(ret.po_id, id)
    } catch (error) {
      console.error('Error fetching return:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadFromPo = async (poId) => {
    setLoading(true)
    try {
      const [poRes, poItemsRes] = await Promise.all([
        supabase.from('purchase_orders').select('*').eq('id', poId).single(),
        supabase.from('purchase_order_items').select('*').eq('po_id', poId),
      ])
      if (poRes.error) throw poRes.error
      const po = poRes.data

      setFormData((prev) => ({
        ...prev,
        po_id: poId,
        supplier_id: po.supplier_id || '',
        supplier_name: po.supplier_name || '',
      }))

      await loadParentPoContext(poId, null)

      const lineItems = (poItemsRes.data || []).map((it) => ({
        product_id: it.product_id || '',
        product_name: it.product_name,
        po_item_id: it.id,
        unit: it.unit || 'Pcs',
        quantity: parseFloat(it.quantity) || 0,
        unit_price: parseFloat(it.unit_price) || 0,
        total_price: parseFloat(it.total_price) || 0,
      }))
      if (lineItems.length) setItems(lineItems)
    } catch (err) {
      console.error('Error loading PO:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadParentPoContext = async (poId, excludeReturnId) => {
    const [poItemsRes, otherReturnsRes] = await Promise.all([
      supabase.from('purchase_order_items').select('id, product_id, product_name, quantity, applied_quantity, applied_landed_cost').eq('po_id', poId),
      supabase.from('purchase_returns').select('id, purchase_return_items(po_item_id, quantity)').eq('po_id', poId).eq('status', 'completed'),
    ])

    setParentPoItems(poItemsRes.data || [])

    const map = {}
    ;(otherReturnsRes.data || []).forEach((r) => {
      if (excludeReturnId && r.id === excludeReturnId) return
      ;(r.purchase_return_items || []).forEach((ri) => {
        if (!ri.po_item_id) return
        map[ri.po_item_id] = (map[ri.po_item_id] || 0) + (parseFloat(ri.quantity) || 0)
      })
    })
    setPreviouslyReturned(map)
  }

  const handlePoChange = (poId) => {
    if (!poId) {
      setFormData((prev) => ({ ...prev, po_id: '' }))
      setParentPoItems([])
      setPreviouslyReturned({})
      return
    }
    loadFromPo(poId)
  }

  const handleProductChange = (index, productId) => {
    const product = products.find((p) => p.id === productId)
    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      product_id: productId,
      product_name: product?.name || '',
      po_item_id: null,
      unit: product?.unit || 'Pcs',
      unit_price: product?.cost_price || newItems[index].unit_price || 0,
      total_price: (product?.cost_price || newItems[index].unit_price || 0) * (newItems[index].quantity || 0),
    }
    setItems(newItems)
  }

  const handleQuantityChange = (index, quantity) => {
    const newItems = [...items]
    newItems[index].quantity = parseFloat(quantity) || 0
    newItems[index].total_price = newItems[index].unit_price * newItems[index].quantity
    setItems(newItems)
  }

  const handleUnitPriceChange = (index, price) => {
    const newItems = [...items]
    newItems[index].unit_price = parseFloat(price) || 0
    newItems[index].total_price = newItems[index].unit_price * newItems[index].quantity
    setItems(newItems)
  }

  const addItem = useCallback(() => {
    setItems((prev) => {
      const next = [...prev, { product_id: '', product_name: '', po_item_id: null, unit: 'Pcs', quantity: 1, unit_price: 0, total_price: 0 }]
      setAutoFocusIndex(next.length - 1)
      return next
    })
  }, [])

  const removeItem = (index) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  const lineWarnings = useMemo(() => {
    return items.map((item) => {
      if (!item.po_item_id) return null
      const parent = parentPoItems.find((p) => p.id === item.po_item_id)
      if (!parent) return null
      const alreadyReturned = previouslyReturned[item.po_item_id] || 0
      // Cap = what was actually received from this line (applied_quantity), not the ordered qty
      const receivedQty = parseFloat(parent.applied_quantity) || 0
      const max = receivedQty - alreadyReturned
      if ((parseFloat(item.quantity) || 0) > max + 1e-6) {
        return `Max returnable: ${max} (received ${receivedQty}, previously returned ${alreadyReturned})`
      }
      return null
    })
  }, [items, parentPoItems, previouslyReturned])

  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.total_price) || 0), 0)
  const taxAmount = subtotal * (parseFloat(formData.tax_percentage) || 0) / 100
  const grandTotal = subtotal + taxAmount

  // ─── Stock + cost reversal (mirror of PurchaseOrderForm.applyDelta) ───
  // Removing units from stock at a known per-unit landed cost reverses the
  // weighted-average. newStock = oldStock - qty, newValue = max(0, oldStock*oldCost - qty*landedCost),
  // newCost = newValue / newStock (or 0 when newStock collapses).
  const applyStockDelta = async (productId, qtyDelta, valueDelta, productCache) => {
    if (!productId) return
    if (Math.abs(qtyDelta) < 1e-9 && Math.abs(valueDelta) < 1e-4) return

    let state = productCache.get(productId)
    if (!state) {
      const { data } = await supabase.from('products').select('stock_quantity, cost_price').eq('id', productId).single()
      state = { stock: parseFloat(data?.stock_quantity) || 0, cost: parseFloat(data?.cost_price) || 0 }
      productCache.set(productId, state)
    }

    const newStock = Math.max(0, state.stock + qtyDelta)
    const newValue = Math.max(0, state.stock * state.cost + valueDelta)
    const newCost = newStock > 0 ? Math.round((newValue / newStock) * 100) / 100 : state.cost

    await supabase.from('products')
      .update({ stock_quantity: newStock, cost_price: newCost })
      .eq('id', productId)
    state.stock = newStock
    state.cost = newCost
  }

  // Wipe + (optionally) re-insert the debit-note entry on po_payments, then
  // recompute purchase_orders.amount_paid + payment_status.
  const reconcileDebitNote = async ({ poId, returnId, returnDate, reason, isLive, refundMethod, refundStatus, refundAmount }) => {
    const { data: returnRow } = await supabase
      .from('purchase_returns').select('return_number').eq('id', returnId).single()
    const returnNumber = returnRow?.return_number
    if (!returnNumber) return

    const { data: poBefore } = await supabase
      .from('purchase_orders').select('grand_total, amount_paid').eq('id', poId).single()
    const { data: paymentsBefore } = await supabase
      .from('po_payments').select('amount').eq('po_id', poId)
    const paymentsBeforeSum = (paymentsBefore || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0)
    const initial = Math.max(0, parseFloat(poBefore?.amount_paid || 0) - paymentsBeforeSum)

    await supabase.from('po_payments').delete()
      .eq('po_id', poId).eq('payment_method', 'debit_note').eq('reference', returnNumber)

    if (isLive && refundMethod === 'debit_note' && refundStatus === 'refunded' && refundAmount > 0) {
      await supabase.from('po_payments').insert({
        po_id: poId,
        payment_date: returnDate,
        amount: refundAmount,
        payment_method: 'debit_note',
        reference: returnNumber,
        notes: reason || `Purchase return ${returnNumber}`,
      })
    }

    const { data: paymentsAfter } = await supabase
      .from('po_payments').select('amount').eq('po_id', poId)
    const paymentsAfterSum = (paymentsAfter || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0)
    const newAmountPaid = initial + paymentsAfterSum
    const grand = parseFloat(poBefore?.grand_total || 0)
    const newStatus = newAmountPaid >= grand - 0.01 ? 'paid' : newAmountPaid > 0 ? 'partial' : 'unpaid'
    await supabase.from('purchase_orders')
      .update({ amount_paid: newAmountPaid, payment_status: newStatus })
      .eq('id', poId)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const validItems = items.filter((item) => item.product_name && parseFloat(item.quantity) > 0)
    if (validItems.length === 0) {
      alert('Please add at least one item')
      return
    }
    if (lineWarnings.some(Boolean)) {
      alert('Some lines exceed the returnable quantity. Please adjust.')
      return
    }
    if (formData.refund_method === 'debit_note' && !formData.po_id) {
      alert('Debit Note refunds require a linked Purchase Order.')
      return
    }
    if (!formData.supplier_name) {
      alert('Please select a supplier or link a Purchase Order.')
      return
    }

    const refundAmount = formData.refund_status === 'refunded'
      ? (parseFloat(formData.amount_refunded) || grandTotal)
      : (parseFloat(formData.amount_refunded) || 0)

    setSaving(true)
    try {
      // Snapshot previously-applied per-line state for delta computation.
      let priorItems = []
      if (isEditing) {
        const { data } = await supabase
          .from('purchase_return_items')
          .select('product_id, applied_quantity, applied_landed_cost')
          .eq('return_id', id)
        priorItems = data || []
      }

      // Resolve per-line landed-cost snapshot. Bound lines inherit it from the
      // PO line; unbound lines fall back to the current product cost_price.
      const poItemsById = new Map(parentPoItems.map((p) => [p.id, p]))
      const productCostMap = new Map(products.map((p) => [p.id, parseFloat(p.cost_price) || 0]))
      const resolveLandedCost = (item) => {
        if (item.po_item_id) {
          const p = poItemsById.get(item.po_item_id)
          if (p && parseFloat(p.applied_landed_cost) > 0) return parseFloat(p.applied_landed_cost)
        }
        if (item.product_id && productCostMap.has(item.product_id)) {
          return productCostMap.get(item.product_id)
        }
        // Fallback: use unit price if no other signal
        return parseFloat(item.unit_price) || 0
      }

      const returnData = {
        return_date: formData.return_date,
        po_id: formData.po_id || null,
        supplier_id: formData.supplier_id || null,
        supplier_name: formData.supplier_name,
        subtotal,
        tax_percentage: 0,
        tax_amount: 0,
        grand_total: grandTotal,
        refund_method: formData.refund_method,
        refund_status: formData.refund_status,
        amount_refunded: refundAmount,
        reason: formData.reason || null,
        notes: formData.notes || null,
        status: formData.status,
        created_by_email: isEditing ? undefined : (user?.email || null),
      }

      let returnId = id
      if (isEditing) {
        const { error } = await supabase.from('purchase_returns').update(returnData).eq('id', id)
        if (error) throw error
        await supabase.from('purchase_return_items').delete().eq('return_id', id)
      } else {
        const { data, error } = await supabase.from('purchase_returns').insert(returnData).select().single()
        if (error) throw error
        returnId = data.id
      }

      const isLive = returnData.status === 'completed'
      const newLines = validItems.map((item) => {
        const qty = parseFloat(item.quantity) || 0
        const willApply = isLive && item.product_id && qty > 0
        const landedCost = willApply ? resolveLandedCost(item) : 0
        return {
          return_id: returnId,
          po_item_id: item.po_item_id || null,
          product_id: item.product_id || null,
          product_name: item.product_name,
          unit: item.unit || 'Pcs',
          quantity: qty,
          unit_price: parseFloat(item.unit_price) || 0,
          total_price: parseFloat(item.total_price) || 0,
          applied_quantity: willApply ? qty : 0,
          applied_landed_cost: landedCost,
        }
      })

      const { error: itemsError } = await supabase.from('purchase_return_items').insert(newLines)
      if (itemsError) throw itemsError

      // Stock + cost reversal: aggregate per-product (qtyDelta, valueDelta).
      // Going *new* = removing units (negative delta).
      // Going *prior* = un-removing previously removed units (positive delta).
      const productCache = new Map()
      const aggregate = {}
      const bump = (productId, qtyDelta, valueDelta) => {
        if (!productId) return
        if (!aggregate[productId]) aggregate[productId] = { qty: 0, value: 0 }
        aggregate[productId].qty += qtyDelta
        aggregate[productId].value += valueDelta
      }
      // Reverse prior applied state
      priorItems.forEach((p) => {
        const aq = parseFloat(p.applied_quantity) || 0
        const alc = parseFloat(p.applied_landed_cost) || 0
        if (p.product_id && aq > 0) bump(p.product_id, +aq, +(aq * alc))
      })
      // Apply new state
      newLines.forEach((n) => {
        const aq = parseFloat(n.applied_quantity) || 0
        const alc = parseFloat(n.applied_landed_cost) || 0
        if (n.product_id && aq > 0) bump(n.product_id, -aq, -(aq * alc))
      })
      for (const [productId, { qty, value }] of Object.entries(aggregate)) {
        await applyStockDelta(productId, qty, value, productCache)
      }

      // Reconcile debit note against the parent PO.
      if (returnData.po_id) {
        await reconcileDebitNote({
          poId: returnData.po_id,
          returnId,
          returnDate: returnData.return_date,
          reason: returnData.reason,
          isLive,
          refundMethod: returnData.refund_method,
          refundStatus: returnData.refund_status,
          refundAmount,
        })
      }

      navigate(`/purchase-returns/${returnId}`)
    } catch (error) {
      console.error('Error saving return:', error)
      alert('Failed to save return: ' + (error.message || 'unknown error'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link to="/purchase-returns" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to list</Link>
        <h1 className="text-xl lg:text-2xl font-bold text-white">{isEditing ? 'Edit Purchase Return' : 'New Purchase Return'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
          <h2 className="text-lg font-medium text-white mb-4">Return Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Date *</label>
              <input type="date" required value={formData.return_date} onChange={(e) => setFormData({ ...formData, return_date: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Original PO</label>
              <select value={formData.po_id} onChange={(e) => handlePoChange(e.target.value)} disabled={isEditing} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50 disabled:opacity-60">
                <option value="">— None (manual return) —</option>
                {receivedPos.map((p) => (
                  <option key={p.id} value={p.id}>{p.po_number} — {p.supplier_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Supplier *</label>
              <select required value={formData.supplier_id} onChange={(e) => {
                const s = suppliers.find((x) => x.id === e.target.value)
                setFormData({ ...formData, supplier_id: e.target.value, supplier_name: s?.name || '' })
              }} disabled={Boolean(formData.po_id)} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50 disabled:opacity-60">
                <option value="">— Select supplier —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {formData.po_id && formData.supplier_name && (
                <p className="text-xs text-zinc-500 mt-1">{formData.supplier_name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Reason</label>
              <input type="text" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="Damaged, wrong item, expired, etc." className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Status</label>
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50">
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-white">Items</h2>
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-teal-400 hover:text-teal-300">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const warning = lineWarnings[index]
              return (
                <div key={index} className="grid grid-cols-12 gap-2 items-end bg-zinc-800/30 rounded-lg p-3">
                  <div className="col-span-12 md:col-span-5">
                    <label className="block text-xs text-zinc-400 mb-1">Product</label>
                    {item.po_item_id ? (
                      <p className="text-sm text-zinc-200 py-2 px-3 bg-zinc-700/50 border border-zinc-600 rounded-lg truncate" title={item.product_name}>{item.product_name}</p>
                    ) : (
                      <ProductSearchSelect
                        products={products}
                        value={item.product_id}
                        onChange={(productId) => handleProductChange(index, productId)}
                        autoFocus={autoFocusIndex === index}
                        showStock
                        showCost
                        className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    )}
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <label className="block text-xs text-zinc-400 mb-1">Qty</label>
                    <input type="number" min="0" step="any" value={item.quantity} onChange={(e) => handleQuantityChange(index, e.target.value)} className={`w-full bg-zinc-700/50 border rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 ${warning ? 'border-red-500/50 focus:ring-red-500' : 'border-zinc-600 focus:ring-teal-500'}`} />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <label className="block text-xs text-zinc-400 mb-1">Price</label>
                    <input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => handleUnitPriceChange(index, e.target.value)} className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <label className="block text-xs text-zinc-400 mb-1">Total</label>
                    <p className="text-sm font-medium text-white py-2 px-3">QAR {parseFloat(item.total_price || 0).toFixed(2)}</p>
                  </div>
                  <div className="col-span-1">
                    <button type="button" onClick={() => removeItem(index)} disabled={items.length <= 1} className="p-2 text-red-400 hover:text-red-300 disabled:opacity-30">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {warning && (
                    <div className="col-span-12 flex items-center gap-1.5 text-xs text-red-400">
                      <AlertCircle className="w-3.5 h-3.5" /> {warning}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-zinc-400">Subtotal:</span><span className="text-zinc-200">QAR {subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-lg font-bold border-t border-zinc-700 pt-2">
                <span className="text-zinc-200">Total:</span>
                <span className="text-teal-400">QAR {grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
          <h2 className="text-lg font-medium text-white mb-4">Refund</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Method</label>
              <select value={formData.refund_method} onChange={(e) => setFormData({ ...formData, refund_method: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50">
                <option value="debit_note" disabled={!formData.po_id}>Debit Note (apply to PO balance)</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
              {formData.refund_method === 'debit_note' && !formData.po_id && (
                <p className="text-xs text-amber-400 mt-1">Debit notes require a linked PO.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Status</label>
              <select value={formData.refund_status} onChange={(e) => {
                const status = e.target.value
                setFormData((prev) => {
                  if (status === 'pending') return { ...prev, refund_status: status, amount_refunded: '0' }
                  if (prev.refund_status === 'pending' && prev.amount_refunded === '0') return { ...prev, refund_status: status, amount_refunded: '' }
                  return { ...prev, refund_status: status }
                })
              }} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50">
                <option value="refunded">Refunded</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Amount Refunded</label>
              <input type="number" min="0" step="0.01" value={formData.amount_refunded} onChange={(e) => setFormData({ ...formData, amount_refunded: e.target.value })} placeholder={grandTotal.toFixed(2)} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-300 mb-1">Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <Link to="/purchase-returns" className="w-full sm:w-auto text-center px-6 py-2 border border-zinc-700 rounded-xl text-zinc-300 hover:bg-zinc-800">Cancel</Link>
          <button type="submit" disabled={saving} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl hover:from-teal-500 hover:to-teal-400 disabled:opacity-50">
            {saving ? 'Saving...' : isEditing ? 'Update Return' : 'Create Return'}
          </button>
        </div>
      </form>
    </div>
  )
}
