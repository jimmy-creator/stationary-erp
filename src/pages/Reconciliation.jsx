import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sumField, sumFieldWhere, getDateRange } from '../lib/finance'
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'

const THRESHOLD = 0.01 // QAR 0.01 tolerance for floating point

function StatusIcon({ diff }) {
  const abs = Math.abs(diff)
  if (abs <= THRESHOLD) return <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
  if (abs < 1) return <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
  return <XCircle className="w-5 h-5 text-red-400 shrink-0" />
}

function statusClass(diff) {
  const abs = Math.abs(diff)
  if (abs <= THRESHOLD) return 'border-green-500/20 bg-green-500/5'
  if (abs < 1) return 'border-yellow-500/20 bg-yellow-500/5'
  return 'border-red-500/20 bg-red-500/5'
}

function diffLabel(diff) {
  const abs = Math.abs(diff)
  if (abs <= THRESHOLD) return { text: 'Balanced', cls: 'text-green-400' }
  if (abs < 1) return { text: `Off by QAR ${diff.toFixed(4)} (rounding)`, cls: 'text-yellow-400' }
  return { text: `Discrepancy: QAR ${diff.toFixed(2)}`, cls: 'text-red-400' }
}

export function Reconciliation() {
  const [loading, setLoading] = useState(true)
  const [lastRun, setLastRun] = useState(null)
  const [period, setPeriod] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7))
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  })
  const [data, setData] = useState(null)

  useEffect(() => { run() }, [period, selectedMonth, dateRange.from, dateRange.to])

  const getRange = () => getDateRange(period, selectedMonth, dateRange)

  const run = async () => {
    setLoading(true)
    try {
      const { from, to } = getRange()

      const [
        salesRes,
        salePaymentsRes,
        expensesRes,
        poPaymentsRes,
        purchaseOrdersRes,
      ] = await Promise.all([
        supabase.from('sales')
          .select('id, grand_total, amount_paid, payment_method, payment_status, subtotal, discount_amount, tax_amount')
          .eq('status', 'completed')
          .gte('sale_date', from).lte('sale_date', to),

        supabase.from('sale_payments')
          .select('amount, payment_method')
          .gte('payment_date', from).lte('payment_date', to),

        supabase.from('expenses')
          .select('amount, payment_method')
          .gte('expense_date', from).lte('expense_date', to),

        supabase.from('po_payments')
          .select('amount, payment_method')
          .gte('payment_date', from).lte('payment_date', to),

        supabase.from('purchase_orders')
          .select('grand_total, amount_paid, payment_status')
          .eq('status', 'received')
          .gte('po_date', from).lte('po_date', to),
      ])

      const sales        = salesRes.data || []
      const salePayments = salePaymentsRes.data || []
      const expenses     = expensesRes.data || []
      const poPayments   = poPaymentsRes.data || []
      const purchaseOrders = purchaseOrdersRes.data || []

      // ── CHECK 1: Sales breakdown by payment method ──
      const totalSalesInvoiced = sumField(sales, 'grand_total')
      const cashSalesInvoiced   = sumFieldWhere(sales, 'grand_total', 'payment_method', 'cash')
      const cardSalesInvoiced   = sumFieldWhere(sales, 'grand_total', 'payment_method', 'card')
      const bankSalesInvoiced   = sumFieldWhere(sales, 'grand_total', 'payment_method', 'bank_transfer')
      const creditSalesInvoiced = sumFieldWhere(sales, 'grand_total', 'payment_method', 'credit')
      const methodSum = cashSalesInvoiced + cardSalesInvoiced + bankSalesInvoiced + creditSalesInvoiced
      const check1Diff = totalSalesInvoiced - methodSum

      // ── CHECK 2: AR reconciliation ──
      // Expected AR = total invoiced - total received on sales
      const totalReceived = sumField(sales, 'amount_paid')
      const expectedAR = totalSalesInvoiced - totalReceived
      // Actual AR = sum of outstanding balances on unpaid/partial sales
      const actualAR = sales
        .filter(s => s.payment_status !== 'paid')
        .reduce((s, x) => s + Math.max(0, parseFloat(x.grand_total) - parseFloat(x.amount_paid)), 0)
      const check2Diff = expectedAR - actualAR

      // ── CHECK 3: Subtotal reconciliation ──
      // grand_total should = subtotal - discount + tax for every sale
      let check3Diff = 0
      sales.forEach(s => {
        const expected = parseFloat(s.subtotal || 0) - parseFloat(s.discount_amount || 0) + parseFloat(s.tax_amount || 0)
        check3Diff += Math.abs(parseFloat(s.grand_total || 0) - expected)
      })

      // ── CHECK 4: Cash flow reconciliation ──
      // Cash in = cash sales received + cash collections
      const cashSalesReceived     = sumFieldWhere(sales, 'amount_paid', 'payment_method', 'cash')
      const cashCollections       = sumFieldWhere(salePayments, 'amount', 'payment_method', 'cash')
      const cashIn                = cashSalesReceived + cashCollections
      // Cash out = cash expenses + cash PO payments
      const cashExpenses          = sumFieldWhere(expenses, 'amount', 'payment_method', 'cash')
      const cashPOPayments        = sumFieldWhere(poPayments, 'amount', 'payment_method', 'cash')
      const cashOut               = cashExpenses + cashPOPayments
      const netCash               = cashIn - cashOut

      // ── CHECK 5: AP reconciliation ──
      const totalPOInvoiced  = sumField(purchaseOrders, 'grand_total')
      const totalPOPaid      = sumField(purchaseOrders, 'amount_paid')
      const expectedAP       = totalPOInvoiced - totalPOPaid
      const actualAP         = purchaseOrders
        .filter(p => p.payment_status !== 'paid')
        .reduce((s, x) => s + Math.max(0, parseFloat(x.grand_total) - parseFloat(x.amount_paid)), 0)
      const check5Diff = expectedAP - actualAP

      setData({
        period: getRange(),
        sales: { total: totalSalesInvoiced, received: totalReceived, cash: cashSalesInvoiced, card: cardSalesInvoiced, bank: bankSalesInvoiced, credit: creditSalesInvoiced, methodSum },
        ar: { expected: expectedAR, actual: actualAR },
        subtotal: { totalDiff: check3Diff, count: sales.length },
        cash: { cashSalesReceived, cashCollections, cashIn, cashExpenses, cashPOPayments, cashOut, netCash },
        ap: { expected: expectedAP, actual: actualAP, totalInvoiced: totalPOInvoiced, totalPaid: totalPOPaid },
        checks: {
          salesBreakdown: check1Diff,
          ar: check2Diff,
          subtotals: check3Diff,
          ap: check5Diff,
        },
      })
      setLastRun(new Date())
    } catch (err) {
      console.error('Reconciliation error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fmt = (n) => `QAR ${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  const fmtMonth = (m) => new Date(m + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })

  const allClear = data && Object.values(data.checks).every(d => Math.abs(d) <= THRESHOLD)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">Finance Reconciliation</h1>
          {lastRun && <p className="text-xs text-zinc-500 mt-1">Last checked: {lastRun.toLocaleTimeString()}</p>}
        </div>
        <div className="flex items-center gap-2">
          {['month', 'year', 'range', 'all'].map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p ? 'bg-teal-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
              {p === 'month' ? 'Month' : p === 'year' ? 'Year' : p === 'range' ? 'Range' : 'All Time'}
            </button>
          ))}
          <button onClick={run} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700">
            <RefreshCw className="w-3.5 h-3.5" /> Recheck
          </button>
        </div>
      </div>

      {/* Period picker */}
      {(period === 'month' || period === 'year') && (
        <div className="flex items-center gap-3 mb-6">
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-zinc-800/50 border border-zinc-700 rounded-lg text-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          <span className="text-zinc-500 text-sm">
            {period === 'month' ? fmtMonth(selectedMonth) : selectedMonth.split('-')[0]}
          </span>
        </div>
      )}
      {period === 'range' && (
        <div className="flex items-center gap-3 mb-6">
          <input type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            className="bg-zinc-800/50 border border-zinc-700 rounded-lg text-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          <span className="text-zinc-500">to</span>
          <input type="date" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            className="bg-zinc-800/50 border border-zinc-700 rounded-lg text-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>
      ) : !data ? null : (
        <div className="space-y-4">

          {/* Overall status banner */}
          <div className={`rounded-xl border p-4 flex items-center gap-3 ${allClear ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
            {allClear
              ? <><CheckCircle className="w-6 h-6 text-green-400" /><span className="font-semibold text-green-400">All checks passed — finance data is balanced</span></>
              : <><XCircle className="w-6 h-6 text-red-400" /><span className="font-semibold text-red-400">Discrepancies found — review the checks below</span></>
            }
          </div>

          {/* CHECK 1: Sales by payment method */}
          <div className={`rounded-xl border p-5 ${statusClass(data.checks.salesBreakdown)}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <StatusIcon diff={data.checks.salesBreakdown} />
                <h3 className="font-semibold text-white">Check 1 — Sales Breakdown by Payment Method</h3>
              </div>
              <span className={`text-sm font-medium ${diffLabel(data.checks.salesBreakdown).cls}`}>
                {diffLabel(data.checks.salesBreakdown).text}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Total Invoiced</p>
                <p className="font-bold text-white">{fmt(data.sales.total)}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Cash</p>
                <p className="text-green-400">{fmt(data.sales.cash)}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Card</p>
                <p className="text-blue-400">{fmt(data.sales.card)}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Bank Transfer</p>
                <p className="text-purple-400">{fmt(data.sales.bank)}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Credit</p>
                <p className="text-orange-400">{fmt(data.sales.credit)}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Method Sum</p>
                <p className={`font-bold ${Math.abs(data.checks.salesBreakdown) <= THRESHOLD ? 'text-green-400' : 'text-red-400'}`}>{fmt(data.sales.methodSum)}</p>
              </div>
            </div>
          </div>

          {/* CHECK 2: AR Reconciliation */}
          <div className={`rounded-xl border p-5 ${statusClass(data.checks.ar)}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <StatusIcon diff={data.checks.ar} />
                <h3 className="font-semibold text-white">Check 2 — Accounts Receivable Balance</h3>
              </div>
              <span className={`text-sm font-medium ${diffLabel(data.checks.ar).cls}`}>
                {diffLabel(data.checks.ar).text}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Total Invoiced</p>
                <p className="font-bold text-white">{fmt(data.sales.total)}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Total Received</p>
                <p className="text-green-400">{fmt(data.sales.received)}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Expected AR (Invoiced − Received)</p>
                <p className="text-red-400">{fmt(data.ar.expected)}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Actual AR (Unpaid balances)</p>
                <p className={`font-bold ${Math.abs(data.checks.ar) <= THRESHOLD ? 'text-green-400' : 'text-red-400'}`}>{fmt(data.ar.actual)}</p>
              </div>
            </div>
          </div>

          {/* CHECK 3: Subtotal integrity */}
          <div className={`rounded-xl border p-5 ${statusClass(data.checks.subtotals)}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <StatusIcon diff={data.checks.subtotals} />
                <h3 className="font-semibold text-white">Check 3 — Invoice Total Integrity</h3>
              </div>
              <span className={`text-sm font-medium ${diffLabel(data.checks.subtotals).cls}`}>
                {diffLabel(data.checks.subtotals).text}
              </span>
            </div>
            <p className="text-sm text-zinc-400">
              Verifies every invoice: <span className="text-zinc-200">Grand Total = Subtotal − Discount + Tax</span>
              {' '}across all <span className="text-zinc-200">{data.subtotal.count}</span> invoices.
              {Math.abs(data.checks.subtotals) <= THRESHOLD
                ? ' All invoices compute correctly.'
                : ` Total accumulated error: QAR ${data.checks.subtotals.toFixed(4)}`}
            </p>
          </div>

          {/* CHECK 4: Cash Flow */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-teal-400 shrink-0" />
              <h3 className="font-semibold text-white">Check 4 — Cash Flow Summary</h3>
              <span className="text-xs text-zinc-500 ml-1">(informational)</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Cash Sales Received</p>
                <p className="text-green-400">+{fmt(data.cash.cashSalesReceived)}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Cash Collections (AR payments)</p>
                <p className="text-green-400">+{fmt(data.cash.cashCollections)}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Total Cash In</p>
                <p className="font-bold text-green-400">{fmt(data.cash.cashIn)}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Cash Expenses</p>
                <p className="text-red-400">-{fmt(data.cash.cashExpenses)}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Cash PO Payments</p>
                <p className="text-red-400">-{fmt(data.cash.cashPOPayments)}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Net Cash</p>
                <p className={`font-bold ${data.cash.netCash >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(data.cash.netCash)}</p>
              </div>
            </div>
          </div>

          {/* CHECK 5: AP Reconciliation */}
          <div className={`rounded-xl border p-5 ${statusClass(data.checks.ap)}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <StatusIcon diff={data.checks.ap} />
                <h3 className="font-semibold text-white">Check 5 — Accounts Payable Balance</h3>
              </div>
              <span className={`text-sm font-medium ${diffLabel(data.checks.ap).cls}`}>
                {diffLabel(data.checks.ap).text}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Total PO Invoiced</p>
                <p className="font-bold text-white">{fmt(data.ap.totalInvoiced)}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Total PO Paid</p>
                <p className="text-green-400">{fmt(data.ap.totalPaid)}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Expected AP (Invoiced − Paid)</p>
                <p className="text-red-400">{fmt(data.ap.expected)}</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Actual AP (Unpaid balances)</p>
                <p className={`font-bold ${Math.abs(data.checks.ap) <= THRESHOLD ? 'text-green-400' : 'text-red-400'}`}>{fmt(data.ap.actual)}</p>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
