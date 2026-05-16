import { useEffect, useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Building2, Phone, Mail, MapPin, FileText, Printer } from 'lucide-react'
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
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  debit_note: 'Debit Note',
}

export function SupplierView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isEmployee } = useAuth()
  const { settings: store } = useStoreSettings()
  const [supplier, setSupplier] = useState(null)
  const [orders, setOrders] = useState([])
  const [payments, setPayments] = useState([])
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    fetchSupplier()
  }, [id])

  const fetchSupplier = async () => {
    try {
      const supplierRes = await supabase.from('suppliers').select('*').eq('id', id).single()
      if (supplierRes.error) throw supplierRes.error
      setSupplier(supplierRes.data)

      const ordersRes = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('supplier_id', id)
        .neq('status', 'cancelled')
        .order('po_date', { ascending: false })
      setOrders(ordersRes.data || [])

      const poIds = (ordersRes.data || []).map((o) => o.id)
      if (poIds.length) {
        const paymentsRes = await supabase
          .from('po_payments')
          .select('*')
          .in('po_id', poIds)
          .order('payment_date', { ascending: true })
        setPayments(paymentsRes.data || [])
      } else {
        setPayments([])
      }

      // Pull every completed return tied to this supplier so refunds appear
      // on the statement regardless of method.
      const returnsRes = await supabase
        .from('purchase_returns')
        .select('id, return_number, return_date, po_id, grand_total, refund_method, refund_status, amount_refunded, reason')
        .eq('supplier_id', id)
        .eq('status', 'completed')
        .order('return_date', { ascending: true })
      setReturns(returnsRes.data || [])
    } catch (error) {
      console.error('Error fetching supplier:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id)
      if (error) throw error
      navigate('/suppliers')
    } catch (error) {
      console.error('Error deleting supplier:', error)
      alert('Failed to delete supplier')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  // ─── Build the full chronological ledger across all transactions ───
  // Debits = POs (we owe), credits = our payments + debit-note adjustments.
  const allRows = useMemo(() => {
    const paymentsByPo = {}
    payments.forEach((p) => {
      if (!paymentsByPo[p.po_id]) paymentsByPo[p.po_id] = []
      paymentsByPo[p.po_id].push(p)
    })

    const rows = []
    orders.forEach((po) => {
      rows.push({
        date: po.po_date,
        sortKey: `${po.po_date}_0_${po.id}`,
        type: 'invoice',
        doc: po.po_number,
        description: 'Purchase Order',
        method: null,
        debit: parseFloat(po.grand_total) || 0,
        credit: 0,
      })

      const explicitSum = (paymentsByPo[po.id] || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0)
      const totalPaid = parseFloat(po.amount_paid) || 0
      const initial = Math.max(0, totalPaid - explicitSum)
      if (initial > 0.001) {
        rows.push({
          date: po.po_date,
          sortKey: `${po.po_date}_1_${po.id}_initial`,
          type: 'payment',
          doc: po.po_number,
          description: 'Payment at PO',
          method: null,
          debit: 0,
          credit: initial,
        })
      }

      ;(paymentsByPo[po.id] || []).forEach((p) => {
        // Skip debit-note rows — they're represented by the matching
        // purchase_return entry below to avoid double-counting.
        if (p.payment_method === 'debit_note') return
        const doc = p.receipt_number
          ? p.receipt_number
          : po.po_number
        rows.push({
          date: p.payment_date,
          sortKey: `${p.payment_date}_2_${p.id}`,
          type: 'payment',
          doc,
          description: 'Payment made',
          method: p.payment_method,
          reference: p.reference,
          notes: p.notes,
          parentPo: po.po_number,
          receiptNumber: p.receipt_number || null,
          debit: 0,
          credit: parseFloat(p.amount || 0),
        })
      })
    })

    // Returns: every completed return is a credit (goods sent back reduce what
    // we owe). When the supplier refunded cash/bank_transfer, emit an
    // offsetting debit so the running balance reflects we're square. Debit-note
    // refunds need no offset (the credit row IS the refund mechanism).
    const poById = new Map(orders.map((o) => [o.id, o]))
    returns.forEach((ret) => {
      const parentPoRow = ret.po_id ? poById.get(ret.po_id) : null
      const parentPo = parentPoRow ? parentPoRow.po_number : null
      const grand = parseFloat(ret.grand_total) || 0
      if (grand > 0) {
        rows.push({
          date: ret.return_date,
          sortKey: `${ret.return_date}_3_${ret.id}_return`,
          type: 'return',
          doc: ret.return_number,
          description: 'Purchase return',
          method: ret.refund_method,
          notes: ret.reason || null,
          parentPo,
          debit: 0,
          credit: grand,
        })
      }
      const refunded = parseFloat(ret.amount_refunded) || 0
      const cashRefunded = ret.refund_status === 'refunded'
        && refunded > 0
        && (ret.refund_method === 'cash' || ret.refund_method === 'bank_transfer')
      if (cashRefunded) {
        rows.push({
          date: ret.return_date,
          sortKey: `${ret.return_date}_4_${ret.id}_refund`,
          type: 'refund',
          doc: ret.return_number,
          description: 'Refund received',
          method: ret.refund_method,
          parentPo,
          debit: refunded,
          credit: 0,
        })
      }
    })

    rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    return rows
  }, [orders, payments, returns])

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

  // ─── Outstanding aging buckets (per-PO balance × age, snapshot of today) ───
  const aging = useMemo(() => {
    const buckets = { current: 0, b30: 0, b60: 0, b90: 0, b90plus: 0 }
    const today = new Date()
    orders.forEach((po) => {
      const total = parseFloat(po.grand_total) || 0
      const paid = parseFloat(po.amount_paid) || 0
      const bal = total - paid
      if (bal <= 0.01) return
      const days = Math.max(0, Math.floor((today - new Date(po.po_date)) / (1000 * 60 * 60 * 24)))
      if (days <= 30) buckets.current += bal
      else if (days <= 60) buckets.b30 += bal
      else if (days <= 90) buckets.b60 += bal
      else buckets.b90plus += bal
    })
    return buckets
  }, [orders])

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }

  if (!supplier) {
    return <div className="text-center py-8"><p className="text-zinc-500">Supplier not found.</p><Link to="/suppliers" className="text-teal-600 hover:underline">Back to list</Link></div>
  }

  const totalPurchased = orders.reduce((sum, o) => sum + parseFloat(o.grand_total || 0), 0)
  const totalPaid = orders.reduce((sum, o) => sum + parseFloat(o.amount_paid || 0), 0)
  // Closing balance derived from the full ledger so returns and pending
  // refunds flow through correctly.
  const allDebit = allRows.reduce((s, r) => s + r.debit, 0)
  const allCredit = allRows.reduce((s, r) => s + r.credit, 0)
  const closingBalance = allDebit - allCredit
  const generatedAt = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')

  return (
    <div className="max-w-4xl mx-auto print-area">
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-zinc-200 mb-4">Delete Supplier</h3>
            <p className="text-zinc-400 mb-6">Are you sure you want to delete <strong>{supplier.name}</strong>?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className="px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 print-hide">
        <div>
          <Link to="/suppliers" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to list</Link>
          <h1 className="text-xl lg:text-2xl font-bold text-white">{supplier.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {!isEmployee && <Link to={`/suppliers/${id}/edit`} className="flex-1 sm:flex-none text-center px-4 py-2 text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-md hover:bg-teal-500/20">Edit</Link>}
          {!isEmployee && <button onClick={() => setShowDeleteModal(true)} className="flex-1 sm:flex-none px-4 py-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20">Delete</button>}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6 print-hide">
        <span className={`px-3 py-1.5 text-sm font-medium rounded-lg ${supplier.is_active ? 'bg-green-900/50 text-green-400 border border-green-500/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
          {supplier.is_active ? 'Active' : 'Inactive'}
        </span>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-hide">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-400" />
            Contact Information
          </h2>
          <div className="space-y-3">
            {supplier.contact_person && <div className="flex items-center gap-3"><span className="text-zinc-500">Contact:</span><span className="text-zinc-300">{supplier.contact_person}</span></div>}
            {supplier.phone && <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-zinc-500" /><span className="text-zinc-300">{supplier.phone}</span></div>}
            {supplier.email && <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-zinc-500" /><span className="text-zinc-300">{supplier.email}</span></div>}
            {supplier.address && <div className="flex items-start gap-3"><MapPin className="w-4 h-4 text-zinc-500 mt-0.5" /><span className="text-zinc-300 whitespace-pre-wrap">{supplier.address}</span></div>}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            Account Summary
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-zinc-500">Total Purchased</span><span className="text-lg font-bold text-white">{fmtCurrencyScreen(totalPurchased)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Total Settled</span><span className="text-lg font-bold text-green-400">{fmtCurrencyScreen(totalPaid)}</span></div>
            <div className="flex justify-between border-t border-zinc-800 pt-3">
              <span className="text-zinc-300 font-medium">Outstanding Balance</span>
              <span className={`text-xl font-bold ${closingBalance > 0.01 ? 'text-red-400' : 'text-green-400'}`}>{fmtCurrencyScreen(closingBalance)}</span>
            </div>
            <div className="flex justify-between"><span className="text-zinc-500 text-sm">Purchase Orders</span><span className="text-sm text-zinc-300">{orders.length}</span></div>
            {(supplier.vat_number || supplier.payment_terms) && (
              <div className="pt-3 border-t border-zinc-800 grid grid-cols-2 gap-2 text-sm">
                {supplier.vat_number && <div><p className="text-xs text-zinc-500">VAT Number</p><p className="text-zinc-300">{supplier.vat_number}</p></div>}
                {supplier.payment_terms && <div><p className="text-xs text-zinc-500">Payment Terms</p><p className="text-zinc-300">{supplier.payment_terms}</p></div>}
              </div>
            )}
            {supplier.notes && <div className="pt-2 border-t border-zinc-800"><p className="text-sm text-zinc-400">{supplier.notes}</p></div>}
          </div>
        </div>
      </div>

      {orders.length > 0 && (
        <div className="mt-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 print-hide">
          <h2 className="text-lg font-medium text-white mb-4">Purchase History</h2>
          <div className="space-y-2">
            {orders.slice(0, 20).map((po) => {
              const bal = (parseFloat(po.grand_total) || 0) - (parseFloat(po.amount_paid) || 0)
              return (
                <Link key={po.id} to={`/purchase-orders/${po.id}`} className="flex items-center justify-between bg-zinc-800/30 rounded-lg p-3 hover:bg-zinc-800/50 transition-colors">
                  <div>
                    <span className="text-sm text-teal-400 font-medium">{po.po_number}</span>
                    <span className="text-sm text-zinc-500 ml-3">{new Date(po.po_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {bal > 0.01 && <span className="text-xs text-red-400">Bal: {fmtCurrencyScreen(bal)}</span>}
                    <span className="font-medium text-white">{fmtCurrencyScreen(po.grand_total)}</span>
                  </div>
                </Link>
              )
            })}
            {orders.length > 20 && <p className="text-xs text-zinc-500 text-center pt-2">Showing first 20 of {orders.length}. Print statement for the full history.</p>}
          </div>
        </div>
      )}

      <div className="mt-6 text-xs text-zinc-600 flex gap-4 print-hide">
        <span>Created: {new Date(supplier.created_at).toLocaleDateString()}</span>
        <span>Updated: {new Date(supplier.updated_at).toLocaleDateString()}</span>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PRINT-ONLY SUPPLIER STATEMENT
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
          SUPPLIER STATEMENT
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '11px', color: GRAY, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>Statement For</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: DARK }}>{supplier.name}</div>
            {supplier.address && <div style={{ fontSize: '12px', color: GRAY, marginTop: '2px', whiteSpace: 'pre-wrap' }}>{supplier.address}</div>}
            {supplier.phone && <div style={{ fontSize: '12px', color: GRAY }}>Tel: {supplier.phone}</div>}
            {supplier.email && <div style={{ fontSize: '12px', color: GRAY }}>{supplier.email}</div>}
            {supplier.vat_number && <div style={{ fontSize: '12px', color: GRAY }}>VAT: {supplier.vat_number}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: GRAY, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>Statement Details</div>
            <div style={{ fontSize: '12px', marginBottom: '2px', color: DARK }}>Date: <strong>{generatedAt}</strong></div>
            <div style={{ fontSize: '12px', marginBottom: '2px', color: DARK }}>
              Period: <strong>{fromDate || toDate ? `${fmtDate(fromDate) || '…'} to ${fmtDate(toDate) || '…'}` : 'All transactions'}</strong>
            </div>
            <div style={{ fontSize: '12px', color: DARK }}>Supplier ID: <strong>{supplier.id.substring(0, 8)}</strong></div>
          </div>
        </div>

        {/* Account snapshot */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px', border: '1px solid #cccccc' }}>
          <tbody>
            <tr>
              {fromDate && (
                <>
                  <td style={{ padding: '8px 10px', backgroundImage: 'linear-gradient(#f5f5f5, #f5f5f5)', borderRight: '1px solid #cccccc', fontSize: '10px', color: GRAY, textTransform: 'uppercase', fontWeight: 700 }}>Opening Balance</td>
                  <td style={{ padding: '8px 10px', borderRight: '1px solid #cccccc', fontSize: '13px', fontWeight: 700, color: DARK }}>{fmt(ledgerView.opening)}</td>
                </>
              )}
              <td style={{ padding: '8px 10px', backgroundImage: 'linear-gradient(#f5f5f5, #f5f5f5)', borderRight: '1px solid #cccccc', fontSize: '10px', color: GRAY, textTransform: 'uppercase', fontWeight: 700 }}>Purchased</td>
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
                const methodLabel = row.method ? PAYMENT_METHOD_LABELS[row.method] || row.method : null
                const baseDesc = methodLabel && row.type !== 'invoice'
                  ? `${row.description} (${methodLabel})`
                  : row.description
                const rePo = row.type !== 'invoice' && row.parentPo && row.doc !== row.parentPo
                  ? ` — Re: ${row.parentPo}`
                  : ''
                const desc = `${baseDesc}${rePo}${row.notes ? ` — ${row.notes}` : ''}`
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
                <td style={{ padding: '8px', borderRight: '1px solid #cccccc', fontSize: '11px', fontWeight: 700, color: GRAY, textTransform: 'uppercase' }}>We Owe</td>
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
