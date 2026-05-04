import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { DollarSign, AlertTriangle, Clock, Building2 } from 'lucide-react'
import { SearchInput } from '../../components/SearchInput'
import { useDebounce } from '../../hooks/useDebounce'

export function AccountsPayable() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filter, setFilter] = useState({ status: '', supplier: '' })

  useEffect(() => {
    fetchData()
  }, [debouncedSearch])

  const fetchData = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('purchase_orders')
        .select('*, payments:po_payments(*)')
        .in('payment_status', ['unpaid', 'partial'])
        .neq('status', 'cancelled')
        .order('po_date', { ascending: false })

      if (debouncedSearch) {
        query = query.or(`po_number.ilike.%${debouncedSearch}%,supplier_name.ilike.%${debouncedSearch}%`)
      }

      const { data, error } = await query
      if (error) throw error

      const ordersWithBalance = (data || []).map((po) => {
        const totalPaid = (po.payments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) + parseFloat(po.amount_paid || 0)
        const balance = parseFloat(po.grand_total || 0) - totalPaid
        const daysSince = Math.floor((new Date() - new Date(po.po_date)) / (1000 * 60 * 60 * 24))
        return { ...po, total_paid: totalPaid, balance: Math.max(0, balance), days_since: daysSince }
      })

      setOrders(ordersWithBalance)
    } catch (error) {
      console.error('Error fetching payables:', error)
      // Fallback if po_payments table doesn't exist yet
      try {
        let query = supabase
          .from('purchase_orders')
          .select('*')
          .neq('status', 'cancelled')
          .order('po_date', { ascending: false })

        if (debouncedSearch) {
          query = query.or(`po_number.ilike.%${debouncedSearch}%,supplier_name.ilike.%${debouncedSearch}%`)
        }

        const { data } = await query

        // Filter to unpaid/partial only — payment_status may not exist yet
        const ordersWithBalance = (data || []).filter((po) => {
          const status = po.payment_status || 'unpaid'
          return status === 'unpaid' || status === 'partial'
        }).map((po) => {
          const totalPaid = parseFloat(po.amount_paid || 0)
          const balance = parseFloat(po.grand_total || 0) - totalPaid
          const daysSince = Math.floor((new Date() - new Date(po.po_date)) / (1000 * 60 * 60 * 24))
          return { ...po, total_paid: totalPaid, balance: Math.max(0, balance), days_since: daysSince, payments: [] }
        })
        setOrders(ordersWithBalance)
      } catch (err) {
        console.error('Fallback error:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const suppliers = [...new Set(orders.map((o) => o.supplier_name).filter(Boolean))]

  const filteredOrders = orders.filter((o) => {
    if (filter.status === 'unpaid' && o.payment_status !== 'unpaid') return false
    if (filter.status === 'partial' && o.payment_status !== 'partial') return false
    if (filter.status === 'overdue' && o.days_since <= 30) return false
    if (filter.supplier && o.supplier_name !== filter.supplier) return false
    return true
  })

  const totalOutstanding = filteredOrders.reduce((sum, o) => sum + o.balance, 0)
  const totalUnpaid = orders.filter((o) => (o.payment_status || 'unpaid') === 'unpaid').reduce((sum, o) => sum + o.balance, 0)
  const totalPartial = orders.filter((o) => o.payment_status === 'partial').reduce((sum, o) => sum + o.balance, 0)
  const overdueCount = orders.filter((o) => o.days_since > 30).length

  const getAgingClass = (days) => {
    if (days > 60) return 'bg-red-900/50 text-red-400'
    if (days > 30) return 'bg-orange-900/50 text-orange-400'
    if (days > 14) return 'bg-yellow-900/50 text-yellow-400'
    return 'bg-green-900/50 text-green-400'
  }

  const statusLabels = {
    draft: 'Draft', sent: 'Sent', confirmed: 'Confirmed', received: 'Received',
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Accounts Payable</h1>
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by PO # or supplier..." />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Payable</p>
              <p className="text-lg font-bold text-red-400">{formatCurrency(totalOutstanding)}</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Unpaid</p>
              <p className="text-lg font-bold text-orange-400">{formatCurrency(totalUnpaid)}</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Partial</p>
              <p className="text-lg font-bold text-yellow-400">{formatCurrency(totalPartial)}</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Overdue (30d+)</p>
              <p className="text-lg font-bold text-red-400">{overdueCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Status</label>
            <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="overdue">Overdue (30d+)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Supplier</label>
            <select value={filter.supplier} onChange={(e) => setFilter({ ...filter, supplier: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All Suppliers</option>
              {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Supplier Balances */}
      {suppliers.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-medium text-zinc-400 uppercase mb-3">Supplier Balances</h3>
          <div className="flex flex-wrap gap-3">
            {suppliers.map((supplier) => {
              const supplierBalance = orders
                .filter((o) => o.supplier_name === supplier)
                .reduce((sum, o) => sum + o.balance, 0)
              if (supplierBalance <= 0) return null
              return (
                <button
                  key={supplier}
                  onClick={() => setFilter({ ...filter, supplier: filter.supplier === supplier ? '' : supplier })}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                    filter.supplier === supplier
                      ? 'bg-teal-600/20 border-teal-500/30 text-teal-400'
                      : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <span className="font-medium">{supplier}</span>
                  <span className="ml-2 text-red-400 font-bold">{formatCurrency(supplierBalance)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
          No outstanding payables. All suppliers are paid!
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">PO #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">PO Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Age</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Paid</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-zinc-800/50">
                    <td className="px-6 py-4">
                      <Link to={`/purchase-orders/${po.id}`} className="text-sm font-medium text-teal-400 hover:text-teal-300">
                        {po.po_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400">{formatDate(po.po_date)}</td>
                    <td className="px-6 py-4 text-sm text-zinc-300">{po.supplier_name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-zinc-800 text-zinc-300">
                        {statusLabels[po.status] || po.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAgingClass(po.days_since)}`}>
                        {po.days_since}d
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-200 text-right">{formatCurrency(po.grand_total)}</td>
                    <td className="px-6 py-4 text-sm text-green-400 text-right">{formatCurrency(po.total_paid)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-red-400 text-right">{formatCurrency(po.balance)}</td>
                    <td className="px-6 py-4 text-sm">
                      <Link to={`/accounts-payable/${po.id}/pay`} className="text-teal-400 hover:text-teal-300">Pay</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-zinc-800/30">
                <tr>
                  <td colSpan={5} className="px-6 py-3 text-sm font-medium text-zinc-300">Total ({filteredOrders.length} orders)</td>
                  <td className="px-6 py-3 text-sm font-bold text-white text-right">{formatCurrency(filteredOrders.reduce((s, o) => s + parseFloat(o.grand_total || 0), 0))}</td>
                  <td className="px-6 py-3 text-sm font-bold text-green-400 text-right">{formatCurrency(filteredOrders.reduce((s, o) => s + o.total_paid, 0))}</td>
                  <td className="px-6 py-3 text-sm font-bold text-red-400 text-right">{formatCurrency(filteredOrders.reduce((s, o) => s + o.balance, 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {filteredOrders.map((po) => (
              <div key={po.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <Link to={`/purchase-orders/${po.id}`} className="font-medium text-teal-400">{po.po_number}</Link>
                    <p className="text-xs text-zinc-500">{formatDate(po.po_date)}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getAgingClass(po.days_since)}`}>
                    {po.days_since}d
                  </span>
                </div>
                <p className="text-sm text-zinc-300 mb-3">{po.supplier_name}</p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div><p className="text-xs text-zinc-500">Total</p><p className="text-sm text-white">{formatCurrency(po.grand_total)}</p></div>
                  <div><p className="text-xs text-zinc-500">Paid</p><p className="text-sm text-green-400">{formatCurrency(po.total_paid)}</p></div>
                  <div><p className="text-xs text-zinc-500">Balance</p><p className="text-sm font-bold text-red-400">{formatCurrency(po.balance)}</p></div>
                </div>
                <Link to={`/accounts-payable/${po.id}/pay`} className="block w-full text-center py-2 bg-teal-600/20 border border-teal-500/30 rounded-lg text-sm text-teal-400 hover:bg-teal-600/30 transition-colors">
                  Make Payment
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
