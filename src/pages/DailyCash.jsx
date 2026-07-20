import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStoreSettings } from '../hooks/useStoreSettings'
import { Banknote, CreditCard, ArrowUpRight, ArrowDownRight, TrendingUp, Printer } from 'lucide-react'

export function DailyCash() {
  const { settings: store } = useStoreSettings()
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [salesData, setSalesData] = useState([])
  const [expensesData, setExpensesData] = useState([])
  const [collectionsData, setCollectionsData] = useState([])
  const [openingCollectionsData, setOpeningCollectionsData] = useState([])
  const [poPaymentsData, setPoPaymentsData] = useState([])
  const [salesReturnsData, setSalesReturnsData] = useState([])
  const [purchaseReturnsData, setPurchaseReturnsData] = useState([])
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

      const [salesRes, expensesRes, collectionsRes, openingCollectionsRes, poPaymentsRes, salesReturnsRes, purchaseReturnsRes] = await Promise.all([
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
          .select('id, sale_id, amount, payment_method, payment_date, reference, sales!sale_id(customer_name)')
          .gte('payment_date', from)
          .lte('payment_date', to)
          .order('created_at', { ascending: false })
          .then(res => res)
          .catch(() => ({ data: [], error: null })),

        // Opening-balance collections for the date(s)
        supabase
          .from('customer_payments')
          .select('id, customer_id, amount, payment_method, payment_date, reference, customers!customer_id(name)')
          .gte('payment_date', from)
          .lte('payment_date', to)
          .order('created_at', { ascending: false })
          .then(res => res)
          .catch(() => ({ data: [], error: null })),

        // PO payments for the date(s)
        supabase
          .from('po_payments')
          .select('id, po_id, amount, payment_method, payment_date, reference, purchase_orders!po_id(po_number, supplier_name)')
          .gte('payment_date', from)
          .lte('payment_date', to)
          .order('created_at', { ascending: false })
          .then(res => res)
          .catch(() => ({ data: [], error: null })),

        // Sales returns / refunds for the date(s)
        supabase
          .from('sales_returns')
          .select('id, return_number, customer_name, amount_refunded, refund_method, refund_status, return_date')
          .gte('return_date', from)
          .lte('return_date', to)
          .order('created_at', { ascending: false })
          .then(res => res)
          .catch(() => ({ data: [], error: null })),

        // Purchase returns / refunds for the date(s) — cash refund from a supplier is money IN
        supabase
          .from('purchase_returns')
          .select('id, return_number, supplier_name, amount_refunded, refund_method, refund_status, return_date')
          .gte('return_date', from)
          .lte('return_date', to)
          .order('created_at', { ascending: false })
          .then(res => res)
          .catch(() => ({ data: [], error: null })),
      ])

      setSalesData(salesRes.data || [])
      setExpensesData(expensesRes.data || [])
      setCollectionsData(collectionsRes.data || [])
      setOpeningCollectionsData(openingCollectionsRes.data || [])
      setPoPaymentsData(poPaymentsRes.data || [])
      setSalesReturnsData(salesReturnsRes.data || [])
      setPurchaseReturnsData(purchaseReturnsRes.data || [])
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

  const cashOpeningCollections = openingCollectionsData
    .filter((c) => c.payment_method === 'cash')
    .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0)

  const cardOpeningCollections = openingCollectionsData
    .filter((c) => c.payment_method === 'card')
    .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0)

  const bankOpeningCollections = openingCollectionsData
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

  // Sales returns that actually paid money out — refunded with a real method (cash/card/bank).
  // Credit-note refunds reduce AR on paper and bring no cash out, so they're excluded.
  const refundedReturns = salesReturnsData.filter(
    (r) =>
      r.refund_status === 'refunded' &&
      parseFloat(r.amount_refunded || 0) > 0 &&
      (r.refund_method === 'cash' || r.refund_method === 'card' || r.refund_method === 'bank_transfer')
  )

  const cashRefunds = refundedReturns
    .filter((r) => r.refund_method === 'cash')
    .reduce((sum, r) => sum + parseFloat(r.amount_refunded || 0), 0)

  const bankRefunds = refundedReturns
    .filter((r) => r.refund_method !== 'cash')
    .reduce((sum, r) => sum + parseFloat(r.amount_refunded || 0), 0)

  // Purchase returns refunded with a real method bring money IN (supplier pays us back).
  const refundedPurchaseReturns = purchaseReturnsData.filter(
    (r) =>
      r.refund_status === 'refunded' &&
      parseFloat(r.amount_refunded || 0) > 0 &&
      (r.refund_method === 'cash' || r.refund_method === 'card' || r.refund_method === 'bank_transfer')
  )
  const cashPurchaseRefunds = refundedPurchaseReturns
    .filter((r) => r.refund_method === 'cash')
    .reduce((sum, r) => sum + parseFloat(r.amount_refunded || 0), 0)
  const bankPurchaseRefunds = refundedPurchaseReturns
    .filter((r) => r.refund_method !== 'cash')
    .reduce((sum, r) => sum + parseFloat(r.amount_refunded || 0), 0)
  const totalPurchaseRefunds = refundedPurchaseReturns.reduce((sum, r) => sum + parseFloat(r.amount_refunded || 0), 0)

  // Totals
  // Credit sales carry no receipt method for the part paid up front, so their
  // down-payment (amount_paid) is treated as cash in the register.
  const totalCashIn = cashSales + creditSales + cashCollections + cashOpeningCollections + cashPurchaseRefunds
  const totalCashOut = cashExpenses + cashPOPayments + cashRefunds
  const netCash = totalCashIn - totalCashOut

  const totalBankIn =
    bankSales + cardSales + bankCollections + cardCollections + bankOpeningCollections + cardOpeningCollections + bankPurchaseRefunds
  const totalBankOut = bankExpenses + bankPOPayments + bankRefunds
  const netBank = totalBankIn - totalBankOut

  const totalSalesRevenue = salesData.reduce((sum, s) => sum + parseFloat(s.grand_total || 0), 0)
  const totalSalesReceived = salesData.reduce((sum, s) => sum + parseFloat(s.amount_paid || 0), 0)
  const totalExpenses = expensesData.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)
  // Only count money-in collections (cash/card/bank) — discount and credit_note
  // rows are paper adjustments that reduce AR without bringing cash in.
  const realCollections = collectionsData.filter(
    (c) => c.payment_method === 'cash' || c.payment_method === 'card' || c.payment_method === 'bank_transfer'
  )
  const totalCollections = realCollections.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0)
  const realOpeningCollections = openingCollectionsData.filter(
    (c) => c.payment_method === 'cash' || c.payment_method === 'card' || c.payment_method === 'bank_transfer'
  )
  const totalOpeningCollections = realOpeningCollections.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0)
  const totalPOPayments = poPaymentsData.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
  const totalRefunds = refundedReturns.reduce((sum, r) => sum + parseFloat(r.amount_refunded || 0), 0)

  const totalIn = totalSalesReceived + totalCollections + totalOpeningCollections + totalPurchaseRefunds
  const totalOut = totalExpenses + totalPOPayments + totalRefunds
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

  const fmtPrintDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const { from: printFrom, to: printTo } = getDateFilter()
  const printPeriod = viewMode === 'daily' ? fmtPrintDate(selectedDate) : `${fmtPrintDate(printFrom)} — ${fmtPrintDate(printTo)}`

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }

  return (
    <div>
      {/* ══ Printable Report ══ */}
      <div className="hidden print:block print-area">
        <div style={{ padding: '28px 32px' }}>
          <h1 style={{ fontSize: '18pt', fontWeight: 700, marginBottom: '2px', color: '#111' }}>{store.store_name}</h1>
          {store.address && <p style={{ fontSize: '9pt', color: '#666', whiteSpace: 'pre-wrap', margin: 0 }}>{store.address}</p>}
          {(store.phone || store.email) && (
            <p style={{ fontSize: '9pt', color: '#666', margin: 0 }}>
              {store.phone && `Tel: ${store.phone}`}
              {store.phone && store.email && ' | '}
              {store.email}
            </p>
          )}

          <h2 style={{ fontSize: '14pt', fontWeight: 600, marginTop: '12px', marginBottom: '4px', color: '#111' }}>Daily Cash Summary</h2>
          <p style={{ fontSize: '10pt', color: '#666', marginBottom: '20px' }}>{printPeriod}</p>

          {/* Summary */}
          <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', borderBottom: '2px solid #e5e7eb', paddingBottom: '12px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: '8pt', color: '#666', textTransform: 'uppercase', margin: 0 }}>Total Income</p>
              <p style={{ fontSize: '14pt', fontWeight: 700, color: '#16a34a', margin: 0 }}>{formatCurrency(totalIn)}</p>
            </div>
            <div>
              <p style={{ fontSize: '8pt', color: '#666', textTransform: 'uppercase', margin: 0 }}>Total Expenses</p>
              <p style={{ fontSize: '14pt', fontWeight: 700, color: '#dc2626', margin: 0 }}>{formatCurrency(totalOut)}</p>
            </div>
            <div>
              <p style={{ fontSize: '8pt', color: '#666', textTransform: 'uppercase', margin: 0 }}>Net</p>
              <p style={{ fontSize: '14pt', fontWeight: 700, color: netTotal >= 0 ? '#16a34a' : '#dc2626', margin: 0 }}>{formatCurrency(netTotal)}</p>
            </div>
            <div>
              <p style={{ fontSize: '8pt', color: '#666', textTransform: 'uppercase', margin: 0 }}>Sales Revenue</p>
              <p style={{ fontSize: '14pt', fontWeight: 700, color: '#111', margin: 0 }}>{formatCurrency(totalSalesRevenue)}</p>
            </div>
          </div>

          {/* Cash vs Bank breakdown */}
          <div style={{ display: 'flex', gap: '32px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <table style={{ flex: 1, minWidth: '260px', borderCollapse: 'collapse', fontSize: '9pt' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #16a34a' }}>
                  <th colSpan={2} style={{ textAlign: 'left', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>Cash Register</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '5px 6px', color: '#374151' }}>Cash Sales</td><td style={{ padding: '5px 6px', textAlign: 'right', color: '#16a34a' }}>+{formatCurrency(cashSales)}</td></tr>
                {creditSales > 0 && <tr style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '5px 6px', color: '#374151' }}>Credit Sale Payments</td><td style={{ padding: '5px 6px', textAlign: 'right', color: '#16a34a' }}>+{formatCurrency(creditSales)}</td></tr>}
                {cashCollections > 0 && <tr style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '5px 6px', color: '#374151' }}>Cash Collections</td><td style={{ padding: '5px 6px', textAlign: 'right', color: '#16a34a' }}>+{formatCurrency(cashCollections)}</td></tr>}
                {cashOpeningCollections > 0 && <tr style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '5px 6px', color: '#374151' }}>Opening Balance Collections</td><td style={{ padding: '5px 6px', textAlign: 'right', color: '#16a34a' }}>+{formatCurrency(cashOpeningCollections)}</td></tr>}
                {cashExpenses > 0 && <tr style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '5px 6px', color: '#374151' }}>Cash Expenses</td><td style={{ padding: '5px 6px', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(cashExpenses)}</td></tr>}
                {cashPOPayments > 0 && <tr style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '5px 6px', color: '#374151' }}>Cash Supplier Payments</td><td style={{ padding: '5px 6px', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(cashPOPayments)}</td></tr>}
                {cashRefunds > 0 && <tr style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '5px 6px', color: '#374151' }}>Cash Refunds</td><td style={{ padding: '5px 6px', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(cashRefunds)}</td></tr>}
                {cashPurchaseRefunds > 0 && <tr style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '5px 6px', color: '#374151' }}>Purchase Return Refunds</td><td style={{ padding: '5px 6px', textAlign: 'right', color: '#16a34a' }}>+{formatCurrency(cashPurchaseRefunds)}</td></tr>}
                <tr style={{ borderTop: '2px solid #d1d5db' }}><td style={{ padding: '6px', fontWeight: 700, color: '#111' }}>Net Cash</td><td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: netCash >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(netCash)}</td></tr>
              </tbody>
            </table>
            <table style={{ flex: 1, minWidth: '260px', borderCollapse: 'collapse', fontSize: '9pt' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #4a90c4' }}>
                  <th colSpan={2} style={{ textAlign: 'left', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>Bank / Card</th>
                </tr>
              </thead>
              <tbody>
                {cardSales > 0 && <tr style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '5px 6px', color: '#374151' }}>Card Sales</td><td style={{ padding: '5px 6px', textAlign: 'right', color: '#16a34a' }}>+{formatCurrency(cardSales)}</td></tr>}
                {bankSales > 0 && <tr style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '5px 6px', color: '#374151' }}>Bank Transfer Sales</td><td style={{ padding: '5px 6px', textAlign: 'right', color: '#16a34a' }}>+{formatCurrency(bankSales)}</td></tr>}
                {(cardCollections + bankCollections) > 0 && <tr style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '5px 6px', color: '#374151' }}>Bank/Card Collections</td><td style={{ padding: '5px 6px', textAlign: 'right', color: '#16a34a' }}>+{formatCurrency(cardCollections + bankCollections)}</td></tr>}
                {(cardOpeningCollections + bankOpeningCollections) > 0 && <tr style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '5px 6px', color: '#374151' }}>Opening Balance Collections</td><td style={{ padding: '5px 6px', textAlign: 'right', color: '#16a34a' }}>+{formatCurrency(cardOpeningCollections + bankOpeningCollections)}</td></tr>}
                {bankExpenses > 0 && <tr style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '5px 6px', color: '#374151' }}>Bank Expenses</td><td style={{ padding: '5px 6px', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(bankExpenses)}</td></tr>}
                {bankPOPayments > 0 && <tr style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '5px 6px', color: '#374151' }}>Bank Supplier Payments</td><td style={{ padding: '5px 6px', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(bankPOPayments)}</td></tr>}
                {bankRefunds > 0 && <tr style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '5px 6px', color: '#374151' }}>Bank/Card Refunds</td><td style={{ padding: '5px 6px', textAlign: 'right', color: '#dc2626' }}>-{formatCurrency(bankRefunds)}</td></tr>}
                <tr style={{ borderTop: '2px solid #d1d5db' }}><td style={{ padding: '6px', fontWeight: 700, color: '#111' }}>Net Bank</td><td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: netBank >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(netBank)}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Sales */}
          {salesData.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: '18px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #16a34a' }}>
                  <th colSpan={3} style={{ textAlign: 'left', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>Sales ({salesData.length})</th>
                  <th style={{ textAlign: 'right', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>{formatCurrency(totalSalesReceived)}</th>
                </tr>
                <tr style={{ borderBottom: '1px solid #d1d5db' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Invoice</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Customer</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Method</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Received</th>
                </tr>
              </thead>
              <tbody>
                {salesData.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '5px 6px', color: '#111', fontWeight: 500 }}>{s.invoice_number}</td>
                    <td style={{ padding: '5px 6px', color: '#374151' }}>{s.customer_name || 'Walk-in'}</td>
                    <td style={{ padding: '5px 6px', color: '#374151' }}>{paymentMethodLabels[s.payment_method] || s.payment_method}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                      +{formatCurrency(s.amount_paid)}
                      {parseFloat(s.amount_paid) !== parseFloat(s.grand_total) && <span style={{ color: '#999', fontWeight: 400 }}> / {formatCurrency(s.grand_total)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Payment Collections */}
          {realCollections.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: '18px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #16a34a' }}>
                  <th colSpan={3} style={{ textAlign: 'left', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>Payment Collections ({realCollections.length})</th>
                  <th style={{ textAlign: 'right', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>{formatCurrency(totalCollections)}</th>
                </tr>
                <tr style={{ borderBottom: '1px solid #d1d5db' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Customer</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Method</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Reference</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {realCollections.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '5px 6px', color: '#374151' }}>{c.sales?.customer_name || 'Walk-in'}</td>
                    <td style={{ padding: '5px 6px', color: '#374151' }}>{paymentMethodLabels[c.payment_method] || c.payment_method}</td>
                    <td style={{ padding: '5px 6px', color: '#666' }}>{c.reference || '-'}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>+{formatCurrency(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Opening Balance Collections */}
          {realOpeningCollections.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: '18px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #16a34a' }}>
                  <th colSpan={2} style={{ textAlign: 'left', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>Opening Balance Collections ({realOpeningCollections.length})</th>
                  <th style={{ textAlign: 'right', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>{formatCurrency(totalOpeningCollections)}</th>
                </tr>
                <tr style={{ borderBottom: '1px solid #d1d5db' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Customer</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Method</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {realOpeningCollections.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '5px 6px', color: '#374151' }}>{c.customers?.name || 'Customer'}</td>
                    <td style={{ padding: '5px 6px', color: '#374151' }}>{paymentMethodLabels[c.payment_method] || c.payment_method}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>+{formatCurrency(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Expenses */}
          {expensesData.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: '18px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #dc2626' }}>
                  <th colSpan={3} style={{ textAlign: 'left', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>Expenses ({expensesData.length})</th>
                  <th style={{ textAlign: 'right', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>{formatCurrency(totalExpenses)}</th>
                </tr>
                <tr style={{ borderBottom: '1px solid #d1d5db' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Description</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Category</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Method</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {expensesData.map((e) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '5px 6px', color: '#111' }}>{e.description}</td>
                    <td style={{ padding: '5px 6px', color: '#374151' }}>{categoryLabels[e.category] || e.category}</td>
                    <td style={{ padding: '5px 6px', color: '#374151' }}>{paymentMethodLabels[e.payment_method] || e.payment_method}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>-{formatCurrency(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Supplier Payments */}
          {poPaymentsData.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: '18px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #dc2626' }}>
                  <th colSpan={3} style={{ textAlign: 'left', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>Supplier Payments ({poPaymentsData.length})</th>
                  <th style={{ textAlign: 'right', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>{formatCurrency(totalPOPayments)}</th>
                </tr>
                <tr style={{ borderBottom: '1px solid #d1d5db' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>PO #</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Supplier</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Method</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {poPaymentsData.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '5px 6px', color: '#111', fontWeight: 500 }}>{p.purchase_orders?.po_number || '-'}</td>
                    <td style={{ padding: '5px 6px', color: '#374151' }}>{p.purchase_orders?.supplier_name || '-'}</td>
                    <td style={{ padding: '5px 6px', color: '#374151' }}>{paymentMethodLabels[p.payment_method] || p.payment_method}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>-{formatCurrency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Sales Returns / Refunds */}
          {refundedReturns.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: '18px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #dc2626' }}>
                  <th colSpan={3} style={{ textAlign: 'left', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>Sales Returns ({refundedReturns.length})</th>
                  <th style={{ textAlign: 'right', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>{formatCurrency(totalRefunds)}</th>
                </tr>
                <tr style={{ borderBottom: '1px solid #d1d5db' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Return #</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Customer</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Method</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Refunded</th>
                </tr>
              </thead>
              <tbody>
                {refundedReturns.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '5px 6px', color: '#111', fontWeight: 500 }}>{r.return_number}</td>
                    <td style={{ padding: '5px 6px', color: '#374151' }}>{r.customer_name || 'Walk-in'}</td>
                    <td style={{ padding: '5px 6px', color: '#374151' }}>{paymentMethodLabels[r.refund_method] || r.refund_method}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>-{formatCurrency(r.amount_refunded)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Purchase Returns / Refunds — money in from suppliers */}
          {refundedPurchaseReturns.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: '18px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #16a34a' }}>
                  <th colSpan={3} style={{ textAlign: 'left', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>Purchase Returns ({refundedPurchaseReturns.length})</th>
                  <th style={{ textAlign: 'right', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>{formatCurrency(totalPurchaseRefunds)}</th>
                </tr>
                <tr style={{ borderBottom: '1px solid #d1d5db' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Return #</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Supplier</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Method</th>
                  <th style={{ textAlign: 'right', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Refunded</th>
                </tr>
              </thead>
              <tbody>
                {refundedPurchaseReturns.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '5px 6px', color: '#111', fontWeight: 500 }}>{r.return_number}</td>
                    <td style={{ padding: '5px 6px', color: '#374151' }}>{r.supplier_name || '—'}</td>
                    <td style={{ padding: '5px 6px', color: '#374151' }}>{paymentMethodLabels[r.refund_method] || r.refund_method}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>+{formatCurrency(r.amount_refunded)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ══ Screen UI ══ */}
      <div className="print:hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Daily Cash Summary</h1>
        <div className="flex gap-2">
          <button onClick={() => setViewMode('daily')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'daily' ? 'bg-teal-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
            Daily
          </button>
          <button onClick={() => setViewMode('range')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'range' ? 'bg-teal-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
            Date Range
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700 transition-colors">
            <Printer className="w-4 h-4" /> Print
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
              <p className="text-xs text-zinc-500">Total Income</p>
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
              <p className="text-xs text-zinc-500">Total Expenses</p>
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
            {creditSales > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Credit Sale Payments</span><span className="text-green-400">+{formatCurrency(creditSales)}</span></div>}
            {cashCollections > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Cash Collections</span><span className="text-green-400">+{formatCurrency(cashCollections)}</span></div>}
            {cashOpeningCollections > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Opening Balance Collections</span><span className="text-green-400">+{formatCurrency(cashOpeningCollections)}</span></div>}
            {cashExpenses > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Cash Expenses</span><span className="text-red-400">-{formatCurrency(cashExpenses)}</span></div>}
            {cashPOPayments > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Cash Supplier Payments</span><span className="text-red-400">-{formatCurrency(cashPOPayments)}</span></div>}
            {cashRefunds > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Cash Refunds</span><span className="text-red-400">-{formatCurrency(cashRefunds)}</span></div>}
            {cashPurchaseRefunds > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Purchase Return Refunds</span><span className="text-green-400">+{formatCurrency(cashPurchaseRefunds)}</span></div>}
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
            {(cardOpeningCollections + bankOpeningCollections) > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Opening Balance Collections</span><span className="text-green-400">+{formatCurrency(cardOpeningCollections + bankOpeningCollections)}</span></div>}
            {bankExpenses > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Bank Expenses</span><span className="text-red-400">-{formatCurrency(bankExpenses)}</span></div>}
            {bankPOPayments > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Bank Supplier Payments</span><span className="text-red-400">-{formatCurrency(bankPOPayments)}</span></div>}
            {bankRefunds > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Bank/Card Refunds</span><span className="text-red-400">-{formatCurrency(bankRefunds)}</span></div>}
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

        {/* Collections — exclude paper adjustments (discount, credit note) so this stays a cash-in view */}
        {realCollections.length > 0 && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-400 uppercase mb-3">
              Payment Collections ({realCollections.length})
              <span className="ml-2 text-green-400">{formatCurrency(totalCollections)}</span>
            </h3>
            <div className="space-y-2">
              {realCollections.map((c) => (
                <div key={c.id} className="flex items-center justify-between bg-zinc-800/30 rounded-lg p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-zinc-300">{c.sales?.customer_name || 'Collection'}</span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400">{paymentMethodLabels[c.payment_method]}</span>
                    {c.reference && <span className="text-xs text-zinc-500">Ref: {c.reference}</span>}
                  </div>
                  <span className="font-medium text-green-400">+{formatCurrency(c.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opening-balance collections (customer_payments) — settles AR from onboarding */}
        {realOpeningCollections.length > 0 && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-400 uppercase mb-3">
              Opening Balance Collections ({realOpeningCollections.length})
              <span className="ml-2 text-green-400">{formatCurrency(totalOpeningCollections)}</span>
            </h3>
            <div className="space-y-2">
              {realOpeningCollections.map((c) => (
                <div key={c.id} className="flex items-center justify-between bg-zinc-800/30 rounded-lg p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-zinc-300">{c.customers?.name || 'Customer'}</span>
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
                    {p.purchase_orders?.po_number && <span className="text-sm text-teal-400 font-medium">{p.purchase_orders.po_number}</span>}
                    <span className="text-sm text-zinc-300">{p.purchase_orders?.supplier_name || 'PO Payment'}</span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400">{paymentMethodLabels[p.payment_method]}</span>
                    {p.reference && <span className="text-xs text-zinc-500">Ref: {p.reference}</span>}
                  </div>
                  <span className="font-medium text-red-400">-{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sales Returns — refunds that paid money out (cash/card/bank); credit-note refunds excluded */}
        {refundedReturns.length > 0 && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-400 uppercase mb-3">
              Sales Returns ({refundedReturns.length})
              <span className="ml-2 text-red-400">{formatCurrency(totalRefunds)}</span>
            </h3>
            <div className="space-y-2">
              {refundedReturns.map((r) => (
                <div key={r.id} className="flex items-center justify-between bg-zinc-800/30 rounded-lg p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-teal-400 font-medium">{r.return_number}</span>
                    <span className="text-sm text-zinc-300">{r.customer_name || 'Walk-in'}</span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400">{paymentMethodLabels[r.refund_method] || r.refund_method}</span>
                  </div>
                  <span className="font-medium text-red-400">-{formatCurrency(r.amount_refunded)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Purchase Returns — refunds from suppliers that brought money in (cash/card/bank); debit-note refunds excluded */}
        {refundedPurchaseReturns.length > 0 && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-400 uppercase mb-3">
              Purchase Returns ({refundedPurchaseReturns.length})
              <span className="ml-2 text-green-400">{formatCurrency(totalPurchaseRefunds)}</span>
            </h3>
            <div className="space-y-2">
              {refundedPurchaseReturns.map((r) => (
                <div key={r.id} className="flex items-center justify-between bg-zinc-800/30 rounded-lg p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-teal-400 font-medium">{r.return_number}</span>
                    <span className="text-sm text-zinc-300">{r.supplier_name || '—'}</span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400">{paymentMethodLabels[r.refund_method] || r.refund_method}</span>
                  </div>
                  <span className="font-medium text-green-400">+{formatCurrency(r.amount_refunded)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {salesData.length === 0 && expensesData.length === 0 && collectionsData.length === 0 && openingCollectionsData.length === 0 && poPaymentsData.length === 0 && refundedReturns.length === 0 && refundedPurchaseReturns.length === 0 && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
            No transactions for this {viewMode === 'daily' ? 'date' : 'period'}.
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
