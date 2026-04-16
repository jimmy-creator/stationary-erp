import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Banknote, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function CashAccounts() {
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('sales') // 'sales' | 'purchases'
  const [period, setPeriod] = useState('month') // 'month' | 'range' | 'all'
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7))
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  })

  const [cashSales, setCashSales] = useState([])
  const [cashPurchases, setCashPurchases] = useState([])

  useEffect(() => { fetchData() }, [period, selectedMonth, dateRange.from, dateRange.to])

  const getRange = () => {
    if (period === 'month') {
      const [y, m] = selectedMonth.split('-')
      const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate()
      return { from: `${selectedMonth}-01`, to: `${selectedMonth}-${String(lastDay).padStart(2, '0')}` }
    }
    if (period === 'range') return dateRange
    return { from: '2000-01-01', to: '2099-12-31' }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const { from, to } = getRange()

      // Fetch cash sales and cash PO payments independently so one failure doesn't blank both
      const salesRes = await supabase
        .from('sales')
        .select('id, invoice_number, customer_name, grand_total, amount_paid, sale_date, payment_status, created_by_email')
        .eq('payment_method', 'cash')
        .eq('status', 'completed')
        .gte('sale_date', from)
        .lte('sale_date', to)
        .order('sale_date', { ascending: false })

      if (salesRes.error) console.error('Cash sales error:', salesRes.error)
      setCashSales(salesRes.data || [])

      const poRes = await supabase
        .from('po_payments')
        .select('id, po_id, amount, payment_date, reference, purchase_orders!po_id(po_number, supplier_name)')
        .eq('payment_method', 'cash')
        .gte('payment_date', from)
        .lte('payment_date', to)
        .order('payment_date', { ascending: false })

      if (poRes.error) console.error('Cash purchases error:', poRes.error)
      setCashPurchases(poRes.data || [])
    } catch (err) {
      console.error('fetchData error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fmt = (n) => `QAR ${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  const fmtDate = (d) => {
    const dt = new Date(d)
    return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`
  }

  // ── Sales stats
  const totalCashSales = cashSales.reduce((s, x) => s + parseFloat(x.amount_paid || 0), 0)
  const totalCashSalesRevenue = cashSales.reduce((s, x) => s + parseFloat(x.grand_total || 0), 0)
  const unpaidCashSales = cashSales.filter((x) => x.payment_status !== 'paid').length

  // Monthly breakdown for sales
  const salesByMonth = cashSales.reduce((acc, s) => {
    const key = s.sale_date?.substring(0, 7)
    if (!key) return acc
    if (!acc[key]) acc[key] = { month: key, count: 0, total: 0, received: 0 }
    acc[key].count++
    acc[key].total += parseFloat(s.grand_total || 0)
    acc[key].received += parseFloat(s.amount_paid || 0)
    return acc
  }, {})
  const salesMonthRows = Object.values(salesByMonth).sort((a, b) => b.month.localeCompare(a.month))

  // ── Purchase stats
  const totalCashPurchases = cashPurchases.reduce((s, x) => s + parseFloat(x.amount || 0), 0)

  // Monthly breakdown for purchases
  const purchasesByMonth = cashPurchases.reduce((acc, p) => {
    const key = p.payment_date?.substring(0, 7)
    if (!key) return acc
    if (!acc[key]) acc[key] = { month: key, count: 0, total: 0 }
    acc[key].count++
    acc[key].total += parseFloat(p.amount || 0)
    return acc
  }, {})
  const purchaseMonthRows = Object.values(purchasesByMonth).sort((a, b) => b.month.localeCompare(a.month))

  const fmtMonth = (m) => new Date(m + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })

  const periodLabel = period === 'month'
    ? fmtMonth(selectedMonth)
    : period === 'range'
    ? `${dateRange.from} to ${dateRange.to}`
    : 'All Time'

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Cash Accounts</h1>
        <div className="flex gap-2">
          {['month', 'range', 'all'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p ? 'bg-teal-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
            >
              {p === 'month' ? 'Month' : p === 'range' ? 'Range' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Period Picker */}
      {period === 'month' && (
        <div className="flex items-center gap-3 mb-6">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-zinc-800/50 border border-zinc-700 rounded-lg text-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <span className="text-zinc-500 text-sm">{fmtMonth(selectedMonth)}</span>
        </div>
      )}
      {period === 'range' && (
        <div className="flex items-center gap-3 mb-6">
          <input type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} className="bg-zinc-800/50 border border-zinc-700 rounded-lg text-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          <span className="text-zinc-500">to</span>
          <input type="date" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} className="bg-zinc-800/50 border border-zinc-700 rounded-lg text-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      )}

      {/* Top summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Cash Sales Received</p>
              <p className="text-lg font-bold text-green-400">{fmt(totalCashSales)}</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Cash Sales Invoiced</p>
              <p className="text-lg font-bold text-white">{cashSales.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Cash Purchases Paid</p>
              <p className="text-lg font-bold text-red-400">{fmt(totalCashPurchases)}</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${totalCashSales - totalCashPurchases >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              <Banknote className={`w-5 h-5 ${totalCashSales - totalCashPurchases >= 0 ? 'text-green-400' : 'text-red-400'}`} />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Net Cash</p>
              <p className={`text-lg font-bold ${totalCashSales - totalCashPurchases >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(totalCashSales - totalCashPurchases)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('sales')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'sales' ? 'bg-teal-600 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          Cash Sales Account
        </button>
        <button
          onClick={() => setTab('purchases')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'purchases' ? 'bg-teal-600 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          Cash Purchases Account
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>
      ) : tab === 'sales' ? (
        /* ── CASH SALES ── */
        <div className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-xs text-zinc-500 mb-1">Total Received</p>
              <p className="text-xl font-bold text-green-400">{fmt(totalCashSales)}</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-xs text-zinc-500 mb-1">Total Invoiced</p>
              <p className="text-xl font-bold text-white">{fmt(totalCashSalesRevenue)}</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-xs text-zinc-500 mb-1">Pending Payment</p>
              <p className="text-xl font-bold text-amber-400">{unpaidCashSales}</p>
            </div>
          </div>

          {/* Monthly breakdown (only show when range / all time) */}
          {period !== 'month' && salesMonthRows.length > 0 && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Monthly Breakdown</h3>
              </div>
              <table className="min-w-full">
                <thead className="bg-zinc-800/50">
                  <tr>
                    <th className="px-5 py-2 text-left text-xs text-zinc-500 uppercase">Month</th>
                    <th className="px-5 py-2 text-center text-xs text-zinc-500 uppercase">Invoices</th>
                    <th className="px-5 py-2 text-right text-xs text-zinc-500 uppercase">Invoiced</th>
                    <th className="px-5 py-2 text-right text-xs text-zinc-500 uppercase">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {salesMonthRows.map((row) => (
                    <tr key={row.month} className="hover:bg-zinc-800/30">
                      <td className="px-5 py-3 text-sm text-zinc-200">{fmtMonth(row.month)}</td>
                      <td className="px-5 py-3 text-sm text-zinc-400 text-center">{row.count}</td>
                      <td className="px-5 py-3 text-sm text-zinc-300 text-right">{fmt(row.total)}</td>
                      <td className="px-5 py-3 text-sm font-medium text-green-400 text-right">{fmt(row.received)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-700">
                    <td className="px-5 py-3 text-sm font-bold text-white">Total</td>
                    <td className="px-5 py-3 text-sm font-bold text-white text-center">{cashSales.length}</td>
                    <td className="px-5 py-3 text-sm font-bold text-white text-right">{fmt(totalCashSalesRevenue)}</td>
                    <td className="px-5 py-3 text-sm font-bold text-green-400 text-right">{fmt(totalCashSales)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Transactions */}
          {cashSales.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
              No cash sales for {periodLabel}.
            </div>
          ) : (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Transactions ({cashSales.length})</h3>
                <span className="text-sm font-bold text-green-400">{fmt(totalCashSales)}</span>
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-800">
                  <thead className="bg-zinc-800/50">
                    <tr>
                      <th className="px-5 py-2 text-left text-xs text-zinc-500 uppercase">Invoice</th>
                      <th className="px-5 py-2 text-left text-xs text-zinc-500 uppercase">Date</th>
                      <th className="px-5 py-2 text-left text-xs text-zinc-500 uppercase">Customer</th>
                      <th className="px-5 py-2 text-left text-xs text-zinc-500 uppercase">Sold By</th>
                      <th className="px-5 py-2 text-left text-xs text-zinc-500 uppercase">Status</th>
                      <th className="px-5 py-2 text-right text-xs text-zinc-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {cashSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-zinc-800/30">
                        <td className="px-5 py-3">
                          <Link to={`/sales/${sale.id}`} className="text-sm font-medium text-teal-400 hover:text-teal-300">{sale.invoice_number}</Link>
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-400">{fmtDate(sale.sale_date)}</td>
                        <td className="px-5 py-3 text-sm text-zinc-300">{sale.customer_name || 'Walk-in'}</td>
                        <td className="px-5 py-3 text-sm text-zinc-400">{sale.created_by_email?.split('@')[0] || '-'}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${sale.payment_status === 'paid' ? 'bg-green-900/50 text-green-400' : sale.payment_status === 'partial' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'}`}>
                            {sale.payment_status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <p className="text-sm font-medium text-green-400">{fmt(sale.amount_paid)}</p>
                          {parseFloat(sale.amount_paid) !== parseFloat(sale.grand_total) && (
                            <p className="text-xs text-zinc-500">of {fmt(sale.grand_total)}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile */}
              <div className="md:hidden divide-y divide-zinc-800">
                {cashSales.map((sale) => (
                  <div key={sale.id} className="px-4 py-3 flex justify-between items-center">
                    <div>
                      <Link to={`/sales/${sale.id}`} className="text-sm font-medium text-teal-400">{sale.invoice_number}</Link>
                      <p className="text-xs text-zinc-500">{fmtDate(sale.sale_date)} · {sale.customer_name || 'Walk-in'}</p>
                    </div>
                    <span className="text-sm font-bold text-green-400">{fmt(sale.amount_paid)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── CASH PURCHASES ── */
        <div className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-xs text-zinc-500 mb-1">Total Cash Paid</p>
              <p className="text-xl font-bold text-red-400">{fmt(totalCashPurchases)}</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-xs text-zinc-500 mb-1">Payments Made</p>
              <p className="text-xl font-bold text-white">{cashPurchases.length}</p>
            </div>
          </div>

          {/* Monthly breakdown */}
          {period !== 'month' && purchaseMonthRows.length > 0 && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Monthly Breakdown</h3>
              </div>
              <table className="min-w-full">
                <thead className="bg-zinc-800/50">
                  <tr>
                    <th className="px-5 py-2 text-left text-xs text-zinc-500 uppercase">Month</th>
                    <th className="px-5 py-2 text-center text-xs text-zinc-500 uppercase">Payments</th>
                    <th className="px-5 py-2 text-right text-xs text-zinc-500 uppercase">Total Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {purchaseMonthRows.map((row) => (
                    <tr key={row.month} className="hover:bg-zinc-800/30">
                      <td className="px-5 py-3 text-sm text-zinc-200">{fmtMonth(row.month)}</td>
                      <td className="px-5 py-3 text-sm text-zinc-400 text-center">{row.count}</td>
                      <td className="px-5 py-3 text-sm font-medium text-red-400 text-right">{fmt(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-700">
                    <td className="px-5 py-3 text-sm font-bold text-white">Total</td>
                    <td className="px-5 py-3 text-sm font-bold text-white text-center">{cashPurchases.length}</td>
                    <td className="px-5 py-3 text-sm font-bold text-red-400 text-right">{fmt(totalCashPurchases)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Transactions */}
          {cashPurchases.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
              No cash purchase payments for {periodLabel}.
            </div>
          ) : (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Transactions ({cashPurchases.length})</h3>
                <span className="text-sm font-bold text-red-400">{fmt(totalCashPurchases)}</span>
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-800">
                  <thead className="bg-zinc-800/50">
                    <tr>
                      <th className="px-5 py-2 text-left text-xs text-zinc-500 uppercase">PO Number</th>
                      <th className="px-5 py-2 text-left text-xs text-zinc-500 uppercase">Date</th>
                      <th className="px-5 py-2 text-left text-xs text-zinc-500 uppercase">Supplier</th>
                      <th className="px-5 py-2 text-left text-xs text-zinc-500 uppercase">Reference</th>
                      <th className="px-5 py-2 text-right text-xs text-zinc-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {cashPurchases.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-800/30">
                        <td className="px-5 py-3">
                          {p.purchase_orders?.po_number
                            ? <Link to={`/purchase-orders/${p.po_id}`} className="text-sm font-medium text-teal-400 hover:text-teal-300">{p.purchase_orders.po_number}</Link>
                            : <span className="text-sm text-zinc-500">—</span>
                          }
                        </td>
                        <td className="px-5 py-3 text-sm text-zinc-400">{fmtDate(p.payment_date)}</td>
                        <td className="px-5 py-3 text-sm text-zinc-300">{p.purchase_orders?.supplier_name || '—'}</td>
                        <td className="px-5 py-3 text-sm text-zinc-500">{p.reference || '—'}</td>
                        <td className="px-5 py-3 text-sm font-medium text-red-400 text-right">{fmt(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile */}
              <div className="md:hidden divide-y divide-zinc-800">
                {cashPurchases.map((p) => (
                  <div key={p.id} className="px-4 py-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-teal-400">{p.purchase_orders?.po_number || 'Payment'}</p>
                      <p className="text-xs text-zinc-500">{fmtDate(p.payment_date)} · {p.purchase_orders?.supplier_name || '—'}</p>
                    </div>
                    <span className="text-sm font-bold text-red-400">{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
