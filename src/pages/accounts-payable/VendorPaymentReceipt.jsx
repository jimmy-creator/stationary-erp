import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStoreSettings } from '../../hooks/useStoreSettings'
import { Printer } from 'lucide-react'

const fmt = (n) => `QR ${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
const fmtScreen = (n) => `QAR ${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '-'

const DARK = '#111111'
const GRAY = '#444444'
const LIGHT_GRAY = '#666666'
const GREEN = '#4a90c4'

const METHOD_LABELS = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  debit_note: 'Debit Note',
}

function numberToWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen']
  const tensArr = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  function convert(n) {
    if (n === 0) return ''
    if (n < 20) return ones[n]
    if (n < 100) return tensArr[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '')
  }
  const intPart = Math.floor(Math.abs(amount))
  const fils = Math.round((Math.abs(amount) - intPart) * 100)
  if (intPart === 0 && fils === 0) return 'Zero only'
  let result = ''
  let rem = intPart
  if (rem >= 1000000) { result += convert(Math.floor(rem / 1000000)) + ' Million '; rem = rem % 1000000 }
  if (rem >= 1000) { result += convert(Math.floor(rem / 1000)) + ' Thousand '; rem = rem % 1000 }
  if (rem > 0) result += convert(rem)
  if (fils > 0) result += ' and ' + convert(fils) + ' Fils'
  return result.trim() + ' only'
}

