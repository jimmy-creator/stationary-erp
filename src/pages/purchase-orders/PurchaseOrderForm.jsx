import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ProductSearchSelect } from '../../components/ProductSearchSelect'
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
      setPreviousStatus(order.status)
      setExistingPaid(parseFloat(order.amount_paid || 0))

      if (itemsRes.data?.length) {
        setItems(itemsRes.data.map((item) => ({
          id: item.id, product_id: item.product_id || '', product_name: item.product_name,
          quantity: item.quantity, unit: item.unit || 'Pcs', unit_price: item.unit_price, total_price: item.total_price,
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
    newItems[index][field] = field === 'quantity' ? (parseInt(value) || 0) : (parseFloat(value) || 0)
    newItems[index].total_price = newItems[index].unit_price * newItems[index].quantity
    setItems(newItems)
  }

  const addItem = useCallback(() => {
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
        await supabase.from('purchase_order_items').delete().eq('po_id', id)
      } else {
        const { data, error } = await supabase.from('purchase_orders').insert(orderData).select().single()
        if (error) throw error
        orderId = data.id
      }

      const itemsData = validItems.map((item) => ({
        po_id: orderId, product_id: item.product_id || null, product_name: item.product_name,
        quantity: item.quantity, unit: item.unit, unit_price: item.unit_price, total_price: item.total_price,
      }))

      const { error: itemsError } = await supabase.from('purchase_order_items').insert(itemsData)
      if (itemsError) throw itemsError

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

      // Update stock when status changes to "received" — wrapped separately so it can't break the save
      try {
        const isNowReceived = formData.status === 'received'
        const wasNotReceived = previousStatus !== 'received'

        if (isNowReceived && wasNotReceived) {
          // Calculate cargo share per item (proportional to item value)
          const poSubtotal = validItems.reduce((s, i) => s + i.total_price, 0)
          const poCargoCharges = parseFloat(formData.cargo_charges) || 0

          for (const item of validItems) {
            if (item.product_id) {
              const { data: prod } = await supabase
                .from('products')
                .select('stock_quantity, cost_price')
                .eq('id', item.product_id)
                .single()

              if (prod) {
                const prevStock = prod.stock_quantity || 0
                const newStock = prevStock + item.quantity

                // Calculate landed cost per unit (item cost + proportional cargo)
                const cargoShare = poSubtotal > 0
                  ? (item.total_price / poSubtotal) * poCargoCharges
                  : 0
                const landedCostPerUnit = item.unit_price + (cargoShare / item.quantity)

                // Weighted average cost: blend existing stock cost with new landed cost
                const existingCost = parseFloat(prod.cost_price) || 0
                const weightedCost = prevStock > 0
                  ? ((existingCost * prevStock) + (landedCostPerUnit * item.quantity)) / newStock
                  : landedCostPerUnit
                const newCostPrice = Math.round(weightedCost * 100) / 100

                await supabase
                  .from('products')
                  .update({ stock_quantity: newStock, cost_price: newCostPrice })
                  .eq('id', item.product_id)

                await supabase.from('stock_adjustments').insert({
                  product_id: item.product_id,
                  adjustment_type: 'add',
                  quantity: item.quantity,
                  previous_stock: prevStock,
                  new_stock: newStock,
                  reason: `PO received: ${formData.supplier_name}` + (poCargoCharges > 0 ? ` (landed cost: ${newCostPrice})` : ''),
                  created_by_email: user?.email || null,
                }).catch(() => {})
              }
            }
          }
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

          <div className="space-y-3">
            {items.map((item, index) => (
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
                  <input data-po-qty-input type="number" min="1" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} onKeyDown={(e) => handleQtyKeyDown(e, index)} className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
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
            ))}
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
