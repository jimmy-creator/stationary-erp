import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Plus, Trash2 } from 'lucide-react'

export function SaleForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEditing = Boolean(id)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])

  const [formData, setFormData] = useState({
    sale_date: new Date().toISOString().split('T')[0],
    customer_id: '',
    customer_name: '',
    discount_percentage: '0',
    tax_percentage: '0',
    payment_method: 'cash',
    payment_status: 'paid',
    amount_paid: '',
    notes: '',
    status: 'completed',
  })

  const [items, setItems] = useState([{ product_id: '', product_name: '', quantity: 1, unit_price: 0, total_price: 0 }])

  useEffect(() => {
    fetchData().then(() => {
      // Auto-focus first product select on new sale
      if (!isEditing) focusLastProductSelect()
    })
    if (isEditing) fetchSale()
  }, [id])

  const fetchData = async () => {
    const [customersRes, productsRes] = await Promise.all([
      supabase.from('customers').select('id, name').eq('is_active', true).order('name'),
      supabase.from('products').select('id, name, selling_price, stock_quantity, unit').eq('is_active', true).order('name'),
    ])
    setCustomers(customersRes.data || [])
    setProducts(productsRes.data || [])
  }

  const fetchSale = async () => {
    setLoading(true)
    try {
      const [saleRes, itemsRes] = await Promise.all([
        supabase.from('sales').select('*').eq('id', id).single(),
        supabase.from('sale_items').select('*').eq('sale_id', id),
      ])

      if (saleRes.error) throw saleRes.error
      const sale = saleRes.data

      setFormData({
        sale_date: sale.sale_date,
        customer_id: sale.customer_id || '',
        customer_name: sale.customer_name || '',
        discount_percentage: sale.discount_percentage?.toString() || '0',
        tax_percentage: sale.tax_percentage?.toString() || '15',
        payment_method: sale.payment_method || 'cash',
        payment_status: sale.payment_status || 'paid',
        amount_paid: sale.amount_paid?.toString() || '',
        notes: sale.notes || '',
        status: sale.status || 'completed',
      })

      if (itemsRes.data?.length) {
        setItems(itemsRes.data.map((item) => ({
          id: item.id,
          product_id: item.product_id || '',
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        })))
      }
    } catch (error) {
      console.error('Error fetching sale:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCustomerChange = (customerId) => {
    const customer = customers.find((c) => c.id === customerId)
    setFormData({ ...formData, customer_id: customerId, customer_name: customer?.name || '' })
  }

  const handleProductChange = (index, productId) => {
    const product = products.find((p) => p.id === productId)
    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      product_id: productId,
      product_name: product?.name || '',
      unit_price: product?.selling_price || 0,
      total_price: (product?.selling_price || 0) * newItems[index].quantity,
    }
    setItems(newItems)
  }

  const handleQuantityChange = (index, quantity) => {
    const newItems = [...items]
    newItems[index].quantity = parseInt(quantity) || 0
    newItems[index].total_price = newItems[index].unit_price * newItems[index].quantity
    setItems(newItems)
  }

  const handleUnitPriceChange = (index, price) => {
    const newItems = [...items]
    newItems[index].unit_price = parseFloat(price) || 0
    newItems[index].total_price = newItems[index].unit_price * newItems[index].quantity
    setItems(newItems)
  }

  const focusLastProductSelect = () => {
    setTimeout(() => {
      const selects = document.querySelectorAll('[data-product-select]')
      const last = selects[selects.length - 1]
      if (last) {
        last.focus()
        // Open the dropdown by simulating a mousedown or using size trick
        last.size = last.options.length > 10 ? 10 : last.options.length
        last.addEventListener('change', function handler() {
          last.size = 0
          last.removeEventListener('change', handler)
        }, { once: true })
        last.addEventListener('blur', function handler() {
          last.size = 0
          last.removeEventListener('blur', handler)
        }, { once: true })
      }
    }, 50)
  }

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, { product_id: '', product_name: '', quantity: 1, unit_price: 0, total_price: 0 }])
    focusLastProductSelect()
  }, [])

  const removeItem = (index) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  // Keyboard shortcut: Ctrl/Cmd + I to add item
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

  // Enter on product select → focus qty
  const handleProductKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const qtyInputs = document.querySelectorAll('[data-qty-input]')
      if (qtyInputs[index]) qtyInputs[index].focus()
    }
  }

  // Enter on qty → focus price
  const handleQtyKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const priceInputs = document.querySelectorAll('[data-price-input]')
      if (priceInputs[index]) priceInputs[index].focus()
    }
  }

  // Enter or Tab on last price field → add new item
  const handlePriceKeyDown = (e, index) => {
    if ((e.key === 'Tab' && !e.shiftKey && index === items.length - 1) || e.key === 'Enter') {
      if (index === items.length - 1) {
        e.preventDefault()
        addItem()
      } else if (e.key === 'Enter') {
        // Enter on non-last price → focus next product select
        e.preventDefault()
        const selects = document.querySelectorAll('[data-product-select]')
        if (selects[index + 1]) selects[index + 1].focus()
      }
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0)
  const discountAmount = subtotal * (parseFloat(formData.discount_percentage) || 0) / 100
  const afterDiscount = subtotal - discountAmount
  const taxAmount = afterDiscount * (parseFloat(formData.tax_percentage) || 0) / 100
  const grandTotal = afterDiscount + taxAmount

  const handleSubmit = async (e) => {
    e.preventDefault()

    const validItems = items.filter((item) => item.product_name && item.quantity > 0)
    if (validItems.length === 0) {
      alert('Please add at least one item')
      return
    }

    // Stock check — only for new sales
    if (!isEditing) {
      for (const item of validItems) {
        if (item.product_id) {
          const product = products.find((p) => p.id === item.product_id)
          if (product && item.quantity > product.stock_quantity) {
            alert(`Insufficient stock for "${product.name}". Available: ${product.stock_quantity}, Requested: ${item.quantity}`)
            return
          }
        }
      }
    }

    setSaving(true)
    try {
      const saleData = {
        sale_date: formData.sale_date,
        customer_id: formData.customer_id || null,
        customer_name: formData.customer_name || null,
        subtotal,
        discount_percentage: parseFloat(formData.discount_percentage) || 0,
        discount_amount: discountAmount,
        tax_percentage: parseFloat(formData.tax_percentage) || 0,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        payment_method: formData.payment_method,
        payment_status: formData.payment_status,
        amount_paid: formData.payment_status === 'paid'
          ? (parseFloat(formData.amount_paid) || grandTotal)
          : (parseFloat(formData.amount_paid) || 0),
        notes: formData.notes || null,
        status: formData.status,
        created_by_email: isEditing ? undefined : (user?.email || null),
      }

      let saleId = id

      if (isEditing) {
        const { error } = await supabase.from('sales').update(saleData).eq('id', id)
        if (error) throw error

        // Delete old items and re-insert
        await supabase.from('sale_items').delete().eq('sale_id', id)
      } else {
        const { data, error } = await supabase.from('sales').insert(saleData).select().single()
        if (error) throw error
        saleId = data.id
      }

      // Insert items
      const itemsData = validItems.map((item) => ({
        sale_id: saleId,
        product_id: item.product_id || null,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }))

      const { error: itemsError } = await supabase.from('sale_items').insert(itemsData)
      if (itemsError) throw itemsError

      // Update stock quantities (deduct for new sales)
      if (!isEditing) {
        for (const item of validItems) {
          if (item.product_id) {
            const product = products.find((p) => p.id === item.product_id)
            if (product) {
              await supabase
                .from('products')
                .update({ stock_quantity: Math.max(0, product.stock_quantity - item.quantity) })
                .eq('id', item.product_id)
            }
          }
        }
      }

      navigate(`/sales/${saleId}`)
    } catch (error) {
      console.error('Error saving sale:', error)
      alert('Failed to save sale')
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
        <Link to="/sales" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to list</Link>
        <h1 className="text-xl lg:text-2xl font-bold text-white">{isEditing ? 'Edit Sale' : 'New Sale'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sale Details */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
          <h2 className="text-lg font-medium text-white mb-4">Sale Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Date *</label>
              <input type="date" required value={formData.sale_date} onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Customer</label>
              <select value={formData.customer_id} onChange={(e) => handleCustomerChange(e.target.value)} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50">
                <option value="">Walk-in Customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Status</label>
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50">
                <option value="completed">Completed</option>
                <option value="returned">Returned</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-white">Items</h2>
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-teal-400 hover:text-teal-300" title="Add Item (Ctrl+I)">
              <Plus className="w-4 h-4" /> Add Item <span className="text-xs text-zinc-600 ml-1 hidden sm:inline">(Ctrl+I)</span>
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end bg-zinc-800/30 rounded-lg p-3">
                <div className="col-span-12 md:col-span-5">
                  <label className="block text-xs text-zinc-400 mb-1">Product</label>
                  <select data-product-select value={item.product_id} onChange={(e) => handleProductChange(index, e.target.value)} onKeyDown={(e) => handleProductKeyDown(e, index)} className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
                    <option value="">Select product</option>
                    {products.map((p) => <option key={p.id} value={p.id} disabled={p.stock_quantity <= 0}>{p.name} ({p.stock_quantity} {p.unit}){p.stock_quantity <= 0 ? ' - OUT OF STOCK' : ''}</option>)}
                  </select>
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="block text-xs text-zinc-400 mb-1">Qty</label>
                  <input data-qty-input type="number" min="1" value={item.quantity} onChange={(e) => handleQuantityChange(index, e.target.value)} onKeyDown={(e) => handleQtyKeyDown(e, index)} className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="block text-xs text-zinc-400 mb-1">Price</label>
                  <input data-price-input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => handleUnitPriceChange(index, e.target.value)} onKeyDown={(e) => handlePriceKeyDown(e, index)} className="w-full bg-zinc-700/50 border border-zinc-600 rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="col-span-3 md:col-span-2">
                  <label className="block text-xs text-zinc-400 mb-1">Total</label>
                  <p className="text-sm font-medium text-white py-2 px-3">QAR {item.total_price.toFixed(2)}</p>
                </div>
                <div className="col-span-1">
                  <button type="button" onClick={() => removeItem(index)} disabled={items.length <= 1} className="p-2 text-red-400 hover:text-red-300 disabled:opacity-30">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-zinc-400">Subtotal:</span><span className="text-zinc-200">QAR {subtotal.toFixed(2)}</span></div>
              <div className="flex items-center justify-between text-sm gap-2">
                <span className="text-zinc-400">Discount:</span>
                <div className="flex items-center gap-1">
                  <input type="number" min="0" max="100" step="0.1" value={formData.discount_percentage} onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })} className="w-16 bg-zinc-700/50 border border-zinc-600 rounded text-white text-sm text-right px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500" />
                  <span className="text-zinc-500 text-xs">%</span>
                  <span className="text-red-400 ml-2">-QAR {discountAmount.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-zinc-700 pt-2">
                <span className="text-zinc-200">Total:</span>
                <span className="text-teal-400">QAR {grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
          <h2 className="text-lg font-medium text-white mb-4">Payment</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Payment Method</label>
              <select value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50">
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit">Credit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Payment Status</label>
              <select value={formData.payment_status} onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50">
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Amount Paid</label>
              <input type="number" min="0" step="0.01" value={formData.amount_paid} onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })} placeholder={grandTotal.toFixed(2)} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-300 mb-1">Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <Link to="/sales" className="w-full sm:w-auto text-center px-6 py-2 border border-zinc-700 rounded-xl text-zinc-300 hover:bg-zinc-800">Cancel</Link>
          <button type="submit" disabled={saving} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl hover:from-teal-500 hover:to-teal-400 disabled:opacity-50">
            {saving ? 'Saving...' : isEditing ? 'Update Sale' : 'Create Sale'}
          </button>
        </div>
      </form>
    </div>
  )
}
