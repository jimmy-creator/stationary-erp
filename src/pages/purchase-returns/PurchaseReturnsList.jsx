import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Undo2, ChevronLeft, ChevronRight } from 'lucide-react'
import { SearchInput } from '../../components/SearchInput'
import { useDebounce } from '../../hooks/useDebounce'

const PAGE_SIZE = 20

export function PurchaseReturnsList() {
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filter, setFilter] = useState({ status: '', refund: '', month: '' })
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [months, setMonths] = useState([])
  const [stats, setStats] = useState({ total: 0, totalValue: 0, totalRefunded: 0 })

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, filter.status, filter.refund, filter.month])

  useEffect(() => {
    fetchMonths()
  }, [])

  useEffect(() => {
    fetchReturns()
    fetchStats()
  }, [page, debouncedSearch, filter.status, filter.refund, filter.month])

  const applyFilters = (query) => {
    if (debouncedSearch) {
      query = query.or(`return_number.ilike.%${debouncedSearch}%,supplier_name.ilike.%${debouncedSearch}%`)
    }
    if (filter.status) query = query.eq('status', filter.status)
    if (filter.refund) query = query.eq('refund_status', filter.refund)
    if (filter.month) {
      const [year, month] = filter.month.split('-')
      const startDate = `${year}-${month}-01`
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
      query = query.gte('return_date', startDate).lte('return_date', endDate)
    }
    return query
  }

  const fetchMonths = async () => {
    const { data } = await supabase
      .from('purchase_returns')
      .select('return_date')
      .not('return_date', 'is', null)
      .order('return_date', { ascending: false })
    const uniqueMonths = [...new Set((data || []).map((o) => o.return_date?.substring(0, 7)).filter(Boolean))].sort().reverse()
    setMonths(uniqueMonths)
  }

  const fetchReturns = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('purchase_returns')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })

      query = applyFilters(query)
      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      const { data, error, count } = await query
      if (error) throw error
      setReturns(data || [])
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error fetching purchase returns:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      let query = supabase.from('purchase_returns').select('status, grand_total, amount_refunded')
      query = applyFilters(query)
      const { data } = await query
      const all = data || []
      const completed = all.filter((r) => r.status === 'completed')
      setStats({
        total: all.length,
        totalValue: completed.reduce((sum, r) => sum + parseFloat(r.grand_total || 0), 0),
        totalRefunded: completed.reduce((sum, r) => sum + parseFloat(r.amount_refunded || 0), 0),
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'
  const formatCurrency = (amount) => `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  const statusLabels = {
    completed: { label: 'Completed', class: 'bg-green-900/50 text-green-400' },
    cancelled: { label: 'Cancelled', class: 'bg-red-900/50 text-red-400' },
  }
  const refundLabels = {
    refunded: { label: 'Refunded', class: 'bg-green-900/50 text-green-400' },
    pending: { label: 'Pending', class: 'bg-yellow-900/50 text-yellow-400' },
  }
  const refundMethodLabels = { cash: 'Cash', bank_transfer: 'Bank Transfer', debit_note: 'Debit Note' }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const rangeStart = totalCount === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, totalCount)

  if (loading && returns.length === 0) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Purchase Returns</h1>
        <Link to="/purchase-returns/new" className="w-full sm:w-auto text-center bg-gradient-to-r from-teal-600 to-teal-500 text-white px-4 py-2 rounded-md hover:from-teal-500 hover:to-teal-400 transition-colors">
          + New Return
        </Link>
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by return # or supplier..." />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center"><Undo2 className="w-5 h-5 text-orange-400" /></div>
            <div><p className="text-2xl font-bold text-white">{stats.total}</p><p className="text-xs text-zinc-500">Total Returns</p></div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <p className="text-sm text-zinc-500">Returned Value</p>
          <p className="text-lg font-bold text-white">{formatCurrency(stats.totalValue)}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <p className="text-sm text-zinc-500">Refunded</p>
          <p className="text-lg font-bold text-white">{formatCurrency(stats.totalRefunded)}</p>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Status</label>
            <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All</option>
              {Object.entries(statusLabels).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Refund</label>
            <select value={filter.refund} onChange={(e) => setFilter({ ...filter, refund: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All</option>
              <option value="refunded">Refunded</option>
              <option value="pending">Pending</option>
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

      {returns.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">No purchase returns found.</div>
      ) : (
        <>
          <div className="hidden md:block bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Return #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Refund</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-800/50">
                    <td className="px-6 py-4 text-sm font-medium text-teal-400">{r.return_number}</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">{formatDate(r.return_date)}</td>
                    <td className="px-6 py-4 text-sm text-zinc-300">{r.supplier_name}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-400">{refundMethodLabels[r.refund_method]}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full w-fit ${refundLabels[r.refund_status]?.class}`}>
                          {refundLabels[r.refund_status]?.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${statusLabels[r.status]?.class}`}>{statusLabels[r.status]?.label}</span></td>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-200 text-right">{formatCurrency(r.grand_total)}</td>
                    <td className="px-6 py-4 text-sm"><Link to={`/purchase-returns/${r.id}`} className="text-teal-400 hover:text-teal-300">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            {returns.map((r) => (
              <Link key={r.id} to={`/purchase-returns/${r.id}`} className="block bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-800/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div><p className="font-medium text-teal-400">{r.return_number}</p><p className="text-xs text-zinc-500">{formatDate(r.return_date)}</p></div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusLabels[r.status]?.class}`}>{statusLabels[r.status]?.label}</span>
                </div>
                <p className="text-zinc-200">{r.supplier_name}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${refundLabels[r.refund_status]?.class}`}>
                    {refundLabels[r.refund_status]?.label}
                  </span>
                  <span className="font-bold text-zinc-200">{formatCurrency(r.grand_total)}</span>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
              <p className="text-sm text-zinc-500">Showing {rangeStart}-{rangeEnd} of {totalCount}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <span className="text-sm text-zinc-400 px-2">Page {page + 1} of {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
