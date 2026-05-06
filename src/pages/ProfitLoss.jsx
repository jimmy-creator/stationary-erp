import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TrendingUp, TrendingDown, DollarSign, Calendar, FileText, FileBarChart } from 'lucide-react'

export function ProfitLoss() {
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('statement') // 'statement', 'monthly', 'bills'
  const [period, setPeriod] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [customRange, setCustomRange] = useState({
    from: new Date().toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  })
  const [allSales, setAllSales] = useState([])
  const [allExpenses, setAllExpenses] = useState([])
  const [allReturns, setAllReturns] = useState([])
  const [productMap, setProductMap] = useState({})
  const [billsMonth, setBillsMonth] = useState('')

  useEffect(() => {
    fetchAllData()
  }, [])

  // Refetch statement data when period changes
  useEffect(() => {
    // statement tab uses period filtering client-side from allSales/allExpenses
  }, [period, selectedMonth, customRange])

  const fetchAllData = async () => {
    try {
      setLoading(true)
      const [salesRes, expensesRes, productsRes, returnsRes] = await Promise.all([
        supabase.from('sales').select('*, sale_items(*)').eq('status', 'completed').order('sale_date', { ascending: false }),
        supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
        supabase.from('products').select('id, name, cost_price'),
        supabase.from('sales_returns').select('*, sales_return_items(*)').eq('status', 'completed').order('return_date', { ascending: false }),
      ])

      const pMap = {}
      productsRes.data?.forEach((p) => { pMap[p.id] = p })
      setProductMap(pMap)
      setAllSales(salesRes.data || [])
      setAllExpenses(expensesRes.data || [])
      setAllReturns(returnsRes.data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  // ── Period helpers ──
  const getDateRange = () => {
    if (period === 'month') {
      const [y, m] = selectedMonth.split('-')
      const from = `${y}-${m}-01`
      const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate()
      const to = `${y}-${m}-${String(lastDay).padStart(2, '0')}`
      return { from, to }
    }
    if (period === 'quarter') {
      const [y, m] = selectedMonth.split('-')
      const q = Math.ceil(parseInt(m) / 3)
      const from = `${y}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`
      const endMonth = q * 3
      const lastDay = new Date(parseInt(y), endMonth, 0).getDate()
      const to = `${y}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      return { from, to }
    }
    if (period === 'year') {
      const y = selectedMonth.split('-')[0]
      return { from: `${y}-01-01`, to: `${y}-12-31` }
    }
    return customRange
  }

  const periodLabel = (() => {
    if (period === 'month') return new Date(selectedMonth + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    if (period === 'quarter') { const [y, m] = selectedMonth.split('-'); return `Q${Math.ceil(parseInt(m) / 3)} ${y}` }
    if (period === 'year') return selectedMonth.split('-')[0]
    return `${customRange.from} to ${customRange.to}`
  })()

  const goMonth = (offset) => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + offset, 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  // ── Filter data by period ──
  const { from, to } = getDateRange()
  const periodSales = allSales.filter((s) => s.sale_date >= from && s.sale_date <= to)
  const periodExpenses = allExpenses.filter((e) => e.expense_date >= from && e.expense_date <= to)
  const periodReturns = allReturns.filter((r) => r.return_date >= from && r.return_date <= to)

  // ── Statement calculations ──
  const grossRevenue = periodSales.reduce((sum, s) => sum + parseFloat(s.grand_total || 0), 0)
  const totalDiscount = periodSales.reduce((sum, s) => sum + parseFloat(s.discount_amount || 0), 0)
  const totalReturns = periodReturns.reduce((sum, r) => sum + parseFloat(r.grand_total || 0), 0)
  const netRevenue = grossRevenue - totalReturns

  const grossCogs = periodSales.reduce((sum, sale) => {
    return sum + (sale.sale_items || []).reduce((itemSum, item) => {
      return itemSum + ((productMap[item.product_id]?.cost_price || 0) * item.quantity)
    }, 0)
  }, 0)

  // Returned units cost less in COGS only when they were restocked. Damaged
  // returns stay in COGS (we lost the goods).
  const returnedCogs = periodReturns.reduce((sum, ret) => {
    return sum + (ret.sales_return_items || []).reduce((itemSum, item) => {
      if (!item.restock) return itemSum
      return itemSum + ((productMap[item.product_id]?.cost_price || 0) * (parseFloat(item.quantity) || 0))
    }, 0)
  }, 0)

  const cogs = grossCogs - returnedCogs

  const grossProfit = netRevenue - cogs
  const grossMargin = netRevenue > 0 ? ((grossProfit / netRevenue) * 100).toFixed(1) : 0

  const expensesByCategory = {}
  periodExpenses.forEach((exp) => {
    const cat = exp.category || 'other'
    if (!expensesByCategory[cat]) expensesByCategory[cat] = 0
    expensesByCategory[cat] += parseFloat(exp.amount || 0)
  })
  const totalExpenses = periodExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)
  const netProfit = grossProfit - totalExpenses
  const netMargin = netRevenue > 0 ? ((netProfit / netRevenue) * 100).toFixed(1) : 0
  const sortedExpenses = Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a)

  const categoryLabels = {
    rent: 'Rent', utilities: 'Utilities', salary: 'Salaries & Wages',
    inventory: 'Inventory Purchase', maintenance: 'Maintenance & Repairs',
    marketing: 'Marketing & Advertising', transport: 'Transport & Delivery',
    office_supplies: 'Office Supplies', other: 'Other Expenses',
  }

  // ── Monthly/Bills calculations (from all data) ──
  const salesWithProfit = allSales.map((sale) => {
    let totalCost = 0, totalRevenue = 0
    sale.sale_items?.forEach((item) => {
      totalCost += (productMap[item.product_id]?.cost_price || 0) * item.quantity
      totalRevenue += item.total_price
    })
    const discountAmt = parseFloat(sale.discount_amount) || 0
    const revenue = totalRevenue - discountAmt
    const profit = revenue - totalCost
    return {
      ...sale, total_cost: totalCost, revenue, profit,
      margin: revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0,
      items_count: sale.sale_items?.length || 0,
    }
  })

  const monthlyData = (() => {
    const months = {}
    salesWithProfit.forEach((sale) => {
      const month = sale.sale_date.substring(0, 7)
      if (!months[month]) months[month] = { month, revenue: 0, cost: 0, profit: 0, salesCount: 0 }
      months[month].revenue += sale.revenue
      months[month].cost += sale.total_cost
      months[month].profit += sale.profit
      months[month].salesCount += 1
    })
    // Add expenses to monthly
    allExpenses.forEach((exp) => {
      const month = exp.expense_date.substring(0, 7)
      if (!months[month]) months[month] = { month, revenue: 0, cost: 0, profit: 0, salesCount: 0 }
      if (!months[month].expenses) months[month].expenses = 0
      months[month].expenses += parseFloat(exp.amount || 0)
    })
    return Object.values(months).sort((a, b) => b.month.localeCompare(a.month))
  })()

  const filteredBills = billsMonth
    ? salesWithProfit.filter((s) => s.sale_date.substring(0, 7) === billsMonth)
    : salesWithProfit

  const billMonths = [...new Set(allSales.map((s) => s.sale_date.substring(0, 7)))].sort().reverse()

  // ── Overall totals for bills ──
  const billsTotalRevenue = filteredBills.reduce((s, sale) => s + sale.revenue, 0)
  const billsTotalCost = filteredBills.reduce((s, sale) => s + sale.total_cost, 0)
  const billsTotalProfit = filteredBills.reduce((s, sale) => s + sale.profit, 0)

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">P&L Statement</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('statement')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'statement' ? 'bg-teal-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
            <FileBarChart className="w-4 h-4 inline mr-1.5" />Statement
          </button>
          <button onClick={() => setTab('monthly')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'monthly' ? 'bg-teal-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
            <Calendar className="w-4 h-4 inline mr-1.5" />Monthly
          </button>
          <button onClick={() => setTab('bills')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'bills' ? 'bg-teal-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
            <FileText className="w-4 h-4 inline mr-1.5" />Bill-wise
          </button>
        </div>
      </div>

      {/* ═══════ STATEMENT TAB ═══════ */}
      {tab === 'statement' && (
        <>
          {/* Period selector */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {['month', 'quarter', 'year', 'custom'].map((p) => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${period === p ? 'bg-zinc-700 text-white' : 'bg-zinc-800/50 text-zinc-500 hover:text-white'}`}>{p}</button>
            ))}
          </div>
          <div className="flex items-center gap-3 mb-6">
            {period !== 'custom' ? (
              <>
                <button onClick={() => goMonth(period === 'year' ? -12 : period === 'quarter' ? -3 : -1)} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700">&larr;</button>
                <span className="text-lg font-medium text-white">{periodLabel}</span>
                <button onClick={() => goMonth(period === 'year' ? 12 : period === 'quarter' ? 3 : 1)} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700">&rarr;</button>
              </>
            ) : (
              <>
                <input type="date" value={customRange.from} onChange={(e) => setCustomRange({ ...customRange, from: e.target.value })} className="bg-zinc-800/50 border border-zinc-700 rounded-lg text-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
                <span className="text-zinc-500">to</span>
                <input type="date" value={customRange.to} onChange={(e) => setCustomRange({ ...customRange, to: e.target.value })} className="bg-zinc-800/50 border border-zinc-700 rounded-lg text-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center"><DollarSign className="w-5 h-5 text-blue-400" /></div><div><p className="text-xs text-zinc-500">Revenue</p><p className="text-lg font-bold text-white">{formatCurrency(netRevenue)}</p></div></div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${grossProfit >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}><TrendingUp className={`w-5 h-5 ${grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}`} /></div><div><p className="text-xs text-zinc-500">Gross Profit</p><p className={`text-lg font-bold ${grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(grossProfit)}</p></div></div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-red-400" /></div><div><p className="text-xs text-zinc-500">Expenses</p><p className="text-lg font-bold text-red-400">{formatCurrency(totalExpenses)}</p></div></div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${netProfit >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}><TrendingUp className={`w-5 h-5 ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`} /></div><div><p className="text-xs text-zinc-500">Net Profit</p><p className={`text-lg font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(netProfit)}</p></div></div>
            </div>
          </div>

          {/* P&L Statement */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="bg-zinc-800/50 px-6 py-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-white text-center">Profit & Loss Statement</h2>
              <p className="text-sm text-zinc-500 text-center">{periodLabel}</p>
            </div>
            <div className="divide-y divide-zinc-800">
              <div className="px-6 py-4">
                <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider mb-3">Revenue</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-zinc-300 pl-4">Sales Revenue ({periodSales.length} invoices)</span><span className="text-zinc-200">{formatCurrency(grossRevenue)}</span></div>
                  {totalDiscount > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400 pl-4">Less: Discounts</span><span className="text-red-400">({formatCurrency(totalDiscount)})</span></div>}
                </div>
                <div className="flex justify-between text-sm font-bold mt-3 pt-2 border-t border-zinc-800/50"><span className="text-white">Net Revenue</span><span className="text-white">{formatCurrency(netRevenue)}</span></div>
              </div>

              <div className="px-6 py-4">
                <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3">Cost of Goods Sold</h3>
                <div className="flex justify-between text-sm"><span className="text-zinc-300 pl-4">Product Cost (at cost price)</span><span className="text-zinc-200">{formatCurrency(cogs)}</span></div>
                <div className="flex justify-between text-sm font-bold mt-3 pt-2 border-t border-zinc-800/50"><span className="text-white">Total COGS</span><span className="text-red-400">({formatCurrency(cogs)})</span></div>
              </div>

              <div className="px-6 py-4 bg-zinc-800/20">
                <div className="flex justify-between items-center">
                  <div><span className="text-sm font-bold text-white">Gross Profit</span><span className={`ml-3 px-2 py-0.5 text-xs font-medium rounded-full ${grossMargin >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>{grossMargin}% margin</span></div>
                  <span className={`text-lg font-bold ${grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(grossProfit)}</span>
                </div>
              </div>

              <div className="px-6 py-4">
                <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">Operating Expenses</h3>
                {sortedExpenses.length === 0 ? (
                  <p className="text-sm text-zinc-500 pl-4">No expenses recorded for this period</p>
                ) : (
                  <div className="space-y-2">
                    {sortedExpenses.map(([cat, amount]) => (
                      <div key={cat} className="flex justify-between text-sm"><span className="text-zinc-300 pl-4">{categoryLabels[cat] || cat}</span><span className="text-zinc-200">{formatCurrency(amount)}</span></div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold mt-3 pt-2 border-t border-zinc-800/50"><span className="text-white">Total Operating Expenses</span><span className="text-red-400">({formatCurrency(totalExpenses)})</span></div>
              </div>

              <div className={`px-6 py-5 ${netProfit >= 0 ? 'bg-green-900/10' : 'bg-red-900/10'}`}>
                <div className="flex justify-between items-center">
                  <div><span className="text-lg font-bold text-white">{netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</span><span className={`ml-3 px-2 py-0.5 text-xs font-medium rounded-full ${netMargin >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>{netMargin}% net margin</span></div>
                  <span className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(Math.abs(netProfit))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="mt-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-400 uppercase mb-4">Key Metrics</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div><p className="text-xs text-zinc-500">Avg Sale Value</p><p className="text-lg font-bold text-white">{periodSales.length > 0 ? formatCurrency(netRevenue / periodSales.length) : 'QAR 0.00'}</p></div>
              <div><p className="text-xs text-zinc-500">Gross Margin</p><p className={`text-lg font-bold ${grossMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}>{grossMargin}%</p></div>
              <div><p className="text-xs text-zinc-500">Net Margin</p><p className={`text-lg font-bold ${netMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{netMargin}%</p></div>
              <div><p className="text-xs text-zinc-500">Expense Ratio</p><p className="text-lg font-bold text-white">{netRevenue > 0 ? ((totalExpenses / netRevenue) * 100).toFixed(1) : 0}%</p></div>
            </div>
          </div>
        </>
      )}

      {/* ═══════ MONTHLY TAB ═══════ */}
      {tab === 'monthly' && (
        <>
          {monthlyData.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">No data yet.</div>
          ) : (
            <>
              <div className="hidden md:block bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-slate-800">
                  <thead className="bg-zinc-800/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Month</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-zinc-500 uppercase">Sales</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Revenue</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">COGS</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Gross Profit</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Expenses</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Net Profit</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {monthlyData.map((row) => {
                      const gp = row.revenue - row.cost
                      const exp = row.expenses || 0
                      const np = gp - exp
                      const margin = row.revenue > 0 ? ((np / row.revenue) * 100).toFixed(1) : 0
                      return (
                        <tr key={row.month} className="hover:bg-zinc-800/50 cursor-pointer" onClick={() => { setTab('bills'); setBillsMonth(row.month) }}>
                          <td className="px-6 py-4 text-sm font-medium text-white">{new Date(row.month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</td>
                          <td className="px-6 py-4 text-sm text-zinc-400 text-center">{row.salesCount}</td>
                          <td className="px-6 py-4 text-sm text-zinc-200 text-right">{formatCurrency(row.revenue)}</td>
                          <td className="px-6 py-4 text-sm text-zinc-400 text-right">{formatCurrency(row.cost)}</td>
                          <td className={`px-6 py-4 text-sm font-medium text-right ${gp >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(gp)}</td>
                          <td className="px-6 py-4 text-sm text-red-400 text-right">{exp > 0 ? formatCurrency(exp) : '-'}</td>
                          <td className={`px-6 py-4 text-sm font-bold text-right ${np >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(np)}</td>
                          <td className={`px-6 py-4 text-sm font-medium text-right ${margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{margin}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-4">
                {monthlyData.map((row) => {
                  const gp = row.revenue - row.cost
                  const exp = row.expenses || 0
                  const np = gp - exp
                  const margin = row.revenue > 0 ? ((np / row.revenue) * 100).toFixed(1) : 0
                  return (
                    <div key={row.month} onClick={() => { setTab('bills'); setBillsMonth(row.month) }} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <p className="font-medium text-white">{new Date(row.month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</p>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${margin >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>{margin}%</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><p className="text-xs text-zinc-500">Revenue</p><p className="text-sm font-medium text-white">{formatCurrency(row.revenue)}</p></div>
                        <div><p className="text-xs text-zinc-500">Gross Profit</p><p className={`text-sm font-medium ${gp >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(gp)}</p></div>
                        <div><p className="text-xs text-zinc-500">Expenses</p><p className="text-sm text-red-400">{exp > 0 ? formatCurrency(exp) : '-'}</p></div>
                        <div><p className="text-xs text-zinc-500">Net Profit</p><p className={`text-sm font-bold ${np >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(np)}</p></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════ BILLS TAB ═══════ */}
      {tab === 'bills' && (
        <>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-300 mb-1">Filter by Month</label>
                <select value={billsMonth} onChange={(e) => setBillsMonth(e.target.value)} className="w-full sm:w-64 bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="">All Months</option>
                  {billMonths.map((m) => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</option>)}
                </select>
              </div>
              <div className="flex gap-4 text-sm">
                <div><span className="text-zinc-500">Revenue: </span><span className="text-white font-medium">{formatCurrency(billsTotalRevenue)}</span></div>
                <div><span className="text-zinc-500">Profit: </span><span className={`font-medium ${billsTotalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(billsTotalProfit)}</span></div>
              </div>
            </div>
          </div>

          {filteredBills.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">No sales found.</div>
          ) : (
            <>
              <div className="hidden md:block bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-slate-800">
                  <thead className="bg-zinc-800/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Invoice</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Customer</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Revenue</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Cost</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Profit</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredBills.map((sale) => (
                      <tr key={sale.id} className="hover:bg-zinc-800/50">
                        <td className="px-6 py-4"><Link to={`/sales/${sale.id}`} className="text-sm font-medium text-teal-400 hover:text-teal-300">{sale.invoice_number}</Link></td>
                        <td className="px-6 py-4 text-sm text-zinc-400">{formatDate(sale.sale_date)}</td>
                        <td className="px-6 py-4 text-sm text-zinc-300">{sale.customer_name || 'Walk-in'}</td>
                        <td className="px-6 py-4 text-sm text-zinc-200 text-right">{formatCurrency(sale.revenue)}</td>
                        <td className="px-6 py-4 text-sm text-zinc-400 text-right">{formatCurrency(sale.total_cost)}</td>
                        <td className={`px-6 py-4 text-sm font-medium text-right ${sale.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(sale.profit)}</td>
                        <td className={`px-6 py-4 text-sm font-medium text-right ${sale.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{sale.margin}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-zinc-800/30">
                    <tr>
                      <td colSpan={3} className="px-6 py-3 text-sm font-medium text-zinc-300">Total ({filteredBills.length} sales)</td>
                      <td className="px-6 py-3 text-sm font-bold text-white text-right">{formatCurrency(billsTotalRevenue)}</td>
                      <td className="px-6 py-3 text-sm font-bold text-zinc-300 text-right">{formatCurrency(billsTotalCost)}</td>
                      <td className={`px-6 py-3 text-sm font-bold text-right ${billsTotalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(billsTotalProfit)}</td>
                      <td className="px-6 py-3 text-sm font-bold text-emerald-400 text-right">{billsTotalRevenue > 0 ? ((billsTotalProfit / billsTotalRevenue) * 100).toFixed(1) + '%' : '0%'}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="md:hidden space-y-4">
                {filteredBills.map((sale) => (
                  <Link key={sale.id} to={`/sales/${sale.id}`} className="block bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-800/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div><p className="font-medium text-teal-400">{sale.invoice_number}</p><p className="text-xs text-zinc-500">{formatDate(sale.sale_date)}</p></div>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${sale.profit >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>{sale.margin}%</span>
                    </div>
                    <p className="text-sm text-zinc-300 mb-2">{sale.customer_name || 'Walk-in'}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div><p className="text-xs text-zinc-500">Revenue</p><p className="text-sm text-white">{formatCurrency(sale.revenue)}</p></div>
                      <div><p className="text-xs text-zinc-500">Cost</p><p className="text-sm text-zinc-400">{formatCurrency(sale.total_cost)}</p></div>
                      <div><p className="text-xs text-zinc-500">Profit</p><p className={`text-sm font-bold ${sale.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(sale.profit)}</p></div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
