import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ProductSearchSelect } from '../../components/ProductSearchSelect'
import { Plus, Trash2, AlertCircle } from 'lucide-react'

export function SalesReturnForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const prefilledSaleId = searchParams.get('sale_id') || ''
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEditing = Boolean(id)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [openSales, setOpenSales] = useState([])

  // The parent sale's items + how many of each have been previously returned
  // (excluding this return when editing). Used to cap return quantities.
  const [parentSaleItems, setParentSaleItems] = useState([])
  const [previouslyReturned, setPreviouslyReturned] = useState({})

  const [formData, setFormData] = useState({
    return_date: new Date().toISOString().split('T')[0],
    sale_id: '',
    customer_id: '',
    customer_name: '',
    refund_method: 'cash',
    refund_status: 'refunded',
    amount_refunded: '',
    reason: '',
    notes: '',
    status: 'completed',
  })

  const [items, setItems] = useState([
    { product_id: '', product_name: '', sale_item_id: null, quantity: 1, unit_price: 0, total_price: 0, restock: true },
  ])
  const [autoFocusIndex, setAutoFocusIndex] = useState(null)

  useEffect(() => {
    fetchData().then(() => {
      if (!isEditing && !prefilledSaleId) setAutoFocusIndex(0)
    })
    if (isEditing) fetchReturn()
    else if (prefilledSaleId) loadFromSale(prefilledSaleId)
  }, [id])

  const fetchData = async () => {
    const [customersRes, productsRes, salesRes] = await Promise.all([
      supabase.from('customers').select('id, name').eq('is_active', true).order('name'),
      supabase.from('products').select('id, name, selling_price, cost_price, stock_quantity, unit').eq('is_active', true).order('name'),
      supabase.from('sales').select('id, invoice_number, customer_name, sale_date, grand_total').eq('status', 'completed').order('sale_date', { ascending: false }).limit(200),
    ])
    setCustomers(customersRes.data || [])
    setProducts(productsRes.data || [])
    setOpenSales(salesRes.data || [])
  }

  const fetchReturn = async () => {
    setLoading(true)
    try {
      const [retRes, itemsRes] = await Promise.all([
        supabase.from('sales_returns').select('*').eq('id', id).single(),
        supabase.from('sales_return_items').select('*').eq('return_id', id),
      ])
      if (retRes.error) throw retRes.error
      const ret = retRes.data

      setFormData({
        return_date: ret.return_date,
        sale_id: ret.sale_id || '',
        customer_id: ret.customer_id || '',
        customer_name: ret.customer_name || '',
        refund_method: ret.refund_method || 'cash',
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
          sale_item_id: it.sale_item_id || null,
          quantity: parseFloat(it.quantity) || 0,
          unit_price: parseFloat(it.unit_price) || 0,
          total_price: parseFloat(it.total_price) || 0,
          restock: Boolean(it.restock),
          applied_quantity: parseFloat(it.applied_quantity) || 0,
        })))
      }

      if (ret.sale_id) await loadParentSaleContext(ret.sale_id, id)
    } catch (error) {
      console.error('Error fetching return:', error)
    } finally {
      setLoading(false)
    }
  }

  // Pull parent sale + items, prefill form, and prefill all return lines with
  // remaining returnable quantities.
  const loadFromSale = async (saleId) => {
    setLoading(true)
    try {
      const [saleRes, saleItemsRes] = await Promise.all([
        supabase.from('sales').select('*').eq('id', saleId).single(),
        supabase.from('sale_items').select('*').eq('sale_id', saleId),
      ])
      if (saleRes.error) throw saleRes.error
      const sale = saleRes.data

      setFormData((prev) => ({
        ...prev,
        sale_id: saleId,
        customer_id: sale.customer_id || '',
        customer_name: sale.customer_name || '',
      }))

      await loadParentSaleContext(saleId, null)

      const lineItems = (saleItemsRes.data || []).map((it) => ({
        product_id: it.product_id || '',
        product_name: it.product_name,
        sale_item_id: it.id,
        quantity: parseFloat(it.quantity) || 0,
        unit_price: parseFloat(it.unit_price) || 0,
        total_price: parseFloat(it.total_price) || 0,
        restock: true,
      }))
      if (lineItems.length) setItems(lineItems)
    } catch (err) {
      console.error('Error loading sale:', err)
    } finally {
      setLoading(false)
    }
  }

  // Build lookup of how many units per sale_item have already been returned
  // (excluding the return we're editing, if any), so the form can cap quantities.
  const loadParentSaleContext = async (saleId, excludeReturnId) => {
    const [saleItemsRes, otherReturnsRes] = await Promise.all([
      supabase.from('sale_items').select('id, product_id, product_name, quantity').eq('sale_id', saleId),
      supabase.from('sales_returns').select('id, sales_return_items(sale_item_id, quantity, restock)').eq('sale_id', saleId).eq('status', 'completed'),
    ])

    setParentSaleItems(saleItemsRes.data || [])

    const map = {}
    ;(otherReturnsRes.data || []).forEach((r) => {
      if (excludeReturnId && r.id === excludeReturnId) return
      ;(r.sales_return_items || []).forEach((ri) => {
        if (!ri.sale_item_id) return
        map[ri.sale_item_id] = (map[ri.sale_item_id] || 0) + (parseFloat(ri.quantity) || 0)
      })
    })
    setPreviouslyReturned(map)
  }

  const handleSaleChange = (saleId) => {
    if (!saleId) {
      setFormData((prev) => ({ ...prev, sale_id: '' }))
      setParentSaleItems([])
      setPreviouslyReturned({})
      return
    }
    loadFromSale(saleId)
  }

  const handleProductChange = (index, productId) => {
    const product = products.find((p) => p.id === productId)
    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      product_id: productId,
      product_name: product?.name || '',
      sale_item_id: null, // ad-hoc line, not bound to a sale_item
      unit_price: product?.selling_price || newItems[index].unit_price || 0,
      total_price: (product?.selling_price || newItems[index].unit_price || 0) * (newItems[index].quantity || 0),
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

  const handleRestockToggle = (index, restock) => {
    const newItems = [...items]
    newItems[index].restock = restock
    setItems(newItems)
  }

  const addItem = useCallback(() => {
    setItems((prev) => {
      const next = [...prev, { product_id: '', product_name: '', sale_item_id: null, quantity: 1, unit_price: 0, total_price: 0, restock: true }]
      setAutoFocusIndex(next.length - 1)
      return next
    })
  }, [])

  const removeItem = (index) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  // Validation: per-line cap when bound to a sale_item.
  const lineWarnings = useMemo(() => {
    return items.map((item) => {
      if (!item.sale_item_id) return null
      const parent = parentSaleItems.find((p) => p.id === item.sale_item_id)
      if (!parent) return null
      const alreadyReturned = previouslyReturned[item.sale_item_id] || 0
      const max = (parseFloat(parent.quantity) || 0) - alreadyReturned
      if ((parseFloat(item.quantity) || 0) > max + 1e-6) {
        return `Max returnable: ${max} (sold ${parent.quantity}, previously returned ${alreadyReturned})`
      }
      return null
    })
  }, [items, parentSaleItems, previouslyReturned])

  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.total_price) || 0), 0)
  const grandTotal = subtotal

  // Wipe any prior credit-note payment for this return, optionally insert a
  // fresh one, then recompute sales.amount_paid + payment_status. The sale's
  // initial payment portion (paid at the time of the sale itself) is preserved
  // by snapshotting amount_paid and the full payments sum *before* mutation.
  const reconcileCreditNote = async ({ saleId, returnId, returnDate, reason, isLive, refundMethod, refundStatus, refundAmount }) => {
    const { data: returnRow } = await supabase
      .from('sales_returns').select('return_number').eq('id', returnId).single()
    const returnNumber = returnRow?.return_number
    if (!returnNumber) return

    const { data: saleBefore } = await supabase
      .from('sales').select('grand_total, amount_paid').eq('id', saleId).single()
    const { data: paymentsBefore } = await supabase
      .from('sale_payments').select('amount').eq('sale_id', saleId)
    const paymentsBeforeSum = (paymentsBefore || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0)
    const initial = Math.max(0, parseFloat(saleBefore?.amount_paid || 0) - paymentsBeforeSum)

    await supabase.from('sale_payments').delete()
      .eq('sale_id', saleId).eq('payment_method', 'credit_note').eq('reference', returnNumber)

    if (isLive && refundMethod === 'credit_note' && refundStatus === 'refunded' && refundAmount > 0) {
      await supabase.from('sale_payments').insert({
        sale_id: saleId,
        payment_date: returnDate,
        amount: refundAmount,
        payment_method: 'credit_note',
        reference: returnNumber,
        notes: reason || `Sales return ${returnNumber}`,
      })
    }

    const { data: paymentsAfter } = await supabase
      .from('sale_payments').select('amount').eq('sale_id', saleId)
    const paymentsAfterSum = (paymentsAfter || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0)
    const newAmountPaid = initial + paymentsAfterSum
    const newBalance = parseFloat(saleBefore?.grand_total || 0) - newAmountPaid
    const newStatus = newBalance <= 0.01 ? 'paid' : newAmountPaid > 0 ? 'partial' : 'unpaid'
    await supabase.from('sales')
      .update({ amount_paid: newAmountPaid, payment_status: newStatus })
      .eq('id', saleId)
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

    if (formData.refund_method === 'credit_note' && !formData.sale_id) {
      alert('Credit Note refunds require a linked sale.')
      return
    }

    const refundAmount = formData.refund_status === 'refunded'
      ? (parseFloat(formData.amount_refunded) || grandTotal)
      : (parseFloat(formData.amount_refunded) || 0)

    setSaving(true)
    try {
      const returnData = {
        return_date: formData.return_date,
        sale_id: formData.sale_id || null,
        customer_id: formData.customer_id || null,
        customer_name: formData.customer_name || null,
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

      // ─── Snapshot previously-applied state so we can compute deltas ───
      // For each currently-loaded item we need: (sale_item_id, applied_quantity, restock).
      let priorItems = []
      if (isEditing) {
        const { data } = await supabase
          .from('sales_return_items')
          .select('id, product_id, applied_quantity, restock')
          .eq('return_id', id)
        priorItems = data || []
      }

      // ─── Insert/update the header row ───
      let returnId = id
      if (isEditing) {
        const { error } = await supabase.from('sales_returns').update(returnData).eq('id', id)
        if (error) throw error
        await supabase.from('sales_return_items').delete().eq('return_id', id)
      } else {
        const { data, error } = await supabase.from('sales_returns').insert(returnData).select().single()
        if (error) throw error
        returnId = data.id
      }

      // ─── Decide what each line's *new* applied_quantity should be ───
      // status='completed' & restock=true => applied = quantity, else 0.
      const isLive = returnData.status === 'completed'
      const newLines = validItems.map((item) => {
        const qty = parseFloat(item.quantity) || 0
        const willApply = isLive && item.restock && item.product_id
        return {
          return_id: returnId,
          sale_item_id: item.sale_item_id || null,
          product_id: item.product_id || null,
          product_name: item.product_name,
          quantity: qty,
          unit_price: parseFloat(item.unit_price) || 0,
          total_price: parseFloat(item.total_price) || 0,
          restock: Boolean(item.restock),
          applied_quantity: willApply ? qty : 0,
        }
      })

      const { error: itemsError } = await supabase.from('sales_return_items').insert(newLines)
      if (itemsError) throw itemsError

      // ─── Reconcile stock by per-product delta ───
      // delta = sum(new applied) - sum(prior applied), per product_id.
      const delta = {}
      priorItems.forEach((p) => {
        if (!p.product_id) return
        delta[p.product_id] = (delta[p.product_id] || 0) - (parseFloat(p.applied_quantity) || 0)
      })
      newLines.forEach((n) => {
        if (!n.product_id) return
        delta[n.product_id] = (delta[n.product_id] || 0) + (parseFloat(n.applied_quantity) || 0)
      })

      const productIds = Object.keys(delta).filter((pid) => Math.abs(delta[pid]) > 1e-6)
      if (productIds.length) {
        const { data: prodRows } = await supabase
          .from('products')
          .select('id, stock_quantity')
          .in('id', productIds)
        for (const p of prodRows || []) {
          const newStock = (parseFloat(p.stock_quantity) || 0) + delta[p.id]
          await supabase.from('products').update({ stock_quantity: Math.max(0, newStock) }).eq('id', p.id)
        }
      }

      // ─── Reconcile credit-note payment row on the parent sale ───
      if (returnData.sale_id) {
        await reconcileCreditNote({
          saleId: returnData.sale_id,
          returnId,
          returnDate: returnData.return_date,
          reason: returnData.reason,
          isLive,
          refundMethod: returnData.refund_method,
          refundStatus: returnData.refund_status,
          refundAmount,
        })
      }

      navigate(`/sales-returns/${returnId}`)
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
        <Link to="/sales-returns" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to list</Link>
        <h1 className="text-xl lg:text-2xl font-bold text-white">{isEditing ? 'Edit Sales Return' : 'New Sales Return'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Return Details */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
          <h2 className="text-lg font-medium text-white mb-4">Return Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Date *</label>
              <input type="date" required value={formData.return_date} onChange={(e) => setFormData({ ...formData, return_date: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Original Sale</label>
              <select value={formData.sale_id} onChange={(e) => handleSaleChange(e.target.value)} disabled={isEditing} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50 disabled:opacity-60">
                <option value="">— None (manual return) —</option>
                {openSales.map((s) => (
                  <option key={s.id} value={s.id}>{s.invoice_number} — {s.customer_name || 'Walk-in'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Customer</label>
              <select value={formData.customer_id} onChange={(e) => {
                const c = customers.find((x) => x.id === e.target.value)
                setFormData({ ...formData, customer_id: e.target.value, customer_name: c?.name || '' })
              }} disabled={Boolean(formData.sale_id)} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50 disabled:opacity-60">
                <option value="">Walk-in Customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Reason</label>
              <input type="text" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="Damaged, wrong item, etc." className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
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

        {/* Items */}
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
                  <div className="col-span-12 md:col-span-4">
                    <label className="block text-xs text-zinc-400 mb-1">Product</label>
                    {item.sale_item_id ? (
                      <p className="text-sm text-zinc-200 py-2 px-3 bg-zinc-700/50 border border-zinc-600 rounded-lg truncate" title={item.product_name}>{item.product_name}</p>
                    ) : (
                      <ProductSearchSelect
                        products={products}
                        value={item.product_id}
                        onChange={(productId) => handleProductChange(index, productId)}
                        autoFocus={autoFocusIndex === index}
                        showStock={false}
                        showCost={false}
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
                  <div className="col-span-8 md:col-span-1 flex items-center">
                    <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer" title="Return units to stock">
                      <input type="checkbox" checked={item.restock} onChange={(e) => handleRestockToggle(index, e.target.checked)} className="rounded border-zinc-600 bg-zinc-700 text-teal-500 focus:ring-teal-500" />
                      Restock
                    </label>
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

        {/* Refund */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
          <h2 className="text-lg font-medium text-white mb-4">Refund</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Method</label>
              <select value={formData.refund_method} onChange={(e) => setFormData({ ...formData, refund_method: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50">
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit_note" disabled={!formData.sale_id}>Credit Note (apply to sale balance)</option>
              </select>
              {formData.refund_method === 'credit_note' && !formData.sale_id && (
                <p className="text-xs text-amber-400 mt-1">Credit notes require a linked sale.</p>
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
          <Link to="/sales-returns" className="w-full sm:w-auto text-center px-6 py-2 border border-zinc-700 rounded-xl text-zinc-300 hover:bg-zinc-800">Cancel</Link>
          <button type="submit" disabled={saving} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl hover:from-teal-500 hover:to-teal-400 disabled:opacity-50">
            {saving ? 'Saving...' : isEditing ? 'Update Return' : 'Create Return'}
          </button>
        </div>
      </form>
    </div>
  )
}