export function VendorPaymentReceipt() {
  const { id } = useParams()
  const { settings: store } = useStoreSettings()
  const [payment, setPayment] = useState(null)
  const [po, setPo] = useState(null)
  const [supplier, setSupplier] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      const { data: pay, error } = await supabase.from('po_payments').select('*').eq('id', id).single()
      if (error) throw error
      setPayment(pay)

      if (pay.po_id) {
        const { data: p } = await supabase
          .from('purchase_orders')
          .select('id, po_number, po_date, supplier_id, supplier_name, grand_total, amount_paid')
          .eq('id', pay.po_id).single()
        setPo(p)
        if (p?.supplier_id) {
          const { data: s } = await supabase
            .from('suppliers').select('name, address, phone, email').eq('id', p.supplier_id).single()
          setSupplier(s)
        }
      }
    } catch (err) {
      console.error('Error fetching vendor payment:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }
  if (!payment) {
    return <div className="text-center py-8"><p className="text-zinc-500">Payment not found.</p><Link to="/accounts-payable" className="text-teal-600 hover:underline">Back</Link></div>
  }

  const isAdjustment = payment.payment_method === 'debit_note'
  const docNumber = payment.receipt_number || (isAdjustment ? `Adjustment ${payment.id.substring(0, 8)}` : `Payment ${payment.id.substring(0, 8)}`)
  const totalPoBalance = po ? parseFloat(po.grand_total || 0) - parseFloat(po.amount_paid || 0) : 0

  return (
    <div className="max-w-3xl mx-auto print-area">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 print-hide">
        <div>
          {po && <Link to={`/accounts-payable/${po.id}/pay`} className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to payment</Link>}
          <h1 className="text-xl lg:text-2xl font-bold text-white">{docNumber}</h1>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button onClick={() => window.print()} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-md hover:from-teal-500 hover:to-teal-400">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 print-hide">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-xs text-zinc-500 uppercase">Voucher</p>
            <p className="text-lg font-semibold text-teal-400">{docNumber}</p>
            <p className="text-sm text-zinc-400">{fmtDate(payment.payment_date)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500 uppercase">Amount Paid</p>
            <p className={`text-2xl font-bold ${isAdjustment ? 'text-amber-400' : 'text-red-400'}`}>{fmtScreen(payment.amount)}</p>
            <p className="text-xs text-zinc-400 mt-1">{METHOD_LABELS[payment.payment_method] || payment.payment_method}</p>
          </div>
        </div>
        {po && (
          <div className="border-t border-zinc-800 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-zinc-500 uppercase">Supplier</p>
              <p className="text-zinc-200">{po.supplier_name}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase">Against PO</p>
              <Link to={`/purchase-orders/${po.id}`} className="text-teal-400 hover:underline">{po.po_number}</Link>
              <span className="text-xs text-zinc-500 ml-2">{fmtDate(po.po_date)}</span>
            </div>
            {payment.reference && (
              <div>
                <p className="text-xs text-zinc-500 uppercase">Reference</p>
                <p className="text-zinc-300">{payment.reference}</p>
              </div>
            )}
            {payment.notes && (
              <div className="sm:col-span-2">
                <p className="text-xs text-zinc-500 uppercase">Notes</p>
                <p className="text-zinc-300">{payment.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Print-only voucher */}
      <div className="print-only" style={{
        fontFamily: 'Arial, sans-serif',
        color: DARK,
        background: '#ffffff',
        padding: '18mm 16mm 14mm 16mm',
        fontSize: '14px',
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
          PAYMENT VOUCHER
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '11px', color: GRAY, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>Paid To</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: DARK }}>{po?.supplier_name || 'Supplier'}</div>
            {supplier?.address && <div style={{ fontSize: '12px', color: GRAY, marginTop: '2px', whiteSpace: 'pre-wrap' }}>{supplier.address}</div>}
            {supplier?.phone && <div style={{ fontSize: '12px', color: GRAY }}>Tel: {supplier.phone}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: GRAY, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>Voucher Details</div>
            <div style={{ fontSize: '12px', marginBottom: '2px', color: DARK }}>Voucher No.: <strong>{docNumber}</strong></div>
            <div style={{ fontSize: '12px', marginBottom: '2px', color: DARK }}>Date: <strong>{fmtDate(payment.payment_date)}</strong></div>
            {po && <div style={{ fontSize: '12px', color: DARK }}>Against PO: <strong>{po.po_number}</strong></div>}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px', border: '1px solid #cccccc' }}>
          <tbody>
            <tr>
              <td style={{ padding: '10px 12px', backgroundImage: 'linear-gradient(#f5f5f5, #f5f5f5)', borderRight: '1px solid #cccccc', fontSize: '11px', color: GRAY, textTransform: 'uppercase', fontWeight: 700, width: '40%' }}>Payment Method</td>
              <td style={{ padding: '10px 12px', fontSize: '14px', fontWeight: 700, color: DARK }}>{METHOD_LABELS[payment.payment_method] || payment.payment_method}</td>
            </tr>
            {payment.reference && (
              <tr>
                <td style={{ padding: '10px 12px', backgroundImage: 'linear-gradient(#f5f5f5, #f5f5f5)', borderRight: '1px solid #cccccc', borderTop: '1px solid #cccccc', fontSize: '11px', color: GRAY, textTransform: 'uppercase', fontWeight: 700 }}>Reference</td>
                <td style={{ padding: '10px 12px', borderTop: '1px solid #cccccc', fontSize: '13px', color: DARK }}>{payment.reference}</td>
              </tr>
            )}
            {payment.notes && (
              <tr>
                <td style={{ padding: '10px 12px', backgroundImage: 'linear-gradient(#f5f5f5, #f5f5f5)', borderRight: '1px solid #cccccc', borderTop: '1px solid #cccccc', fontSize: '11px', color: GRAY, textTransform: 'uppercase', fontWeight: 700 }}>Notes</td>
                <td style={{ padding: '10px 12px', borderTop: '1px solid #cccccc', fontSize: '12px', color: DARK }}>{payment.notes}</td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '12px', backgroundImage: `linear-gradient(${GREEN}, ${GREEN})`, color: '#ffffff', borderTop: '2px solid #aaaaaa', fontSize: '12px', textTransform: 'uppercase', fontWeight: 700, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>Amount Paid</td>
              <td style={{ padding: '12px', backgroundImage: `linear-gradient(${GREEN}, ${GREEN})`, color: '#ffffff', borderTop: '2px solid #aaaaaa', fontSize: '18px', fontWeight: 700, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>QR {parseFloat(payment.amount || 0).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginBottom: '20px', fontSize: '13px', color: DARK }}>
          <strong>Amount in Words:</strong> {numberToWords(payment.amount || 0)}
        </div>

        {po && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px', border: '1px solid #dddddd' }}>
            <tbody>
              <tr>
                <td style={{ padding: '8px 10px', backgroundImage: 'linear-gradient(#f8f8f8, #f8f8f8)', borderRight: '1px solid #dddddd', fontSize: '10px', color: GRAY, textTransform: 'uppercase', fontWeight: 700 }}>PO Total</td>
                <td style={{ padding: '8px 10px', borderRight: '1px solid #dddddd', fontSize: '12px', color: DARK }}>{fmt(po.grand_total)}</td>
                <td style={{ padding: '8px 10px', backgroundImage: 'linear-gradient(#f8f8f8, #f8f8f8)', borderRight: '1px solid #dddddd', fontSize: '10px', color: GRAY, textTransform: 'uppercase', fontWeight: 700 }}>Total Paid</td>
                <td style={{ padding: '8px 10px', borderRight: '1px solid #dddddd', fontSize: '12px', color: '#0a7a3a' }}>{fmt(po.amount_paid)}</td>
                <td style={{ padding: '8px 10px', backgroundImage: 'linear-gradient(#f8f8f8, #f8f8f8)', fontSize: '10px', color: GRAY, textTransform: 'uppercase', fontWeight: 700 }}>Balance Due</td>
                <td style={{ padding: '8px 10px', fontSize: '12px', fontWeight: 700, color: totalPoBalance > 0.01 ? '#cc0000' : DARK }}>{fmt(totalPoBalance)}</td>
              </tr>
            </tbody>
          </table>
        )}

        <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: LIGHT_GRAY }}>
          <div>
            <div style={{ borderTop: '1px solid #999999', width: '180px', paddingTop: '4px' }}>Authorized By</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ borderTop: '1px solid #999999', width: '180px', paddingTop: '4px', display: 'inline-block' }}>Received By (Supplier)</div>
          </div>
        </div>
      </div>
    </div>
  )
}
