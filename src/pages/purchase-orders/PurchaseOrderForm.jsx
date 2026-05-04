import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ProductSearchSelect } from '../../components/ProductSearchSelect'
import { SearchInput } from '../../components/SearchInput'
import { Plus, Trash2 } from 'lucide-react'

export function PurchaseOrderForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEditing = Boolean(id)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previousStatus, setPreviousStatus] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])

  const [formData, setFormData] = useState({
    po_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    supplier_id: '',
    supplier_name: '',
    supplier_phone: '',
    supplier_email: '',
    discount_percentage: '0',
    tax_percentage: '0',
    cargo_charges: '0',
    payment_terms: '',
    notes: '',
    status: 'draft',
  })

  const [items, setItems] = useState([{ product_id: '', product_name: '', quantity: 1, unit: 'Pcs', unit_price: 0, total_price: 0 }])
  const [autoFocusIndex, setAutoFocusIndex] = useState(null)
  const [itemSearch, setItemSearch] = useState('')

  const [payment, setPayment] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    reference: '',
    notes: '',
  })
  const [existingPaid, setExistingPaid] = useState(0)

  useEffect(() => {
    fetchData().then(() => {
      if (!isEditing) setAutoFocusIndex(0)
    })
    if (isEditing) fetchOrder()
  }, [id])

  const fetchData = async () => {
    const [suppliersRes, productsRes] = await Promise.all([
      supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
      supabase.from('products').select('id, name, cost_price, unit').eq('is_active', true).order('name'),
    ])
    setSuppliers(suppliersRes.data || [])
    setProducts(productsRes.data || [])
  }

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const [orderRes, itemsRes] = await Promise.all([
        supabase.from('purchase_orders').select('*').eq('id', id).single(),
        supabase.from('purchase_order_items').select('*').eq('po_id', id),
      ])
      if (orderRes.error) throw orderRes.error
      const order = orderRes.data

      setFormData({
        po_date: order.po_date,
        expected_delivery_date: order.expected_delivery_date || '',
        supplier_id: order.supplier_id || '',
        supplier_name: order.supplier_name,
        supplier_phone: order.supplier_phone || '',
        supplier_email: order.supplier_email || '',
        discount_percentage: order.discount_percentage?.toString() || '0',
        tax_percentage: order.tax_percentage?.toString() || '0',
        cargo_charges: order.cargo_charges?.toString() || '0',
        payment_terms: order.payment_terms || '',
        notes: order.notes || '',
        status: order.status,
      })
      setExistingPaid(parseFloat(order.amount_paid || 0))
      setPreviousStatus(order.status)

      if (itemsRes.data?.length) {
        setItems(itemsRes.data.map((item) => ({
          id: item.id, product_id: item.product_id || '', product_name: item.product_name,
          quantity: parseFloat(item.quantity) || 0, unit: item.unit || 'Pcs', unit_price: parseFloat(item.unit_price) || 0, total_price: parseFloat(item.total_price) || 0,
          received_at: item.received_at || null,
          applied_quantity: parseFloat(item.applied_quantity) || 0,
          applied_landed_cost: parseFloat(item.applied_landed_cost) || 0,
        })))
      }
    } catch (error) {
      console.error('Error fetching order:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSupplierChange = (supplierId) => {
    const supplier = suppliers.find((s) => s.id === supplierId)
    setFormData({
      ...formData,
      supplier_id: supplierId,
      supplier_name: supplier?.name || '',
      supplier_phone: supplier?.phone || '',
      supplier_email: supplier?.email || '',
    })
  }

  const handleProductChange = (index, productId) => {
    const product = products.find((p) => p.id === productId)
    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      product_id: productId,
      product_name: product?.name || '',
      unit: product?.unit || 'Pcs',
      unit_price: product?.cost_price || 0,
      total_price: (product?.cost_price || 0) * newItems[index].quantity,
    }
    setItems(newItems)
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...items]
    newItems[index][field] = parseFloat(value) || 0
    newItems[index].total_price = newItems[index].unit_price * newItems[index].quantity
    setItems(newItems)
  }

  const addItem = useCallback(() => {
    setItemSearch('')
    setItems((prev) => {
      const next = [...prev, { product_id: '', product_name: '', quantity: 1, unit: 'Pcs', unit_price: 0, total_price: 0 }]
      setAutoFocusIndex(next.length - 1)
      return next
    })
  }, [])

  const focusQty = (index) => {
    setTimeout(() => {
      const inputs = document.querySelectorAll('[data-po-qty-input]')
      if (inputs[index]) inputs[index].focus()
    }, 30)
  }

  const removeItem = (index) => { if (items.length > 1) setItems(items.filter((_, i) => i !== index)) }

  // Ctrl/Cmd + I to add item
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault()
        addItem()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [addItem])

  const handleQtyKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const inputs = document.querySelectorAll('[data-po-price-input]')
      if (inputs[index]) inputs[index].focus()
    }
  }

  const handlePriceKeyDown = (e, index) => {
    if ((e.key === 'Tab' && !e.shiftKey && index === items.length - 1) || e.key === 'Enter') {
      if (index === items.length - 1) {
        e.preventDefault()
        addItem()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selects = document.querySelectorAll('[data-po-product-select]')
        if (selects[index + 1]) selects[index + 1].focus()
      }
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0)
  const discountAmount = subtotal * (parseFloat(formData.discount_percentage) || 0) / 100
  const afterDiscount = subtotal - discountAmount
  const taxAmount = afterDiscount * (parseFloat(formData.tax_percentage) || 0) / 100
  const cargoCharges = parseFloat(formData.cargo_charges) || 0
  const grandTotal = afterDiscount + taxAmount + cargoCharges

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validItems = items.filter((item) => item.product_name && item.quantity > 0)
    if (validItems.length === 0) { alert('Please add at least one item'); return }

    const paymentAmount = parseFloat(payment.amount) || 0
    const balanceDue = grandTotal - existingPaid
    if (paymentAmount < 0) { alert('Payment amount cannot be negative'); return }
    if (paymentAmount > balanceDue + 0.01) {
      alert(`Payment amount cannot exceed balance of QAR ${balanceDue.toFixed(2)}`)
      return
    }

    setSaving(true)
    try {
      const orderData = {
        po_date: formData.po_date,
        expected_delivery_date: formData.expected_delivery_date || null,
        supplier_id: formData.supplier_id || null,
        supplier_name: formData.supplier_name,
        supplier_phone: formData.supplier_phone || null,
        supplier_email: formData.supplier_email || null,
        subtotal, discount_percentage: parseFloat(formData.discount_percentage) || 0,
        discount_amount: discountAmount, tax_percentage: parseFloat(formData.tax_percentage) || 0,
        tax_amount: taxAmount, cargo_charges: cargoCharges, grand_total: grandTotal,
        payment_terms: formData.payment_terms || null,
        notes: formData.notes || null, status: formData.status,
      }

      let orderId = id
      if (isEditing) {
        const { error } = await supabase.from('purchase_orders').update(orderData).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('purchase_orders').insert(orderData).select().single()
        if (error) throw error
        orderId = data.id
      }

      // Reconcile line items: capture each existing line's previously-applied state
      // (qty + landed cost) so we can compute a delta against the new state and apply
      // it to product stock & cost price below. Updates preserve applied_* fields;
      // deletes are tracked separately to revert stock when removed.
      const lineFields = (item) => ({
        po_id: orderId,
        product_id: item.product_id || null,
        product_name: item.product_name,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total_price: item.total_price,
      })

      const keepIds = new Set(validItems.filter((i) => i.id).map((i) => i.id))
      const prevById = new Map()
      const deletedItems = []
      if (isEditing) {
        const { data: existingRows, error: existingErr } = await supabase
          .from('purchase_order_items')
          .select('id, product_id, quantity, applied_quantity, applied_landed_cost, received_at')
          .eq('po_id', orderId)
        if (existingErr) throw existingErr
        for (const row of existingRows || []) {
          prevById.set(row.id, row)
          if (!keepIds.has(row.id)) deletedItems.push(row)
        }
        if (deletedItems.length) {
          const { error: delErr } = await supabase
            .from('purchase_order_items')
            .delete()
            .in('id', deletedItems.map((r) => r.id))
          if (delErr) throw delErr
        }
        for (const item of validItems.filter((i) => i.id)) {
          const { error: updErr } = await supabase
            .from('purchase_order_items')
            .update(lineFields(item))
            .eq('id', item.id)
          if (updErr) throw updErr
        }
      }

      const newRows = validItems.filter((i) => !i.id).map(lineFields)
      const insertedItems = []
      if (newRows.length) {
        const { data: insData, error: insErr } = await supabase
          .from('purchase_order_items')
          .insert(newRows)
          .select('id, product_id, product_name, quantity, unit, unit_price, total_price')
        if (insErr) throw insErr
        insertedItems.push(...(insData || []))
      }

      // Record payment if entered — wrapped separately so it can't break the save
      if (paymentAmount > 0) {
        try {
          const { error: payErr } = await supabase.from('po_payments').insert({
            po_id: orderId,
            payment_date: payment.payment_date,
            amount: paymentAmount,
            payment_method: payment.payment_method,
            reference: payment.reference || null,
            notes: payment.notes || null,
          })
          if (payErr) throw payErr

          const newTotalPaid = existingPaid + paymentAmount
          const newStatus = newTotalPaid >= grandTotal - 0.01 ? 'paid' : 'partial'
          const { error: poUpdErr } = await supabase
            .from('purchase_orders')
            .update({ amount_paid: newTotalPaid, payment_status: newStatus })
            .eq('id', orderId)
          if (poUpdErr) throw poUpdErr
        } catch (payError) {
          console.error('Payment record error (PO saved successfully):', payError)
          alert('Order saved but failed to record payment. Use the Make Payment page to record it.')
        }
      }

      // Unified stock + cost reconciliation. For every PO line we know the previously-
      // applied (qty, landed_cost) on the row; we compute the new (qty, landed_cost)
      // from the current PO totals and apply the delta to product stock and weighted-
      // average cost. Deletions revert the previously-applied amount unconditionally;
      // updates and new lines are gated on the PO being in 'received' status (matching
      // the existing convention that nothing is bumped for draft/sent/confirmed POs).
      try {
        const poSubtotal = validItems.reduce((s, i) => s + (Number(i.total_price) || 0), 0)
        const taxPct = parseFloat(formData.tax_percentage) || 0
        const poCargoCharges = parseFloat(formData.cargo_charges) || 0

        const computeLandedCost = (qty, total) => {
          const q = Number(qty) || 0
          const t = Number(total) || 0
          if (q <= 0) return 0
          const lineShare = poSubtotal > 0 ? t / poSubtotal : 0
          const lc = (t + (t * taxPct / 100) + (lineShare * poCargoCharges)) / q
          return Number.isFinite(lc) ? lc : 0
        }

        const productCache = new Map()
        const getProduct = async (productId) => {
          if (productCache.has(productId)) return productCache.get(productId)
          const { data: prod, error } = await supabase
            .from('products')
            .select('stock_quantity, cost_price')
            .eq('id', productId)
            .single()
          if (error) throw error
          if (!prod) throw new Error('product not found')
          const state = { stock: Number(prod.stock_quantity) || 0, cost: Number(prod.cost_price) || 0 }
          productCache.set(productId, state)
          return state
        }

        const applyDelta = async (productId, qtyDelta, valueDelta, reason) => {
          if (!productId) return
          if (qtyDelta === 0 && Math.abs(valueDelta) < 0.0001) return
          const state = await getProduct(productId)
          const prevStock = state.stock
          const prevCost = state.cost
          const newStock = Math.max(0, prevStock + qtyDelta)
          const newValue = Math.max(0, prevStock * prevCost + valueDelta)
          const newCost = newStock > 0 ? Math.round((newValue / newStock) * 100) / 100 : 0

          const { error: updErr } = await supabase
            .from('products')
            .update({ stock_quantity: newStock, cost_price: newCost })
            .eq('id', productId)
          if (updErr) throw updErr
          state.stock = newStock
          state.cost = newCost

          if (qtyDelta !== 0) {
            try {
              await supabase.from('stock_adjustments').insert({
                product_id: productId,
                adjustment_type: qtyDelta > 0 ? 'add' : 'remove',
                quantity: Math.abs(qtyDelta),
                previous_stock: prevStock,
                new_stock: newStock,
                reason,
                created_by_email: user?.email || null,
              })
            } catch (logErr) {
              console.warn('stock_adjustments log failed (non-fatal):', logErr)
            }
          }
        }

        const failures = []

        // Deletions: revert whatever was applied for the removed line.
        for (const del of deletedItems) {
          const appliedQty = Number(del.applied_quantity) || 0
          if (!del.product_id || appliedQty <= 0) continue
          const appliedCost = Number(del.applied_landed_cost) || 0
          try {
            await applyDelta(
              del.product_id,
              -appliedQty,
              -(appliedQty * appliedCost),
              `PO line removed: ${formData.supplier_name}`
            )
          } catch (err) {
            console.error('Revert failed for deleted line:', err)
            failures.push('(deleted line)')
          }
        }

        // Status transition: received → not-received reverts every surviving line so
        // the PO no longer contributes to stock. Re-flipping back to received will
        // re-apply from scratch.
        if (previousStatus === 'received' && formData.status !== 'received') {
          for (const item of validItems.filter((i) => i.id)) {
            const prev = prevById.get(item.id)
            if (!prev || !prev.product_id) continue
            const appliedQty = Number(prev.applied_quantity) || 0
            const appliedCost = Number(prev.applied_landed_cost) || 0
            if (appliedQty <= 0) continue
            try {
              await applyDelta(
                prev.product_id,
                -appliedQty,
                -(appliedQty * appliedCost),
                `PO status changed from received: ${formData.supplier_name}`
              )
              await supabase
                .from('purchase_order_items')
                .update({ applied_quantity: 0, applied_landed_cost: 0 })
                .eq('id', item.id)
            } catch (err) {
              console.error('Status-revert failed for line:', err)
              failures.push(item.product_name)
            }
          }
        }

        // Updates and new lines apply only when the PO is currently 'received'.
        if (formData.status === 'received') {
          const lineWork = [
            ...validItems
              .filter((i) => i.id)
              .map((item) => ({ item, prev: prevById.get(item.id), isNew: false })),
            ...insertedItems.map((row) => ({
              item: {
                id: row.id,
                product_id: row.product_id,
                product_name: row.product_name,
                quantity: Number(row.quantity) || 0,
                unit: row.unit,
                unit_price: Number(row.unit_price) || 0,
                total_price: Number(row.total_price) || 0,
              },
              prev: { product_id: row.product_id, applied_quantity: 0, applied_landed_cost: 0, received_at: null },
              isNew: true,
            })),
          ]

          for (const { item, prev, isNew } of lineWork) {
            if (!item.product_id || !prev) continue
            try {
              const newQty = Number(item.quantity) || 0
              const newLandedCost = computeLandedCost(newQty, item.total_price)
              const prevAppliedQty = Number(prev.applied_quantity) || 0
              const prevAppliedCost = Number(prev.applied_landed_cost) || 0
              const productChanged = prev.product_id && prev.product_id !== item.product_id

              if (productChanged) {
                if (prevAppliedQty > 0) {
                  await applyDelta(
                    prev.product_id,
                    -prevAppliedQty,
                    -(prevAppliedQty * prevAppliedCost),
                    `PO line product changed: ${formData.supplier_name}`
                  )
                }
                await applyDelta(
                  item.product_id,
                  newQty,
                  newQty * newLandedCost,
                  `PO received: ${formData.supplier_name} (landed cost: ${newLandedCost.toFixed(2)})`
                )
              } else {
                const qtyDelta = newQty - prevAppliedQty
                const valueDelta = (newQty * newLandedCost) - (prevAppliedQty * prevAppliedCost)
                if (qtyDelta !== 0 || Math.abs(valueDelta) > 0.0001) {
                  const reasonAction = isNew || prevAppliedQty === 0 ? 'received' : 'updated'
                  await applyDelta(
                    item.product_id,
                    qtyDelta,
                    valueDelta,
                    `PO ${reasonAction}: ${formData.supplier_name} (landed cost: ${newLandedCost.toFixed(2)})`
                  )
                }
              }

              const updateFields = {
                applied_quantity: newQty,
                applied_landed_cost: newLandedCost,
              }
              if (!prev.received_at) updateFields.received_at = new Date().toISOString()
              await supabase
                .from('purchase_order_items')
                .update(updateFields)
                .eq('id', item.id)
            } catch (err) {
              console.error(`Stock update failed for "${item.product_name}":`, err)
              failures.push(item.product_name)
            }
          }
        }

        if (failures.length) {
          alert(`Stock could not be updated for: ${failures.join(', ')}. Check the console for details.`)
        }
      } catch (stockError) {
        console.error('Stock update error (PO saved successfully):', stockError)
      }

      navigate(`/purchase-orders/${orderId}`)
    } catch (error) {
      console.error('Error saving order:', error)
      alert('Failed to save purchase order')
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
        <Link to="/purchase-orders" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to list</Link>
        <h1 className="text-xl lg:text-2xl font-bold text-white">{isEditing ? 'Edit Purchase Order' : 'New Purchase Order'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
          <h2 className="text-lg font-medium text-white mb-4">Order Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Date *</label>
              <input type="date" required value={formData.po_date} onChange={(e) => setFormData({ ...formData, po_date: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Expected Delivery</label>
              <input type="date" value={formData.expected_delivery_date} onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Status</label>
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50">
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="confirmed">Confirmed</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-zinc-300 mb-1">Supplier *</label>
              <select required value={formData.supplier_id} onChange={(e) => handleSupplierChange(e.target.value)} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50">
                <option value="">Select Supplier</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-white">Items</h2>
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-teal-400 hover:text-teal-300" title="Add Item (Ctrl+I)"><Plus className="w-4 h-4" /> Add Item <span className="text-xs text-zinc-600 ml-1 hidden sm:inline">(Ctrl+I)</span></button>
          </div>

          {items.length > 1 && (
            <div className="mb-3">
              <SearchInput value={itemSearch} onChange={setItemSearch} placeholder="Search items..." />
            </div>
          )}

          <div className="space-y-3">
            {(() => {
              const q = itemSearch.trim().toLowerCase()
              const visible = items
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => !q || !item.product_name || item.product_name.toLowerCase().includes(q))
              if (visible.length === 0) {
                return <p className="text-sm text-zinc-500 text-center py-4">No items match "{itemSearch}".</p>
              }
              return visible.map(({ item, index }) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end bg-zinc-800/30 rounded-lg p-3">
                <div className="col-span-12 md:col-span-4">
                  <label className="block text-xs text-zinc-400 mb-1">Product</label>
                  <ProductSearchSelect
                    products={products}
                    value={item.product_id}
                    onChange={(productId) => handleProductChange(index, productId)}
                    onConfirm={() => focusQty(index)}
                    autoFocus={autoFocusIndex === index}
                    showStock={false}
                    className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="col-span-3 md:col-span-2">
                  <label className="block text-xs text-zinc-400 mb-1">Qty</label>
                  <input data-po-qty-input type="number" min="0" step="any" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} onKeyDown={(e) => handleQtyKeyDown(e, index)} className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="col-span-3 md:col-span-2">
                  <label className="block text-xs text-zinc-400 mb-1">Unit Price</label>
                  <input data-po-price-input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)} onKeyDown={(e) => handlePriceKeyDown(e, index)} className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="col-span-5 md:col-span-3">
                  <label className="block text-xs text-zinc-400 mb-1">Total</label>
                  <p className="text-sm font-medium text-white py-2 px-3">QAR {item.total_price.toFixed(2)}</p>
                </div>
                <div className="col-span-1">
                  <button type="button" onClick={() => removeItem(index)} disabled={items.length <= 1} className="p-2 text-red-400 hover:text-red-300 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              ))
            })()}
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-zinc-400">Subtotal:</span><span className="text-zinc-200">QAR {subtotal.toFixed(2)}</span></div>
              <div className="flex items-center justify-between text-sm gap-2">
                <span className="text-zinc-400">Discount:</span>
                <div className="flex items-center gap-1">
                  <input type="number" min="0" max="100" step="0.1" value={formData.discount_percentage} onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })} className="w-16 bg-zinc-700/50 border border-zinc-600 rounded text-white text-sm text-right px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500" />
                  <span className="text-zinc-500 text-xs">%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm gap-2">
                <span className="text-zinc-400">VAT:</span>
                <div className="flex items-center gap-1">
                  <input type="number" min="0" max="100" step="0.1" value={formData.tax_percentage} onChange={(e) => setFormData({ ...formData, tax_percentage: e.target.value })} className="w-16 bg-zinc-700/50 border border-zinc-600 rounded text-white text-sm text-right px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500" />
                  <span className="text-zinc-500 text-xs">%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm gap-2">
                <span className="text-zinc-400">Cargo:</span>
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500 text-xs">QAR</span>
                  <input type="number" min="0" step="0.01" value={formData.cargo_charges} onChange={(e) => setFormData({ ...formData, cargo_charges: e.target.value })} className="w-20 bg-zinc-700/50 border border-zinc-600 rounded text-white text-sm text-right px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500" />
                </div>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-zinc-700 pt-2">
                <span className="text-zinc-200">Total:</span>
                <span className="text-teal-400">QAR {grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {(() => {
          const balanceDue = Math.max(0, grandTotal - existingPaid)
          const enteredAmount = parseFloat(payment.amount) || 0
          const remainingAfter = Math.max(0, balanceDue - enteredAmount)
          const fullyPaid = balanceDue <= 0.01
          return (
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-white">Payment {isEditing ? '' : '(optional)'}</h2>
                {isEditing && (
                  <Link to={`/accounts-payable/${id}/pay`} className="text-sm text-teal-400 hover:text-teal-300">Manage payments &rarr;</Link>
                )}
              </div>

              {isEditing && existingPaid > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                  <div className="bg-zinc-800/40 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Already Paid</p>
                    <p className="font-medium text-green-400">QAR {existingPaid.toFixed(2)}</p>
                  </div>
                  <div className="bg-zinc-800/40 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Order Total</p>
                    <p className="font-medium text-zinc-200">QAR {grandTotal.toFixed(2)}</p>
                  </div>
                  <div className="bg-zinc-800/40 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Balance Due</p>
                    <p className={`font-medium ${balanceDue > 0 ? 'text-red-400' : 'text-green-400'}`}>QAR {balanceDue.toFixed(2)}</p>
                  </div>
                </div>
              )}

              {fullyPaid ? (
                <p className="text-sm text-green-400">Order is fully paid.</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1">Payment Date</label>
                      <input type="date" value={payment.payment_date} onChange={(e) => setPayment({ ...payment, payment_date: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1">Amount Paid (QAR)</label>
                      <input type="number" min="0" step="0.01" max={balanceDue} value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} placeholder="0.00" className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1">Method</label>
                      <select value={payment.payment_method} onChange={(e) => setPayment({ ...payment, payment_method: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50">
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cash">Cash</option>
                        <option value="cheque">Cheque</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1">Reference #</label>
                      <input type="text" value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} placeholder="Transfer/Cheque #" className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-zinc-300 mb-1">Payment Notes</label>
                      <input type="text" value={payment.notes} onChange={(e) => setPayment({ ...payment, notes: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-sm">
                    <button type="button" onClick={() => setPayment({ ...payment, amount: balanceDue.toFixed(2) })} className="text-teal-400 hover:text-teal-300">
                      Pay full balance (QAR {balanceDue.toFixed(2)})
                    </button>
                    {enteredAmount > 0 && (
                      <span className="text-zinc-400">
                        Remaining after payment: <span className={remainingAfter <= 0.01 ? 'text-green-400' : 'text-zinc-200'}>QAR {remainingAfter.toFixed(2)}</span>
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })()}

        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Payment Terms</label>
              <input type="text" value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} placeholder="e.g. Net 30" className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Notes</label>
              <input type="text" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <Link to="/purchase-orders" className="w-full sm:w-auto text-center px-6 py-2 border border-zinc-700 rounded-xl text-zinc-300 hover:bg-zinc-800">Cancel</Link>
          <button type="submit" disabled={saving} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl hover:from-teal-500 hover:to-teal-400 disabled:opacity-50">
            {saving ? 'Saving...' : isEditing ? 'Update Order' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  )
}
