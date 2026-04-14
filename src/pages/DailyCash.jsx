import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Banknote, CreditCard, ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react'

export function DailyCash() {
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [salesData, setSalesData] = useState([])
  const [expensesData, setExpensesData] = useState([])
  const [collectionsData, setCollectionsData] = useState([])
  const [poPaymentsData, setPoPaymentsData] = useState([])
  const [viewMode, setViewMode] = useState('daily') // 'daily' or 'range'
  const [dateRange, setDateRange] = useState({
    from: new Date().toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    fetchData()
  }, [selectedDate, viewMode, dateRange.from, dateRange.to])

  const getDateFilter = () => {
    if (viewMode === 'daily') return { from: selectedDate, to: selectedDate }
    return dateRange
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const { from, to } = getDateFilter()

      const [salesRes, expensesRes, collectionsRes, poPaymentsRes] = await Promise.all([
        // Sales for the date(s)
        supabase
          .from('sales')
          .select('id, invoice_number, customer_name, grand_total, amount_paid, payment_method, payment_status, sale_date')
          .eq('status', 'completed')
          .gte('sale_date', from)
          .lte('sale_date', to)
          .order('created_at', { ascending: false }),

        // Expenses for the date(s)
        supabase
          .from('expenses')
          .select('id, description, amount, category, payment_method, expense_date')
          .gte('expense_date', from)
          .lte('expense_date', to)
          .order('created_at', { ascending: false }),

        // Payment collections for the date(s)
        supabase
          .from('sale_payments')
          .select('id, sale_id, amount, payment_method, payment_date, reference')
          .gte('payment_date', from)
          .lte('payment_date', to)
          .order('created_at', { ascending: false })
          .then(res => res)
          .catch(() => ({ data: [], error: null })),

        // PO payments for the date(s)
        supabase
          .from('po_payments')
          .select('id, po_id, amount, payment_method, payment_date, reference')
          .gte('payment_date', from)
          .lte('payment_date', to)
          .order('created_at', { ascending: false })
          .then(res => res)
          .catch(() => ({ data: [], error: null })),
      ])

      setSalesData(salesRes.data || [])
      setExpensesData(expensesRes.data || [])
      setCollectionsData(collectionsRes.data || [])
      setPoPaymentsData(poPaymentsRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  // Calculate cash in
  const cashSales = salesData
    .filter((s) => s.payment_method === 'cash')
    .reduce((sum, s) => sum + parseFloat(s.amount_paid || 0), 0)

  const cardSales = salesData
    .filter((s) => s.payment_method === 'card')
    .reduce((sum, s) => sum + parseFloat(s.amount_paid || 0), 0)

  const bankSales = salesData
    .filter((s) => s.payment_method === 'bank_transfer')
    .reduce((sum, s) => sum + parseFloat(s.amount_paid || 0), 0)

  const creditSales = salesData
    .filter((s) => s.payment_method === 'credit')
    .reduce((sum, s) => sum + parseFloat(s.amount_paid || 0), 0)

  const cashCollections = collectionsData
    .filter((c) => c.payment_method === 'cash')
    .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0)

  const cardCollections = collectionsData
    .filter((c) => c.payment_method === 'card')
    .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0)

  const bankCollections = collectionsData
    .filter((c) => c.payment_method === 'bank_transfer')
    .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0)

  // Calculate cash out
  const cashExpenses = expensesData
    .filter((e) => e.payment_method === 'cash')
    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)

  const bankExpenses = expensesData
    .filter((e) => e.payment_method !== 'cash')
    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)

  const cashPOPayments = poPaymentsData
    .filter((p) => p.payment_method === 'cash')
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)

  const bankPOPayments = poPaymentsData
    .filter((p) => p.payment_method !== 'cash')
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)

  // Totals
  const totalCashIn = cashSales + cashCollections
  const totalCashOut = cashExpenses + cashPOPayments
  const netCash = totalCashIn - totalCashOut

  const totalBankIn = bankSales + cardSales + bankCollections + cardCollections
  const totalBankOut = bankExpenses + bankPOPayments
  const netBank = totalBankIn - totalBankOut

  const totalSalesRevenue = salesData.reduce((sum, s) => sum + parseFloat(s.grand_total || 0), 0)
  const totalSalesReceived = salesData.reduce((sum, s) => sum + parseFloat(s.amount_paid || 0), 0)
  const totalExpenses = expensesData.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)
  const totalCollections = collectionsData.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0)
  const totalPOPayments = poPaymentsData.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)

  const totalIn = totalSalesReceived + totalCollections
  const totalOut = totalExpenses + totalPOPayments
  const netTotal = totalIn - totalOut

  const paymentMethodLabels = { cash: 'Cash', card: 'Card', bank_transfer: 'Bank Transfer', credit: 'Credit', credit_card: 'Credit Card', cheque: 'Cheque' }

  const categoryLabels = {
    rent: 'Rent', utilities: 'Utilities', salary: 'Salary', inventory: 'Inventory',
    maintenance: 'Maintenance', marketing: 'Marketing', transport: 'Transport',
    office_supplies: 'Office Supplies', other: 'Other',
  }

  const goToDate = (offset) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Daily Cash Summary</h1>
        <div className="flex gap-2">
          <button onClick={() => setViewMode('daily')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'daily' ? 'bg-teal-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
            Daily
          </button>
          <button onClick={() => setViewMode('range')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'range' ? 'bg-teal-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
            Date Range
          </button>
        </div>
      </div>

      {/* Date Selector */}
      {viewMode === 'daily' ? (
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => goToDate(-1)} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700">&larr;</button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-zinc-800/50 border border-zinc-700 rounded-lg text-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button onClick={() => goToDate(1)} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700">&rarr;</button>
          <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} className="px-3 py-2 text-sm text-teal-400 hover:text-teal-300">Today</button>
          <span className="text-zinc-500 text-sm">
            {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3 mb-6">
          <input type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} className="bg-zinc-800/50 border border-zinc-700 rounded-lg text-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          <span className="text-zinc-500">to</span>
          <input type="date" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} className="bg-zinc-800/50 border border-zinc-700 rounded-lg text-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total In</p>
              <p className="text-lg font-bold text-green-400">{formatCurrency(totalIn)}</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Out</p>
              <p className="text-lg font-bold text-red-400">{formatCurrency(totalOut)}</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${netTotal >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              <TrendingUp className={`w-5 h-5 ${netTotal >= 0 ? 'text-green-400' : 'text-red-400'}`} />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Net</p>
              <p className={`text-lg font-bold ${netTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(netTotal)}</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Sales Revenue</p>
              <p className="text-lg font-bold text-white">{formatCurrency(totalSalesRevenue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cash vs Bank Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Banknote className="w-5 h-5 text-green-400" />
            Cash Register
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-zinc-400">Cash Sales</span><span className="text-green-400">+{formatCurrency(cashSales)}</span></div>
            {cashCollections > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Cash Collections</span><span className="text-green-400">+{formatCurrency(cashCollections)}</span></div>}
            {cashExpenses > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Cash Expenses</span><span className="text-red-400">-{formatCurrency(cashExpenses)}</span></div>}
            {cashPOPayments > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Cash Supplier Payments</span><span className="text-red-400">-{formatCurrency(cashPOPayments)}</span></div>}
            <div className={`flex justify-between text-sm font-bold border-t border-zinc-800 pt-2 ${netCash >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              <span>Net Cash</span><span>{formatCurrency(netCash)}</span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-400" />
            Bank / Card
          </h2>
          <div className="space-y-3">
            {cardSales > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Card Sales</span><span className="text-green-400">+{formatCurrency(cardSales)}</span></div>}
            {bankSales > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Bank Transfer Sales</span><span className="text-green-400">+{formatCurrency(bankSales)}</span></div>}
            {(cardCollections + bankCollections) > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Bank/Card Collections</span><span className="text-green-400">+{formatCurrency(cardCollections + bankCollections)}</span></div>}
            {bankExpenses > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Bank Expenses</span><span className="text-red-400">-{formatCurrency(bankExpenses)}</span></div>}
            {bankPOPayments > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Bank Supplier Payments</span><span className="text-red-400">-{formatCurrency(bankPOPayments)}</span></div>}
            <div className={`flex justify-between text-sm font-bold border-t border-zinc-800 pt-2 ${netBank >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              <span>Net Bank</span><span>{formatCurrency(netBank)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="space-y-6">
        {/* Sales */}
        {salesData.length > 0 && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-400 uppercase mb-3">
              Sales ({salesData.length})
              <span className="ml-2 text-white">{formatCurrency(totalSalesRevenue)}</span>
              {totalSalesReceived !== totalSalesRevenue && <span className="ml-2 text-zinc-500">(Received: {formatCurrency(totalSalesReceived)})</span>}
            </h3>
            <div className="space-y-2">
              {salesData.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between bg-zinc-800/30 rounded-lg p-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-teal-400 font-medium">{sale.invoice_number}</span>
                      <span className="text-sm text-zinc-300">{sale.customer_name || 'Walk-in'}</span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400">{paymentMethodLabels[sale.payment_method]}</span>
                      {sale.payment_status !== 'paid' && (
                        <span className={`px-2 py-0.5 text-xs rounded-full ${sale.payment_status === 'unpaid' ? 'bg-red-900/50 text-red-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                          {sale.payment_status}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-medium text-green-400">+{formatCurrency(sale.amount_paid)}</p>
                    {parseFloat(sale.amount_paid) !== parseFloat(sale.grand_total) && (
                      <p className="text-xs text-zinc-500">of {formatCurrency(sale.grand_total)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collections */}
        {collectionsData.length > 0 && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-400 uppercase mb-3">
              Payment Collections ({collectionsData.length})
              <span className="ml-2 text-green-400">{formatCurrency(totalCollections)}</span>
            </h3>
            <div className="space-y-2">
              {collectionsData.map((c) => (
                <div key={c.id} className="flex items-center justify-between bg-zinc-800/30 rounded-lg p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-zinc-300">Collection</span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400">{paymentMethodLabels[c.payment_method]}</span>
                    {c.reference && <span className="text-xs text-zinc-500">Ref: {c.reference}</span>}
                  </div>
                  <span className="font-medium text-green-400">+{formatCurrency(c.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expenses */}
        {expensesData.length > 0 && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-400 uppercase mb-3">
              Expenses ({expensesData.length})
              <span className="ml-2 text-red-400">{formatCurrency(totalExpenses)}</span>
            </h3>
            <div className="space-y-2">
              {expensesData.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between bg-zinc-800/30 rounded-lg p-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-zinc-300">{exp.description}</span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400">{categoryLabels[exp.category] || exp.category}</span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400">{paymentMethodLabels[exp.payment_method]}</span>
                    </div>
                  </div>
                  <span className="font-medium text-red-400 ml-4">-{formatCurrency(exp.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Supplier Payments */}
        {poPaymentsData.length > 0 && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-400 uppercase mb-3">
              Supplier Payments ({poPaymentsData.length})
              <span className="ml-2 text-red-400">{formatCurrency(totalPOPayments)}</span>
            </h3>
            <div className="space-y-2">
              {poPaymentsData.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-zinc-800/30 rounded-lg p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-zinc-300">PO Payment</span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400">{paymentMethodLabels[p.payment_method]}</span>
                    {p.reference && <span className="text-xs text-zinc-500">Ref: {p.reference}</span>}
                  </div>
                  <span className="font-medium text-red-400">-{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {salesData.length === 0 && expensesData.length === 0 && collectionsData.length === 0 && poPaymentsData.length === 0 && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
            No transactions for this {viewMode === 'daily' ? 'date' : 'period'}.
          </div>
        )}
      </div>
    </div>
  )
}
