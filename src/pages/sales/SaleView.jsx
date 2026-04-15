import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStoreSettings } from '../../hooks/useStoreSettings'

export function SaleView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { settings: store } = useStoreSettings()
  const [sale, setSale] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    fetchSale()
  }, [id])

  const fetchSale = async () => {
    try {
      const [saleRes, itemsRes] = await Promise.all([
        supabase.from('sales').select('*').eq('id', id).single(),
        supabase.from('sale_items').select('*').eq('sale_id', id),
      ])
      if (saleRes.error) throw saleRes.error
      setSale(saleRes.data)
      setItems(itemsRes.data || [])
    } catch (error) {
      console.error('Error fetching sale:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('sales').delete().eq('id', id)
      if (error) throw error
      navigate('/sales')
    } catch (error) {
      console.error('Error deleting sale:', error)
      alert('Failed to delete sale')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'
  const formatCurrency = (amount) => `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  const statusLabels = {
    completed: { label: 'Completed', class: 'bg-green-900/50 text-green-400' },
    returned: { label: 'Returned', class: 'bg-orange-900/50 text-orange-400' },
    cancelled: { label: 'Cancelled', class: 'bg-red-900/50 text-red-400' },
  }

  const paymentStatusLabels = {
    paid: { label: 'Paid', class: 'bg-green-900/50 text-green-400' },
    partial: { label: 'Partial', class: 'bg-yellow-900/50 text-yellow-400' },
    unpaid: { label: 'Unpaid', class: 'bg-red-900/50 text-red-400' },
  }

  const paymentLabels = { cash: 'Cash', card: 'Card', bank_transfer: 'Bank Transfer', credit: 'Credit' }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }

  if (!sale) {
    return <div className="text-center py-8"><p className="text-zinc-500">Sale not found.</p><Link to="/sales" className="text-teal-600 hover:underline">Back to list</Link></div>
  }

  return (
    <div className="max-w-4xl mx-auto print-area">
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-zinc-200 mb-4">Delete Sale</h3>
            <p className="text-zinc-400 mb-6">Are you sure you want to delete <strong>{sale.invoice_number}</strong>?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className="px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 print-hide">
        <div>
          <Link to="/sales" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to list</Link>
          <h1 className="text-xl lg:text-2xl font-bold text-white">{sale.invoice_number}</h1>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Link to={`/sales/${id}/edit`} className="flex-1 sm:flex-none text-center px-4 py-2 text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-md hover:bg-teal-500/20">Edit</Link>
          <button onClick={() => setShowDeleteModal(true)} className="flex-1 sm:flex-none px-4 py-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20">Delete</button>
          <button onClick={() => window.print()} className="flex-1 sm:flex-none px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">Print</button>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl">
        {/* Header */}
        <div className="p-4 lg:p-6 border-b border-zinc-800">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{store.store_name || 'INVOICE'}</h1>
              {store.address && <p className="text-sm text-zinc-400 whitespace-pre-wrap">{store.address}</p>}
              {(store.phone || store.email) && (
                <p className="text-sm text-zinc-500">
                  {store.phone && `Tel: ${store.phone}`}{store.phone && store.email && ' | '}{store.email && store.email}
                </p>
              )}
              <p className="text-lg font-semibold text-teal-400 mt-2">{sale.invoice_number}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-zinc-500">Date: {formatDate(sale.sale_date)}</p>
              <div className="flex gap-2 mt-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusLabels[sale.status]?.class}`}>
                  {statusLabels[sale.status]?.label}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${paymentStatusLabels[sale.payment_status]?.class}`}>
                  {paymentStatusLabels[sale.payment_status]?.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Customer */}
        <div className="p-4 lg:p-6 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-500 uppercase mb-2">Customer</h3>
          <p className="text-zinc-200 font-medium">{sale.customer_name || 'Walk-in Customer'}</p>
          <p className="text-sm text-zinc-400">Payment: {paymentLabels[sale.payment_method]}</p>
          {sale.created_by_email && <p className="text-sm text-zinc-400">Sold by: {sale.created_by_email}</p>}
        </div>

        {/* Items */}
        <div className="p-4 lg:p-6 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-500 uppercase mb-4">Items</h3>

          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">#</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Product</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-zinc-500 uppercase">Qty</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 uppercase">Price</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {items.map((item, i) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm text-zinc-500">{i + 1}</td>
                    <td className="px-4 py-3 text-sm text-zinc-200">{item.product_name}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400 text-center">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400 text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-200 text-right">{formatCurrency(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile items */}
          <div className="md:hidden space-y-3">
            {items.map((item, i) => (
              <div key={item.id} className="bg-zinc-800/30 rounded-lg p-3">
                <div className="flex justify-between"><span className="text-sm text-zinc-200">{item.product_name}</span><span className="font-medium text-zinc-200">{formatCurrency(item.total_price)}</span></div>
                <p className="text-xs text-zinc-500">{item.quantity} x {formatCurrency(item.unit_price)}</p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-zinc-400">Subtotal:</span><span className="text-zinc-200">{formatCurrency(sale.subtotal)}</span></div>
              {sale.discount_amount > 0 && (
                <div className="flex justify-between text-sm"><span className="text-zinc-400">Discount ({sale.discount_percentage}%):</span><span className="text-red-400">-{formatCurrency(sale.discount_amount)}</span></div>
              )}
              {sale.tax_amount > 0 && (
                <div className="flex justify-between text-sm"><span className="text-zinc-400">VAT ({sale.tax_percentage}%):</span><span className="text-zinc-200">{formatCurrency(sale.tax_amount)}</span></div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-zinc-800 pt-2">
                <span className="text-zinc-200">Grand Total:</span>
                <span className="text-teal-400">{formatCurrency(sale.grand_total)}</span>
              </div>
              {sale.payment_status !== 'paid' && (
                <div className="flex justify-between text-sm border-t border-zinc-800 pt-2">
                  <span className="text-zinc-400">Amount Paid:</span>
                  <span className="text-zinc-200">{formatCurrency(sale.amount_paid)}</span>
                </div>
              )}
              {sale.payment_status !== 'paid' && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Balance Due:</span>
                  <span className="text-red-400 font-bold">{formatCurrency(sale.grand_total - sale.amount_paid)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {sale.notes && (
          <div className="p-4 lg:p-6">
            <h3 className="text-sm font-medium text-zinc-500 uppercase mb-2">Notes</h3>
            <p className="text-sm text-zinc-300">{sale.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
