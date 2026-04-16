import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ShoppingCart, Clock, CheckCircle, Printer } from 'lucide-react'
import { SearchInput } from '../../components/SearchInput'
import { useDebounce } from '../../hooks/useDebounce'
import { useStoreSettings } from '../../hooks/useStoreSettings'

export function SalesList() {
  const { settings: store } = useStoreSettings()
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filter, setFilter] = useState({ status: '', payment: '', month: '', createdBy: '' })
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [filterOptions, setFilterOptions] = useState({ months: [], salespeople: [] })
  const [stats, setStats] = useState({ revenue: 0, total: 0, unpaid: 0 })
  const PAGE_SIZE = 20

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, filter.status, filter.payment, filter.month, filter.createdBy])

  useEffect(() => {
    fetchSales()
  }, [debouncedSearch, page, filter.status, filter.payment, filter.month, filter.createdBy])

  useEffect(() => {
    fetchFilterOptions()
  }, [])

  const fetchFilterOptions = async () => {
    // Fetch distinct months and salespeople for filter dropdowns
    const { data: allSales } = await supabase
      .from('sales')
      .select('sale_date, created_by_email, salesperson_name')

    if (allSales) {
      const months = [...new Set(allSales.map((s) => s.sale_date?.substring(0, 7)).filter(Boolean))].sort().reverse()
      // Build a unique list of display names (salesperson_name takes priority, fall back to email prefix)
      const nameSet = new Set()
      allSales.forEach((s) => {
        const name = s.salesperson_name || s.created_by_email?.split('@')[0]
        if (name) nameSet.add(name)
      })
      setFilterOptions({ months, salespeople: [...nameSet].sort() })
    }
  }

  const fetchSales = async () => {
    try {
      setLoading(true)

      // Build filtered query
      let query = supabase.from('sales').select('*', { count: 'exact' }).order('created_at', { ascending: false })

      if (debouncedSearch) {
        query = query.or(`invoice_number.ilike.%${debouncedSearch}%,customer_name.ilike.%${debouncedSearch}%`)
      }
      if (filter.status) query = query.eq('status', filter.status)
      if (filter.payment) query = query.eq('payment_status', filter.payment)
      if (filter.createdBy) query = query.or(`salesperson_name.eq.${filter.createdBy},and(salesperson_name.is.null,created_by_email.ilike.${filter.createdBy}@%)`)
      if (filter.month) {
        const [y, m] = filter.month.split('-')
        const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate()
        query = query.gte('sale_date', `${filter.month}-01`).lte('sale_date', `${filter.month}-${String(lastDay).padStart(2, '0')}`)
      }

      // Paginate
      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      const { data, error, count } = await query
      if (error) throw error
      setSales(data || [])
      setTotalCount(count || 0)

      // Calculate stats from this filtered set (need a separate count query without pagination)
      let statsQuery = supabase.from('sales').select('grand_total, status, payment_status')
      if (debouncedSearch) statsQuery = statsQuery.or(`invoice_number.ilike.%${debouncedSearch}%,customer_name.ilike.%${debouncedSearch}%`)
      if (filter.status) statsQuery = statsQuery.eq('status', filter.status)
      if (filter.payment) statsQuery = statsQuery.eq('payment_status', filter.payment)
      if (filter.createdBy) statsQuery = statsQuery.or(`salesperson_name.eq.${filter.createdBy},and(salesperson_name.is.null,created_by_email.ilike.${filter.createdBy}@%)`)
      if (filter.month) {
        const [y, m] = filter.month.split('-')
        const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate()
        statsQuery = statsQuery.gte('sale_date', `${filter.month}-01`).lte('sale_date', `${filter.month}-${String(lastDay).padStart(2, '0')}`)
      }

      const { data: statsData } = await statsQuery
      if (statsData) {
        setStats({
          revenue: statsData.filter((s) => s.status === 'completed').reduce((sum, s) => sum + parseFloat(s.grand_total || 0), 0),
          total: statsData.length,
          unpaid: statsData.filter((s) => s.payment_status === 'unpaid' || s.payment_status === 'partial').length,
        })
      }
    } catch (error) {
      console.error('Error fetching sales:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const formatCurrency = (amount) => `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  const statusLabels = {
    completed: { label: 'Completed', class: 'bg-green-900/50 text-green-400' },
    returned: { label: 'Returned', class: 'bg-orange-900/50 text-orange-400' },
    cancelled: { label: 'Cancelled', class: 'bg-red-900/50 text-red-400' },
  }

  const paymentLabels = {
    cash: 'Cash', card: 'Card', bank_transfer: 'Bank Transfer', credit: 'Credit',
  }

  const paymentStatusLabels = {
    paid: { label: 'Paid', class: 'bg-green-900/50 text-green-400' },
    partial: { label: 'Partial', class: 'bg-yellow-900/50 text-yellow-400' },
    unpaid: { label: 'Unpaid', class: 'bg-red-900/50 text-red-400' },
  }

  const totalRevenue = stats.revenue
  const totalSales = stats.total
  const unpaidCount = stats.unpaid

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }

  const formatDateShort = (date) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const activeFilters = [
    filter.status && `Status: ${filter.status}`,
    filter.payment && `Payment: ${filter.payment}`,
    filter.month && `Month: ${new Date(filter.month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`,
    filter.createdBy && `Sold by: ${filter.createdBy}`,
    debouncedSearch && `Search: "${debouncedSearch}"`,
  ].filter(Boolean)

  return (
    <div>
      {/* ══ Printable Report ══ */}
      <div className="hidden print:block print-area">
        <div style={{ padding: '28px 32px' }}>
          <h1 style={{ fontSize: '18pt', fontWeight: 700, marginBottom: '2px', color: '#111' }}>{store.store_name}</h1>
          {store.address && <p style={{ fontSize: '9pt', color: '#666', whiteSpace: 'pre-wrap', margin: 0 }}>{store.address}</p>}
          {(store.phone || store.email) && <p style={{ fontSize: '9pt', color: '#666', margin: 0 }}>{store.phone && `Tel: ${store.phone}`}{store.phone && store.email && ' | '}{store.email}</p>}

          <h2 style={{ fontSize: '14pt', fontWeight: 600, marginTop: '12px', marginBottom: '4px', color: '#111' }}>Sales Report</h2>
          <p style={{ fontSize: '10pt', color: '#666', marginBottom: activeFilters.length ? '4px' : '20px' }}>
            Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          {activeFilters.length > 0 && (
            <p style={{ fontSize: '9pt', color: '#666', marginBottom: '20px' }}>{activeFilters.join(' · ')}</p>
          )}

          {/* Summary */}
          <div style={{ display: 'flex', gap: '32px', marginBottom: '24px', borderBottom: '2px solid #e5e7eb', paddingBottom: '12px' }}>
            <div>
              <p style={{ fontSize: '9pt', color: '#666', textTransform: 'uppercase', margin: 0 }}>Total Sales</p>
              <p style={{ fontSize: '16pt', fontWeight: 700, color: '#111', margin: 0 }}>{stats.total}</p>
            </div>
            <div>
              <p style={{ fontSize: '9pt', color: '#666', textTransform: 'uppercase', margin: 0 }}>Revenue</p>
              <p style={{ fontSize: '16pt', fontWeight: 700, color: '#111', margin: 0 }}>{formatCurrency(stats.revenue)}</p>
            </div>
            <div>
              <p style={{ fontSize: '9pt', color: '#666', textTransform: 'uppercase', margin: 0 }}>Unpaid / Partial</p>
              <p style={{ fontSize: '16pt', fontWeight: 700, color: '#dc2626', margin: 0 }}>{stats.unpaid}</p>
            </div>
          </div>

          {/* Sales Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #d1d5db' }}>
                <th style={{ textAlign: 'left', padding: '5px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>Invoice</th>
                <th style={{ textAlign: 'left', padding: '5px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '5px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>Customer</th>
                <th style={{ textAlign: 'left', padding: '5px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>Sold By</th>
                <th style={{ textAlign: 'left', padding: '5px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>Payment</th>
                <th style={{ textAlign: 'left', padding: '5px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '5px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '6px', color: '#111', fontWeight: 500 }}>{sale.invoice_number}</td>
                  <td style={{ padding: '6px', color: '#666' }}>{formatDateShort(sale.sale_date)}</td>
                  <td style={{ padding: '6px', color: '#374151' }}>{sale.customer_name || 'Walk-in'}</td>
                  <td style={{ padding: '6px', color: '#374151' }}>{sale.salesperson_name || (sale.created_by_email ? sale.created_by_email.split('@')[0] : '-')}</td>
                  <td style={{ padding: '6px', color: '#374151' }}>{paymentLabels[sale.payment_method] || '-'}</td>
                  <td style={{ padding: '6px', color: sale.status === 'completed' ? '#16a34a' : sale.status === 'returned' ? '#ea580c' : '#dc2626' }}>
                    {statusLabels[sale.status]?.label || sale.status}
                  </td>
                  <td style={{ padding: '6px', textAlign: 'right', fontWeight: 600, color: '#111' }}>{formatCurrency(sale.grand_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #111' }}>
                <td colSpan={6} style={{ padding: '8px 6px', fontWeight: 700, color: '#111' }}>Total ({sales.length} invoices)</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: '#111' }}>{formatCurrency(sales.reduce((s, sale) => s + parseFloat(sale.grand_total || 0), 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ══ Screen UI ══ */}
      <div className="print:hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Sales</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700 transition-colors">
            <Printer className="w-4 h-4" /> Print Report
          </button>
          <Link to="/sales/new" className="flex-1 sm:flex-none text-center bg-gradient-to-r from-teal-600 to-teal-500 text-white px-4 py-2 rounded-md hover:from-teal-500 hover:to-teal-400 transition-colors">
            + New Sale
          </Link>
        </div>
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by invoice # or customer..." />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalSales}</p>
              <p className="text-xs text-zinc-500">Total Sales</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <p className="text-sm text-zinc-500">Revenue</p>
          <p className="text-lg font-bold text-white">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{unpaidCount}</p>
              <p className="text-xs text-zinc-500">Unpaid</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Status</label>
            <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="returned">Returned</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Payment</label>
            <select value={filter.payment} onChange={(e) => setFilter({ ...filter, payment: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Month</label>
            <select value={filter.month} onChange={(e) => setFilter({ ...filter, month: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All</option>
              {filterOptions.months.map((m) => (
                <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Sold By</label>
            <select value={filter.createdBy} onChange={(e) => setFilter({ ...filter, createdBy: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All</option>
              {filterOptions.salespeople.map((sp) => (
                <option key={sp} value={sp}>{sp}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {sales.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
          No sales found. Create your first sale!
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Invoice</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Sold By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-zinc-800/50">
                    <td className="px-6 py-4 text-sm font-medium text-teal-400">{sale.invoice_number}</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">{formatDate(sale.sale_date)}</td>
                    <td className="px-6 py-4 text-sm text-zinc-300">{sale.customer_name || 'Walk-in'}</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">{sale.salesperson_name || (sale.created_by_email ? sale.created_by_email.split('@')[0] : '-')}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-400">{paymentLabels[sale.payment_method]}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full w-fit ${paymentStatusLabels[sale.payment_status]?.class}`}>
                          {paymentStatusLabels[sale.payment_status]?.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusLabels[sale.status]?.class}`}>
                        {statusLabels[sale.status]?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-200 text-right">{formatCurrency(sale.grand_total)}</td>
                    <td className="px-6 py-4 text-sm">
                      <Link to={`/sales/${sale.id}`} className="text-teal-400 hover:text-teal-300">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            {sales.map((sale) => (
              <Link key={sale.id} to={`/sales/${sale.id}`} className="block bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-800/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-teal-400">{sale.invoice_number}</p>
                    <p className="text-xs text-zinc-500">{formatDate(sale.sale_date)}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusLabels[sale.status]?.class}`}>
                    {statusLabels[sale.status]?.label}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-zinc-200">{sale.customer_name || 'Walk-in'}</p>
                  {(sale.salesperson_name || sale.created_by_email) && <span className="text-xs text-zinc-500">{sale.salesperson_name || sale.created_by_email.split('@')[0]}</span>}
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${paymentStatusLabels[sale.payment_status]?.class}`}>
                    {paymentStatusLabels[sale.payment_status]?.label}
                  </span>
                  <span className="font-bold text-zinc-200">{formatCurrency(sale.grand_total)}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalCount > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-zinc-500">
                Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-sm text-zinc-400">
                  Page {page + 1} of {Math.ceil(totalCount / PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={(page + 1) * PAGE_SIZE >= totalCount}
                  className="px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  )
}
