import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStoreSettings } from '../../hooks/useStoreSettings'

export function PurchaseOrderView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { settings: store } = useStoreSettings()
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => { fetchOrder() }, [id])

  const fetchOrder = async () => {
    try {
      const [orderRes, itemsRes] = await Promise.all([
        supabase.from('purchase_orders').select('*').eq('id', id).single(),
        supabase.from('purchase_order_items').select('*').eq('po_id', id),
      ])
      if (orderRes.error) throw orderRes.error
      setOrder(orderRes.data)
      setItems(itemsRes.data || [])
    } catch (error) {
      console.error('Error fetching purchase order:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
      if (error) throw error
      navigate('/purchase-orders')
    } catch (error) {
      console.error('Error deleting:', error)
      alert('Failed to delete')
    } finally { setDeleting(false); setShowDeleteModal(false) }
  }

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'
  const formatCurrency = (amount) => `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  const statusLabels = {
    draft: { label: 'Draft', class: 'bg-zinc-800 text-zinc-300' },
    sent: { label: 'Sent', class: 'bg-blue-900/50 text-blue-400' },
    confirmed: { label: 'Confirmed', class: 'bg-purple-900/50 text-purple-400' },
    received: { label: 'Received', class: 'bg-green-900/50 text-green-400' },
    cancelled: { label: 'Cancelled', class: 'bg-red-900/50 text-red-400' },
  }

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  if (!order) return <div className="text-center py-8"><p className="text-zinc-500">Not found.</p><Link to="/purchase-orders" className="text-teal-600 hover:underline">Back</Link></div>

  return (
    <div className="max-w-4xl mx-auto print-area">
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-zinc-200 mb-4">Delete Purchase Order</h3>
            <p className="text-zinc-400 mb-6">Delete <strong>{order.po_number}</strong>?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className="px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 print-hide">
        <div>
          <Link to="/purchase-orders" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to list</Link>
          <h1 className="text-xl lg:text-2xl font-bold text-white">{order.po_number}</h1>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Link to={`/purchase-orders/${id}/edit`} className="flex-1 sm:flex-none text-center px-4 py-2 text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-md hover:bg-teal-500/20">Edit</Link>
          <button onClick={() => setShowDeleteModal(true)} className="flex-1 sm:flex-none px-4 py-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20">Delete</button>
          <button onClick={() => window.print()} className="flex-1 sm:flex-none px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">Print</button>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl">
        <div className="p-4 lg:p-6 border-b border-zinc-800">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{store.store_name || 'PURCHASE ORDER'}</h1>
              {store.address && <p className="text-sm text-zinc-400 whitespace-pre-wrap">{store.address}</p>}
              {(store.phone || store.email) && (
                <p className="text-sm text-zinc-500">
                  {store.phone && `Tel: ${store.phone}`}{store.phone && store.email && ' | '}{store.email && store.email}
                </p>
              )}
              <p className="text-sm font-semibold text-zinc-300 mt-2">PURCHASE ORDER</p>
              <p className="text-lg font-semibold text-teal-400">{order.po_number}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-zinc-500">Date: {formatDate(order.po_date)}</p>
              {order.expected_delivery_date && <p className="text-sm text-zinc-500">Expected: {formatDate(order.expected_delivery_date)}</p>}
              <span className={`inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full ${statusLabels[order.status]?.class}`}>{statusLabels[order.status]?.label}</span>
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-500 uppercase mb-2">Supplier</h3>
          <p className="font-medium text-zinc-200">{order.supplier_name}</p>
          {order.supplier_phone && <p className="text-sm text-zinc-400">Phone: {order.supplier_phone}</p>}
          {order.supplier_email && <p className="text-sm text-zinc-400">Email: {order.supplier_email}</p>}
        </div>

        <div className="p-4 lg:p-6 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-500 uppercase mb-4">Items</h3>
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">#</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Product</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-zinc-500 uppercase">Qty</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 uppercase">Unit Price</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {items.map((item, i) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm text-zinc-500">{i + 1}</td>
                    <td className="px-4 py-3 text-sm text-zinc-200">{item.product_name}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400 text-center">{item.quantity} {item.unit}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400 text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-200 text-right">{formatCurrency(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {items.map((item, i) => (
              <div key={item.id} className="bg-zinc-800/30 rounded-lg p-3">
                <div className="flex justify-between"><span className="text-sm text-zinc-200">{item.product_name}</span><span className="font-medium text-zinc-200">{formatCurrency(item.total_price)}</span></div>
                <p className="text-xs text-zinc-500">{item.quantity} {item.unit} x {formatCurrency(item.unit_price)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-zinc-400">Subtotal:</span><span className="text-zinc-200">{formatCurrency(order.subtotal)}</span></div>
              {order.discount_amount > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Discount ({order.discount_percentage}%):</span><span className="text-red-400">-{formatCurrency(order.discount_amount)}</span></div>}
              {order.tax_amount > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">VAT ({order.tax_percentage}%):</span><span className="text-zinc-200">{formatCurrency(order.tax_amount)}</span></div>}
              {order.cargo_charges > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Cargo Charges:</span><span className="text-zinc-200">{formatCurrency(order.cargo_charges)}</span></div>}
              <div className="flex justify-between text-lg font-bold border-t border-zinc-800 pt-2">
                <span className="text-zinc-200">Grand Total:</span>
                <span className="text-teal-400">{formatCurrency(order.grand_total)}</span>
              </div>
            </div>
          </div>
        </div>

        {(order.payment_terms || order.notes) && (
          <div className="p-4 lg:p-6">
            {order.payment_terms && <div className="mb-3"><p className="text-xs font-semibold text-zinc-500 uppercase">Payment Terms</p><p className="text-sm text-zinc-300">{order.payment_terms}</p></div>}
            {order.notes && <div><p className="text-xs font-semibold text-zinc-500 uppercase">Notes</p><p className="text-sm text-zinc-300">{order.notes}</p></div>}
          </div>
        )}
      </div>
    </div>
  )
}
