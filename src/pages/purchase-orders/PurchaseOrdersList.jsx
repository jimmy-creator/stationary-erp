import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Package, Clock, CheckCircle } from 'lucide-react'
import { SearchInput } from '../../components/SearchInput'
import { useDebounce } from '../../hooks/useDebounce'

export function PurchaseOrdersList() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filter, setFilter] = useState({ status: '', month: '' })

  useEffect(() => {
    fetchOrders()
  }, [debouncedSearch])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      let query = supabase.from('purchase_orders').select('*').order('created_at', { ascending: false })

      if (debouncedSearch) {
        query = query.or(`po_number.ilike.%${debouncedSearch}%,supplier_name.ilike.%${debouncedSearch}%`)
      }

      const { data, error } = await query
      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Error fetching purchase orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'
  const formatCurrency = (amount) => `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  const statusLabels = {
    draft: { label: 'Draft', class: 'bg-zinc-800 text-zinc-300' },
    sent: { label: 'Sent', class: 'bg-blue-900/50 text-blue-400' },
    confirmed: { label: 'Confirmed', class: 'bg-purple-900/50 text-purple-400' },
    received: { label: 'Received', class: 'bg-green-900/50 text-green-400' },
    cancelled: { label: 'Cancelled', class: 'bg-red-900/50 text-red-400' },
  }

  const months = [...new Set(orders.map((o) => o.po_date?.substring(0, 7)).filter(Boolean))].sort().reverse()

  const filteredOrders = orders.filter((order) => {
    if (filter.status && order.status !== filter.status) return false
    if (filter.month && order.po_date?.substring(0, 7) !== filter.month) return false
    return true
  })

  const totalOrders = filteredOrders.length
  const pendingOrders = filteredOrders.filter((o) => ['draft', 'sent', 'confirmed'].includes(o.status)).length
  const totalValue = filteredOrders.reduce((sum, o) => sum + parseFloat(o.grand_total || 0), 0)

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Purchase Orders</h1>
        <Link to="/purchase-orders/new" className="w-full sm:w-auto text-center bg-gradient-to-r from-teal-600 to-teal-500 text-white px-4 py-2 rounded-md hover:from-teal-500 hover:to-teal-400 transition-colors">
          + New Purchase Order
        </Link>
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by PO # or supplier..." />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center"><Package className="w-5 h-5 text-teal-400" /></div>
            <div><p className="text-2xl font-bold text-white">{totalOrders}</p><p className="text-xs text-zinc-500">Total</p></div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center"><Clock className="w-5 h-5 text-orange-400" /></div>
            <div><p className="text-2xl font-bold text-white">{pendingOrders}</p><p className="text-xs text-zinc-500">Pending</p></div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <p className="text-sm text-zinc-500">Total Value</p>
          <p className="text-lg font-bold text-white">{formatCurrency(totalValue)}</p>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Status</label>
            <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All</option>
              {Object.entries(statusLabels).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Month</label>
            <select value={filter.month} onChange={(e) => setFilter({ ...filter, month: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All</option>
              {months.map((m) => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</option>)}
            </select>
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">No purchase orders found.</div>
      ) : (
        <>
          <div className="hidden md:block bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">PO #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-zinc-800/50">
                    <td className="px-6 py-4 text-sm font-medium text-teal-400">{order.po_number}</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">{formatDate(order.po_date)}</td>
                    <td className="px-6 py-4 text-sm text-zinc-300">{order.supplier_name}</td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${statusLabels[order.status]?.class}`}>{statusLabels[order.status]?.label}</span></td>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-200 text-right">{formatCurrency(order.grand_total)}</td>
                    <td className="px-6 py-4 text-sm"><Link to={`/purchase-orders/${order.id}`} className="text-teal-400 hover:text-teal-300">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            {filteredOrders.map((order) => (
              <Link key={order.id} to={`/purchase-orders/${order.id}`} className="block bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-800/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div><p className="font-medium text-teal-400">{order.po_number}</p><p className="text-xs text-zinc-500">{formatDate(order.po_date)}</p></div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusLabels[order.status]?.class}`}>{statusLabels[order.status]?.label}</span>
                </div>
                <p className="text-zinc-200">{order.supplier_name}</p>
                <div className="flex justify-end mt-2"><span className="font-bold text-zinc-200">{formatCurrency(order.grand_total)}</span></div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
