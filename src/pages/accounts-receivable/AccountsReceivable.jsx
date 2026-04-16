import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { DollarSign, AlertTriangle, Clock, CheckCircle, Printer } from 'lucide-react'
import { SearchInput } from '../../components/SearchInput'
import { useDebounce } from '../../hooks/useDebounce'
import { useStoreSettings } from '../../hooks/useStoreSettings'

export function AccountsReceivable() {
  const { settings: store } = useStoreSettings()
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filter, setFilter] = useState({ status: '', customer: '' })

  useEffect(() => {
    fetchData()
  }, [debouncedSearch])

  const fetchData = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('sales')
        .select('*, payments:sale_payments(*)')
        .in('payment_status', ['unpaid', 'partial'])
        .eq('status', 'completed')
        .order('sale_date', { ascending: false })

      if (debouncedSearch) {
        query = query.or(`invoice_number.ilike.%${debouncedSearch}%,customer_name.ilike.%${debouncedSearch}%`)
      }

      const { data, error } = await query
      if (error) throw error

      const salesWithBalance = (data || []).map((sale) => {
        const totalPaid = (sale.payments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) + parseFloat(sale.amount_paid || 0)
        const balance = parseFloat(sale.grand_total || 0) - totalPaid
        const daysOverdue = Math.floor((new Date() - new Date(sale.sale_date)) / (1000 * 60 * 60 * 24))
        return { ...sale, total_paid: totalPaid, balance: Math.max(0, balance), days_overdue: daysOverdue }
      })

      setSales(salesWithBalance)
    } catch (error) {
      console.error('Error fetching receivables:', error)
      // If sale_payments table doesn't exist, fetch without it
      try {
        let query = supabase
          .from('sales')
          .select('*')
          .in('payment_status', ['unpaid', 'partial'])
          .eq('status', 'completed')
          .order('sale_date', { ascending: false })

        if (debouncedSearch) {
          query = query.or(`invoice_number.ilike.%${debouncedSearch}%,customer_name.ilike.%${debouncedSearch}%`)
        }

        const { data } = await query
        const salesWithBalance = (data || []).map((sale) => {
          const totalPaid = parseFloat(sale.amount_paid || 0)
          const balance = parseFloat(sale.grand_total || 0) - totalPaid
          const daysOverdue = Math.floor((new Date() - new Date(sale.sale_date)) / (1000 * 60 * 60 * 24))
          return { ...sale, total_paid: totalPaid, balance: Math.max(0, balance), days_overdue: daysOverdue, payments: [] }
        })
        setSales(salesWithBalance)
      } catch (err) {
        console.error('Fallback error:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const customers = [...new Set(sales.map((s) => s.customer_name).filter(Boolean))]

  const filteredSales = sales.filter((s) => {
    if (filter.status === 'unpaid' && s.payment_status !== 'unpaid') return false
    if (filter.status === 'partial' && s.payment_status !== 'partial') return false
    if (filter.status === 'overdue' && s.days_overdue <= 30) return false
    if (filter.customer && s.customer_name !== filter.customer) return false
    return true
  })

  const totalOutstanding = filteredSales.reduce((sum, s) => sum + s.balance, 0)
  const totalUnpaid = sales.filter((s) => s.payment_status === 'unpaid').reduce((sum, s) => sum + s.balance, 0)
  const totalPartial = sales.filter((s) => s.payment_status === 'partial').reduce((sum, s) => sum + s.balance, 0)
  const overdueCount = sales.filter((s) => s.days_overdue > 30).length

  const getAgingClass = (days) => {
    if (days > 60) return 'bg-red-900/50 text-red-400'
    if (days > 30) return 'bg-orange-900/50 text-orange-400'
    if (days > 14) return 'bg-yellow-900/50 text-yellow-400'
    return 'bg-green-900/50 text-green-400'
  }

  const getAgingLabel = (days) => {
    if (days > 60) return `${days}d (overdue)`
    if (days > 30) return `${days}d (overdue)`
    if (days > 14) return `${days}d`
    return `${days}d`
  }

  // Customer-wise balance summary
  const customerBalances = (() => {
    const map = {}
    filteredSales.forEach((s) => {
      const name = s.customer_name || 'Walk-in'
      if (!map[name]) map[name] = { name, total: 0, paid: 0, balance: 0, invoices: 0 }
      map[name].total += parseFloat(s.grand_total || 0)
      map[name].paid += s.total_paid
      map[name].balance += s.balance
      map[name].invoices += 1
    })
    return Object.values(map).sort((a, b) => b.balance - a.balance)
  })()

  const handlePrint = () => window.print()

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }

  return (
    <div>
      {/* ══ Printable Report (hidden on screen, visible on print) ══ */}
      <div className="hidden print:block print-area">
        <div style={{ padding: '28px 32px' }}>
          <h1 style={{ fontSize: '18pt', fontWeight: 700, marginBottom: '2px', color: '#111' }}>{store.store_name}</h1>
          {store.address && <p style={{ fontSize: '9pt', color: '#666', whiteSpace: 'pre-wrap', margin: 0 }}>{store.address}</p>}
          {(store.phone || store.email) && <p style={{ fontSize: '9pt', color: '#666', margin: 0 }}>{store.phone && `Tel: ${store.phone}`}{store.phone && store.email && ' | '}{store.email}</p>}
          <h2 style={{ fontSize: '14pt', fontWeight: 600, marginTop: '12px', marginBottom: '4px', color: '#111' }}>Accounts Receivable Report</h2>
          <p style={{ fontSize: '10pt', color: '#666', marginBottom: '20px' }}>
            Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            {filter.customer && ` | Customer: ${filter.customer}`}
          </p>

          {/* Summary */}
          <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', borderBottom: '2px solid #e5e7eb', paddingBottom: '12px' }}>
            <div><p style={{ fontSize: '9pt', color: '#666', textTransform: 'uppercase' }}>Total Outstanding</p><p style={{ fontSize: '16pt', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(totalOutstanding)}</p></div>
            <div><p style={{ fontSize: '9pt', color: '#666', textTransform: 'uppercase' }}>Invoices</p><p style={{ fontSize: '16pt', fontWeight: 700, color: '#111' }}>{filteredSales.length}</p></div>
            <div><p style={{ fontSize: '9pt', color: '#666', textTransform: 'uppercase' }}>Customers</p><p style={{ fontSize: '16pt', fontWeight: 700, color: '#111' }}>{customerBalances.length}</p></div>
          </div>

          {/* Customer Balances Table */}
          <h2 style={{ fontSize: '12pt', fontWeight: 600, marginBottom: '8px', color: '#111' }}>Customer Balances</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '10pt' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #d1d5db' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#666', fontWeight: 600, fontSize: '9pt', textTransform: 'uppercase' }}>Customer</th>
                <th style={{ textAlign: 'center', padding: '6px 8px', color: '#666', fontWeight: 600, fontSize: '9pt', textTransform: 'uppercase' }}>Invoices</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#666', fontWeight: 600, fontSize: '9pt', textTransform: 'uppercase' }}>Total</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#666', fontWeight: 600, fontSize: '9pt', textTransform: 'uppercase' }}>Paid</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#666', fontWeight: 600, fontSize: '9pt', textTransform: 'uppercase' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {customerBalances.map((c) => (
                <tr key={c.name} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px', fontWeight: 500, color: '#111' }}>{c.name}</td>
                  <td style={{ padding: '8px', textAlign: 'center', color: '#666' }}>{c.invoices}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#374151' }}>{formatCurrency(c.total)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#16a34a' }}>{formatCurrency(c.paid)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(c.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #111' }}>
                <td style={{ padding: '8px', fontWeight: 700, color: '#111' }}>Total</td>
                <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600, color: '#111' }}>{filteredSales.length}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#111' }}>{formatCurrency(customerBalances.reduce((s, c) => s + c.total, 0))}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{formatCurrency(customerBalances.reduce((s, c) => s + c.paid, 0))}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(totalOutstanding)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Invoice Details */}
          <h2 style={{ fontSize: '12pt', fontWeight: 600, marginBottom: '8px', color: '#111' }}>Invoice Details</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #d1d5db' }}>
                <th style={{ textAlign: 'left', padding: '5px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>Invoice</th>
                <th style={{ textAlign: 'left', padding: '5px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '5px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>Customer</th>
                <th style={{ textAlign: 'left', padding: '5px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '5px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>Age</th>
                <th style={{ textAlign: 'right', padding: '5px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>Total</th>
                <th style={{ textAlign: 'right', padding: '5px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>Paid</th>
                <th style={{ textAlign: 'right', padding: '5px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale) => (
                <tr key={sale.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '6px', color: '#111', fontWeight: 500 }}>{sale.invoice_number}</td>
                  <td style={{ padding: '6px', color: '#666' }}>{formatDate(sale.sale_date)}</td>
                  <td style={{ padding: '6px', color: '#374151' }}>{sale.customer_name || 'Walk-in'}</td>
                  <td style={{ padding: '6px', color: sale.payment_status === 'unpaid' ? '#dc2626' : '#ca8a04' }}>{sale.payment_status === 'unpaid' ? 'Unpaid' : 'Partial'}</td>
                  <td style={{ padding: '6px', color: sale.days_overdue > 30 ? '#dc2626' : '#666' }}>{sale.days_overdue}d</td>
                  <td style={{ padding: '6px', textAlign: 'right', color: '#374151' }}>{formatCurrency(sale.grand_total)}</td>
                  <td style={{ padding: '6px', textAlign: 'right', color: '#16a34a' }}>{formatCurrency(sale.total_paid)}</td>
                  <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(sale.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ Screen UI ══ */}
      <div className="print:hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Accounts Receivable</h1>
        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700 transition-colors">
          <Printer className="w-4 h-4" /> Print Report
        </button>
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by invoice # or customer..." />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Outstanding</p>
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
              <CheckCircle className="w-5 h-5 text-yellow-400" />
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
            <label className="block text-sm font-medium text-zinc-300 mb-1">Customer</label>
            <select value={filter.customer} onChange={(e) => setFilter({ ...filter, customer: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All Customers</option>
              {customers.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Customer Balances Summary */}
      {customers.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-medium text-zinc-400 uppercase mb-3">Customer Balances</h3>
          <div className="flex flex-wrap gap-3">
            {customers.map((customer) => {
              const customerBalance = sales
                .filter((s) => s.customer_name === customer)
                .reduce((sum, s) => sum + s.balance, 0)
              if (customerBalance <= 0) return null
              return (
                <button
                  key={customer}
                  onClick={() => setFilter({ ...filter, customer: filter.customer === customer ? '' : customer })}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                    filter.customer === customer
                      ? 'bg-teal-600/20 border-teal-500/30 text-teal-400'
                      : 'bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  <span className="font-medium">{customer}</span>
                  <span className="ml-2 text-red-400 font-bold">{formatCurrency(customerBalance)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {filteredSales.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
          No outstanding receivables. All invoices are paid!
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Invoice</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Age</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Paid</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-zinc-800/50">
                    <td className="px-6 py-4">
                      <Link to={`/sales/${sale.id}`} className="text-sm font-medium text-teal-400 hover:text-teal-300">
                        {sale.invoice_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400">{formatDate(sale.sale_date)}</td>
                    <td className="px-6 py-4 text-sm text-zinc-300">{sale.customer_name || 'Walk-in'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        sale.payment_status === 'unpaid' ? 'bg-red-900/50 text-red-400' : 'bg-yellow-900/50 text-yellow-400'
                      }`}>
                        {sale.payment_status === 'unpaid' ? 'Unpaid' : 'Partial'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAgingClass(sale.days_overdue)}`}>
                        {getAgingLabel(sale.days_overdue)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-200 text-right">{formatCurrency(sale.grand_total)}</td>
                    <td className="px-6 py-4 text-sm text-green-400 text-right">{formatCurrency(sale.total_paid)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-red-400 text-right">{formatCurrency(sale.balance)}</td>
                    <td className="px-6 py-4 text-sm">
                      <Link to={`/accounts-receivable/${sale.id}/collect`} className="text-teal-400 hover:text-teal-300">
                        Collect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-zinc-800/30">
                <tr>
                  <td colSpan={5} className="px-6 py-3 text-sm font-medium text-zinc-300">
                    Total ({filteredSales.length} invoices)
                  </td>
                  <td className="px-6 py-3 text-sm font-bold text-white text-right">
                    {formatCurrency(filteredSales.reduce((s, sale) => s + parseFloat(sale.grand_total || 0), 0))}
                  </td>
                  <td className="px-6 py-3 text-sm font-bold text-green-400 text-right">
                    {formatCurrency(filteredSales.reduce((s, sale) => s + sale.total_paid, 0))}
                  </td>
                  <td className="px-6 py-3 text-sm font-bold text-red-400 text-right">
                    {formatCurrency(filteredSales.reduce((s, sale) => s + sale.balance, 0))}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {filteredSales.map((sale) => (
              <div key={sale.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <Link to={`/sales/${sale.id}`} className="font-medium text-teal-400">{sale.invoice_number}</Link>
                    <p className="text-xs text-zinc-500">{formatDate(sale.sale_date)}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      sale.payment_status === 'unpaid' ? 'bg-red-900/50 text-red-400' : 'bg-yellow-900/50 text-yellow-400'
                    }`}>
                      {sale.payment_status === 'unpaid' ? 'Unpaid' : 'Partial'}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getAgingClass(sale.days_overdue)}`}>
                      {sale.days_overdue}d
                    </span>
                  </div>
                </div>
                <p className="text-sm text-zinc-300 mb-3">{sale.customer_name || 'Walk-in'}</p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div><p className="text-xs text-zinc-500">Total</p><p className="text-sm text-white">{formatCurrency(sale.grand_total)}</p></div>
                  <div><p className="text-xs text-zinc-500">Paid</p><p className="text-sm text-green-400">{formatCurrency(sale.total_paid)}</p></div>
                  <div><p className="text-xs text-zinc-500">Balance</p><p className="text-sm font-bold text-red-400">{formatCurrency(sale.balance)}</p></div>
                </div>
                <Link to={`/accounts-receivable/${sale.id}/collect`} className="block w-full text-center py-2 bg-teal-600/20 border border-teal-500/30 rounded-lg text-sm text-teal-400 hover:bg-teal-600/30 transition-colors">
                  Collect Payment
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
      </div>
    </div>
  )
}
