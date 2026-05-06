import { useEffect, useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { User, Phone, Mail, MapPin, Printer } from 'lucide-react'
import { useStoreSettings } from '../../hooks/useStoreSettings'

const fmt = (n) => `QR ${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
const fmtCurrencyScreen = (n) => `QAR ${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '-'

const DARK = '#111111'
const GRAY = '#444444'
const LIGHT_GRAY = '#666666'
const HEADER_BG = '#4a90c4'

const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  credit: 'Credit',
  credit_note: 'Credit Note',
  discount: 'Discount',
}

export function CustomerView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { settings: store } = useStoreSettings()
  const [customer, setCustomer] = useState(null)
  const [sales, setSales] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    fetchCustomer()
  }, [id])

  const fetchCustomer = async () => {
    try {
      const customerRes = await supabase.from('customers').select('*').eq('id', id).single()
      if (customerRes.error) throw customerRes.error
      setCustomer(customerRes.data)

      const salesRes = await supabase
        .from('sales')
        .select('*')
        .eq('customer_id', id)
        .eq('status', 'completed')
        .order('sale_date', { ascending: false })
      setSales(salesRes.data || [])

      const saleIds = (salesRes.data || []).map((s) => s.id)
      if (saleIds.length) {
        const paymentsRes = await supabase
          .from('sale_payments')
          .select('*')
          .in('sale_id', saleIds)
          .order('payment_date', { ascending: true })
        setPayments(paymentsRes.data || [])
      } else {
        setPayments([])
      }
    } catch (error) {
      console.error('Error fetching customer:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id)
      if (error) throw error
      navigate('/customers')
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('Failed to delete customer')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const typeLabels = {
    retail: { label: 'Retail', class: 'bg-blue-900/50 text-blue-400 border border-blue-500/30' },
    wholesale: { label: 'Wholesale', class: 'bg-purple-900/50 text-purple-400 border border-purple-500/30' },
  }

  // ─── Build the full chronological ledger across all transactions ───
  // For each sale: emit one "invoice" debit row; if any portion of amount_paid wasn't recorded
  // as an explicit sale_payments entry (i.e. it was the initial payment captured at sale time),
  // emit it as a separate credit row at the sale_date.
  const allRows = useMemo(() => {
    const paymentsBySale = {}
    payments.forEach((p) => {
      if (!paymentsBySale[p.sale_id]) paymentsBySale[p.sale_id] = []
      paymentsBySale[p.sale_id].push(p)
    })

    const rows = []
    sales.forEach((sale) => {
      rows.push({
        date: sale.sale_date,
        sortKey: `${sale.sale_date}_0_${sale.id}`,
        type: 'invoice',
        doc: sale.invoice_number,
        description: 'Sale',
        method: sale.payment_method,
        debit: parseFloat(sale.grand_total) || 0,
        credit: 0,
      })

      const explicitSum = (paymentsBySale[sale.id] || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0)
      const totalPaid = parseFloat(sale.amount_paid) || 0
      const initial = Math.max(0, totalPaid - explicitSum)
      if (initial > 0.001) {
        rows.push({
          date: sale.sale_date,
          sortKey: `${sale.sale_date}_1_${sale.id}_initial`,
          type: 'payment',
          doc: sale.invoice_number,
          description: 'Payment at sale',
          method: sale.payment_method,
          debit: 0,
          credit: initial,
        })
      }

      ;(paymentsBySale[sale.id] || []).forEach((p) => {
        const isDiscount = p.payment_method === 'discount'
        const isCreditNote = p.payment_method === 'credit_note'
        // Doc # priority: receipt number > credit-note ref > parent invoice
        const doc = p.receipt_number
          ? p.receipt_number
          : isCreditNote && p.reference
            ? p.reference
            : sale.invoice_number
        rows.push({
          date: p.payment_date,
          sortKey: `${p.payment_date}_2_${p.id}`,
          type: isDiscount ? 'discount' : isCreditNote ? 'credit_note' : 'payment',
          doc,
          description: isDiscount ? 'Settlement discount' : isCreditNote ? 'Credit note (return)' : 'Payment received',
          method: p.payment_method,
          reference: p.reference,
          notes: p.notes,
          parentInvoice: sale.invoice_number,
          receiptNumber: p.receipt_number || null,
          debit: 0,
          credit: parseFloat(p.amount || 0),
        })
      })
    })

    rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    return rows
  }, [sales, payments])

  // Slice the ledger to the picked date range, computing the opening balance
  // from everything strictly before `fromDate`.
  const ledgerView = useMemo(() => {
    let opening = 0
    const period = []
    let periodDebit = 0
    let periodCredit = 0
    for (const r of allRows) {
      if (fromDate && r.date < fromDate) {
        opening += r.debit - r.credit
        continue
      }
      if (toDate && r.date > toDate) continue
      period.push(r)
      periodDebit += r.debit
      periodCredit += r.credit
    }
    let bal = opening
    const withBalance = period.map((r) => {
      bal += r.debit - r.credit
      return { ...r, balance: bal }
    })
    return { opening, rows: withBalance, periodDebit, periodCredit, closing: opening + periodDebit - periodCredit }
  }, [allRows, fromDate, toDate])

  // ─── Outstanding aging buckets (per-invoice balance × age) ───
  const aging = useMemo(() => {
    const buckets = { current: 0, b30: 0, b60: 0, b90: 0, b90plus: 0 }
    const today = new Date()
    sales.forEach((sale) => {
      const total = parseFloat(sale.grand_total) || 0
      const paid = parseFloat(sale.amount_paid) || 0
      const bal = total - paid
      if (bal <= 0.01) return
      const days = Math.max(0, Math.floor((today - new Date(sale.sale_date)) / (1000 * 60 * 60 * 24)))
      if (days <= 30) buckets.current += bal
      else if (days <= 60) buckets.b30 += bal
      else if (days <= 90) buckets.b60 += bal
      else buckets.b90plus += bal
    })
    return buckets
  }, [sales])

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }

  if (!customer) {
    return <div className="text-center py-8"><p className="text-zinc-500">Customer not found.</p><Link to="/customers" className="text-teal-600 hover:underline">Back to list</Link></div>
  }

  const totalSpent = sales.reduce((sum, s) => sum + parseFloat(s.grand_total || 0), 0)
  const totalPaid = sales.reduce((sum, s) => sum + parseFloat(s.amount_paid || 0), 0)
  const closingBalance = totalSpent - totalPaid
  const generatedAt = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')

  return (
    <div className="max-w-4xl mx-auto print-area">
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-zinc-200 mb-4">Delete Customer</h3>
            <p className="text-zinc-400 mb-6">Are you sure you want to delete <strong>{customer.name}</strong>?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className="px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 print-hide">
        <div>
          <Link to="/customers" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to list</Link>
          <h1 className="text-xl lg:text-2xl font-bold text-white">{customer.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Link to={`/customers/${id}/edit`} className="flex-1 sm:flex-none text-center px-4 py-2 text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-md hover:bg-teal-500/20">Edit</Link>
          <button onClick={() => setShowDeleteModal(true)} className="flex-1 sm:flex-none px-4 py-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20">Delete</button>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6 print-hide">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-zinc-400 uppercase mb-1">Statement Period</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="From" className="bg-zinc-800/50 border border-zinc-700 rounded-md text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="To" className="bg-zinc-800/50 border border-zinc-700 rounded-md text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {fromDate || toDate ? `Showing ${fromDate || '…'} → ${toDate || '…'}` : 'All transactions'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(fromDate || toDate) && (
              <button onClick={() => { setFromDate(''); setToDate('') }} className="px-3 py-2 text-sm text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">
                Reset
              </button>
            )}
            <button onClick={() => {
              const now = new Date()
              const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
              const last = now.toISOString().split('T')[0]
              setFromDate(first); setToDate(last)
            }} className="px-3 py-2 text-sm text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">
              This month
            </button>
            <button onClick={() => window.print()} className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-md hover:from-teal-500 hover:to-teal-400">
              <Printer className="w-4 h-4" /> Print Statement
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6 print-hide">
        <span className={`px-3 py-1.5 text-sm font-medium rounded-lg ${typeLabels[customer.customer_type]?.class}`}>
          {typeLabels[customer.customer_type]?.label}
        </span>
        <span className={`px-3 py-1.5 text-sm font-medium rounded-lg ${customer.is_active ? 'bg-green-900/50 text-green-400 border border-green-500/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
          {customer.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-hide">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-teal-400" />
            Contact Information
          </h2>
          <div className="space-y-3">
            {customer.phone && <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-zinc-500" /><span className="text-zinc-300">{customer.phone}</span></div>}
            {customer.email && <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-zinc-500" /><span className="text-zinc-300">{customer.email}</span></div>}
            {customer.address && <div className="flex items-start gap-3"><MapPin className="w-4 h-4 text-zinc-500 mt-0.5" /><span className="text-zinc-300 whitespace-pre-wrap">{customer.address}</span></div>}
            {customer.notes && <div className="pt-2 border-t border-zinc-800"><p className="text-sm text-zinc-400">{customer.notes}</p></div>}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4">Account Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-zinc-500">Total Invoiced</span><span className="text-lg font-bold text-white">{fmtCurrencyScreen(totalSpent)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Total Settled</span><span className="text-lg font-bold text-green-400">{fmtCurrencyScreen(totalPaid)}</span></div>
            <div className="flex justify-between border-t border-zinc-800 pt-3">
              <span className="text-zinc-300 font-medium">Outstanding Balance</span>
              <span className={`text-xl font-bold ${closingBalance > 0.01 ? 'text-red-400' : 'text-green-400'}`}>{fmtCurrencyScreen(closingBalance)}</span>
            </div>
            <div className="flex justify-between"><span className="text-zinc-500 text-sm">Invoices</span><span className="text-sm text-zinc-300">{sales.length}</span></div>
          </div>
        </div>
      </div>

      {sales.length > 0 && (
        <div className="mt-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 print-hide">
          <h2 className="text-lg font-medium text-white mb-4">Sales History</h2>
          <div className="space-y-2">
            {sales.slice(0, 20).map((sale) => {
              const bal = (parseFloat(sale.grand_total) || 0) - (parseFloat(sale.amount_paid) || 0)
              return (
                <Link key={sale.id} to={`/sales/${sale.id}`} className="flex items-center justify-between bg-zinc-800/30 rounded-lg p-3 hover:bg-zinc-800/50 transition-colors">
                  <div>
                    <span className="text-sm text-teal-400 font-medium">{sale.invoice_number}</span>
                    <span className="text-sm text-zinc-500 ml-3">{new Date(sale.sale_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {bal > 0.01 && <span className="text-xs text-red-400">Bal: {fmtCurrencyScreen(bal)}</span>}
                    <span className="font-medium text-white">{fmtCurrencyScreen(sale.grand_total)}</span>
                  </div>
                </Link>
              )
            })}
            {sales.length > 20 && <p className="text-xs text-zinc-500 text-center pt-2">Showing first 20 of {sales.length}. Print statement for the full history.</p>}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          PRINT-ONLY CUSTOMER STATEMENT
      ══════════════════════════════════════════════════════════════════ */}
      <div className="print-only" style={{
        fontFamily: 'Arial, sans-serif',
        color: DARK,
        background: '#ffffff',
        padding: '18mm 16mm 14mm 16mm',
        fontSize: '13px',
        lineHeight: '1.5',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}>
        {/* Store header */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '4px', textTransform: 'uppercase', color: DARK }}>
            {store.store_name || 'BINTHAWAR ERP'}
          </div>
          {store.address && (
            <div style={{ color: GRAY, lineHeight: '1.5', whiteSpace: 'pre-wrap', fontSize: '12px' }}>{store.address}</div>
          )}
          <div style={{ color: GRAY, fontSize: '12px', lineHeight: '1.5', marginTop: '2px' }}>
            {store.phone && <span>Phone: {store.phone}</span>}
            {store.phone && store.email && <span>{'  |  '}</span>}
            {store.email && <span>Email: {store.email}</span>}
          </div>
        </div>

        <div style={{ height: '2px', backgroundColor: '#222222', marginBottom: '10px' }} />

        <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: '700', marginBottom: '14px', letterSpacing: '2px', textTransform: 'uppercase' }}>
          CUSTOMER STATEMENT
        </div>

        {/* Bill-to + statement details */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '11px', color: GRAY, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>Statement For</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: DARK }}>{customer.name}</div>
            {customer.address && <div style={{ fontSize: '12px', color: GRAY, marginTop: '2px', whiteSpace: 'pre-wrap' }}>{customer.address}</div>}
            {customer.phone && <div style={{ fontSize: '12px', color: GRAY }}>Tel: {customer.phone}</div>}
            {customer.email && <div style={{ fontSize: '12px', color: GRAY }}>{customer.email}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: GRAY, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>Statement Details</div>
            <div style={{ fontSize: '12px', marginBottom: '2px', color: DARK }}>Date: <strong>{generatedAt}</strong></div>
            <div style={{ fontSize: '12px', marginBottom: '2px', color: DARK }}>
              Period: <strong>{fromDate || toDate ? `${fmtDate(fromDate) || '…'} to ${fmtDate(toDate) || '…'}` : 'All transactions'}</strong>
            </div>
            <div style={{ fontSize: '12px', color: DARK }}>Customer ID: <strong>{customer.id.substring(0, 8)}</strong></div>
          </div>
        </div>

        {/* Account snapshot — period totals when filtered, all-time otherwise */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px', border: '1px solid #cccccc' }}>
          <tbody>
            <tr>
              {fromDate && (
                <>
                  <td style={{ padding: '8px 10px', backgroundImage: 'linear-gradient(#f5f5f5, #f5f5f5)', borderRight: '1px solid #cccccc', fontSize: '10px', color: GRAY, textTransform: 'uppercase', fontWeight: 700 }}>Opening Balance</td>
                  <td style={{ padding: '8px 10px', borderRight: '1px solid #cccccc', fontSize: '13px', fontWeight: 700, color: DARK }}>{fmt(ledgerView.opening)}</td>
                </>
              )}
              <td style={{ padding: '8px 10px', backgroundImage: 'linear-gradient(#f5f5f5, #f5f5f5)', borderRight: '1px solid #cccccc', fontSize: '10px', color: GRAY, textTransform: 'uppercase', fontWeight: 700 }}>Invoiced</td>
              <td style={{ padding: '8px 10px', borderRight: '1px solid #cccccc', fontSize: '13px', fontWeight: 700, color: DARK }}>{fmt(ledgerView.periodDebit)}</td>
              <td style={{ padding: '8px 10px', backgroundImage: 'linear-gradient(#f5f5f5, #f5f5f5)', borderRight: '1px solid #cccccc', fontSize: '10px', color: GRAY, textTransform: 'uppercase', fontWeight: 700 }}>Settled</td>
              <td style={{ padding: '8px 10px', borderRight: '1px solid #cccccc', fontSize: '13px', fontWeight: 700, color: DARK }}>{fmt(ledgerView.periodCredit)}</td>
              <td style={{ padding: '8px 10px', backgroundImage: 'linear-gradient(#f5f5f5, #f5f5f5)', fontSize: '10px', color: GRAY, textTransform: 'uppercase', fontWeight: 700 }}>Closing Balance</td>
              <td style={{ padding: '8px 10px', fontSize: '14px', fontWeight: 700, color: ledgerView.closing > 0.01 ? '#cc0000' : DARK }}>{fmt(ledgerView.closing)}</td>
            </tr>
          </tbody>
        </table>

        {/* Ledger */}
        {ledgerView.rows.length === 0 && Math.abs(ledgerView.opening) < 0.01 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: GRAY, fontSize: '12px', border: '1px solid #cccccc' }}>
            No transactions in this period.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px' }}>
            <thead>
              <tr>
                {[
                  { label: 'Date',         align: 'left',   width: '70px' },
                  { label: 'Doc #',        align: 'left',   width: '110px' },
                  { label: 'Description',  align: 'left',   width: null   },
                  { label: 'Debit',        align: 'right',  width: '85px' },
                  { label: 'Credit',       align: 'right',  width: '85px' },
                  { label: 'Balance',      align: 'right',  width: '95px' },
                ].map((col) => (
                  <th key={col.label} style={{
                    backgroundImage: `linear-gradient(${HEADER_BG}, ${HEADER_BG})`,
                    color: '#ffffff',
                    padding: '7px 8px',
                    textAlign: col.align,
                    fontWeight: '700',
                    fontSize: '11px',
                    width: col.width || undefined,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fromDate && (
                <tr>
                  <td colSpan={5} style={{ padding: '6px 8px', backgroundImage: 'linear-gradient(#eeeeee, #eeeeee)', borderBottom: '1px solid #cccccc', fontWeight: 700, color: DARK, fontSize: '12px' }}>
                    Opening Balance ({fmtDate(fromDate)})
                  </td>
                  <td style={{ padding: '6px 8px', backgroundImage: 'linear-gradient(#eeeeee, #eeeeee)', borderBottom: '1px solid #cccccc', textAlign: 'right', fontWeight: 700, fontSize: '12px', color: ledgerView.opening > 0.01 ? '#cc0000' : DARK }}>
                    {fmt(ledgerView.opening)}
                  </td>
                </tr>
              )}
              {ledgerView.rows.map((row, i) => {
                const bg = i % 2 === 0 ? '#ffffff' : '#f8f8f8'
                const cell = {
                  backgroundImage: `linear-gradient(${bg}, ${bg})`,
                  borderBottom: '1px solid #dddddd',
                  verticalAlign: 'middle',
                  padding: '6px 8px',
                  color: DARK,
                  fontSize: '12px',
                }
                const methodLabel = PAYMENT_METHOD_LABELS[row.method] || row.method
                const baseDesc = row.method && row.type !== 'invoice'
                  ? `${row.description} (${methodLabel})`
                  : row.description
                // For payment-type rows whose Doc # is the receipt number, surface
                // the linked invoice in the description so the trail back to the
                // sale is preserved.
                const reInvoice = row.type !== 'invoice' && row.parentInvoice && row.doc !== row.parentInvoice
                  ? ` — Re: ${row.parentInvoice}`
                  : ''
                const desc = `${baseDesc}${reInvoice}${row.notes ? ` — ${row.notes}` : ''}`
                return (
                  <tr key={i}>
                    <td style={cell}>{fmtDate(row.date)}</td>
                    <td style={{ ...cell, fontWeight: row.type === 'invoice' ? 700 : 400 }}>{row.doc}</td>
                    <td style={{ ...cell, color: row.type === 'invoice' ? DARK : LIGHT_GRAY }}>{desc}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{row.debit > 0 ? fmt(row.debit) : ''}</td>
                    <td style={{ ...cell, textAlign: 'right', color: row.credit > 0 ? '#0a7a3a' : DARK }}>{row.credit > 0 ? fmt(row.credit) : ''}</td>
                    <td style={{ ...cell, textAlign: 'right', fontWeight: 700, color: row.balance > 0.01 ? '#cc0000' : DARK }}>{fmt(row.balance)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ padding: '8px', fontWeight: '700', color: DARK, fontSize: '12px', borderTop: '2px solid #aaaaaa' }}>Closing Balance{toDate ? ` (${fmtDate(toDate)})` : ''}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: DARK, fontSize: '12px', borderTop: '2px solid #aaaaaa' }}>{fmt(ledgerView.periodDebit)}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', color: '#0a7a3a', fontSize: '12px', borderTop: '2px solid #aaaaaa' }}>{fmt(ledgerView.periodCredit)}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700', fontSize: '14px', color: ledgerView.closing > 0.01 ? '#cc0000' : DARK, borderTop: '2px solid #aaaaaa' }}>{fmt(ledgerView.closing)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        {/* Aging summary */}
        {closingBalance > 0.01 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px', border: '1px solid #cccccc' }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 8px', backgroundImage: 'linear-gradient(#f5f5f5, #f5f5f5)', borderRight: '1px solid #cccccc', borderBottom: '1px solid #cccccc', fontSize: '10px', color: GRAY, textTransform: 'uppercase', fontWeight: 700, textAlign: 'left' }}>Aging</th>
                <th style={{ padding: '6px 8px', backgroundImage: 'linear-gradient(#f5f5f5, #f5f5f5)', borderRight: '1px solid #cccccc', borderBottom: '1px solid #cccccc', fontSize: '11px', textAlign: 'right' }}>Current (0–30)</th>
                <th style={{ padding: '6px 8px', backgroundImage: 'linear-gradient(#f5f5f5, #f5f5f5)', borderRight: '1px solid #cccccc', borderBottom: '1px solid #cccccc', fontSize: '11px', textAlign: 'right' }}>31–60</th>
                <th style={{ padding: '6px 8px', backgroundImage: 'linear-gradient(#f5f5f5, #f5f5f5)', borderRight: '1px solid #cccccc', borderBottom: '1px solid #cccccc', fontSize: '11px', textAlign: 'right' }}>61–90</th>
                <th style={{ padding: '6px 8px', backgroundImage: 'linear-gradient(#f5f5f5, #f5f5f5)', borderBottom: '1px solid #cccccc', fontSize: '11px', textAlign: 'right' }}>90+</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '8px', borderRight: '1px solid #cccccc', fontSize: '11px', fontWeight: 700, color: GRAY, textTransform: 'uppercase' }}>Outstanding</td>
                <td style={{ padding: '8px', borderRight: '1px solid #cccccc', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: DARK }}>{fmt(aging.current)}</td>
                <td style={{ padding: '8px', borderRight: '1px solid #cccccc', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: DARK }}>{fmt(aging.b30)}</td>
                <td style={{ padding: '8px', borderRight: '1px solid #cccccc', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: DARK }}>{fmt(aging.b60)}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: aging.b90plus > 0 ? '#cc0000' : DARK }}>{fmt(aging.b90plus)}</td>
              </tr>
            </tbody>
          </table>
        )}

        <div style={{ marginTop: '20px', fontSize: '11px', color: LIGHT_GRAY, borderTop: '1px solid #dddddd', paddingTop: '8px', textAlign: 'center' }}>
          Please contact us if you have any questions about this statement.
        </div>
      </div>
    </div>
  )
}
