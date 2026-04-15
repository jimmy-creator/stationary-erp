import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStoreSettings } from '../../hooks/useStoreSettings'

// ─── Number to words (for invoice footer) ────────────────────────────────────
function numberToWords(amount) {
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ]
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) =>
  `QR ${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '-'

// ─── Inline styles ────────────────────────────────────────────────────────────
const GREEN = '#7ab800'
const DARK = '#111111'
const GRAY = '#444444'   // safe for print on both Mac & Windows
const LIGHT_GRAY = '#666666' // for least-important secondary text

export function SaleView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { settings: store } = useStoreSettings()
  const [sale, setSale] = useState(null)
  const [items, setItems] = useState([])
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => { fetchSale() }, [id])

  const fetchSale = async () => {
    try {
      const [saleRes, itemsRes] = await Promise.all([
        supabase.from('sales').select('*').eq('id', id).single(),
        supabase.from('sale_items').select('*, products(unit, barcode, sku)').eq('sale_id', id),
      ])
      if (saleRes.error) throw saleRes.error
      setSale(saleRes.data)
      setItems(itemsRes.data || [])

      // Fetch customer address if customer_id exists
      if (saleRes.data.customer_id) {
        const { data: cust } = await supabase
          .from('customers')
          .select('address, phone')
          .eq('id', saleRes.data.customer_id)
          .single()
        setCustomer(cust)
      }
    } catch (error) {
      console.error('Error fetching sale:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('sales').delete().eq('id', id)
      if (error) throw error
      navigate('/sales')
    } catch (error) {
      console.error('Error deleting sale:', error)
      alert('Failed to delete sale')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const statusLabels = {
    completed: { label: 'Completed', cls: 'bg-green-900/50 text-green-400' },
    returned:  { label: 'Returned',  cls: 'bg-orange-900/50 text-orange-400' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-900/50 text-red-400' },
  }
  const paymentStatusLabels = {
    paid:    { label: 'Paid',    cls: 'bg-green-900/50 text-green-400' },
    partial: { label: 'Partial', cls: 'bg-yellow-900/50 text-yellow-400' },
    unpaid:  { label: 'Unpaid',  cls: 'bg-red-900/50 text-red-400' },
  }
  const paymentLabels = { cash: 'Cash', card: 'Card', bank_transfer: 'Bank Transfer', credit: 'Credit' }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>
  }
  if (!sale) {
    return <div className="text-center py-8"><p className="text-zinc-500">Sale not found.</p><Link to="/sales" className="text-teal-600 hover:underline">Back to list</Link></div>
  }

  const balanceDue = (sale.grand_total || 0) - (sale.amount_paid || 0)

  return (
    <div className="max-w-4xl mx-auto print-area">

      {/* ── Delete modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-zinc-200 mb-4">Delete Sale</h3>
            <p className="text-zinc-400 mb-6">Are you sure you want to delete <strong>{sale.invoice_number}</strong>?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className="px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Screen action bar ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 print-hide">
        <div>
          <Link to="/sales" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to list</Link>
          <h1 className="text-xl lg:text-2xl font-bold text-white">{sale.invoice_number}</h1>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Link to={`/sales/${id}/edit`} className="flex-1 sm:flex-none text-center px-4 py-2 text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-md hover:bg-teal-500/20">Edit</Link>
          <button onClick={() => setShowDeleteModal(true)} className="flex-1 sm:flex-none px-4 py-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20">Delete</button>
          <button onClick={() => window.print()} className="flex-1 sm:flex-none px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">Print</button>
        </div>
      </div>

      {/* ── Screen summary card ── */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl print-hide">

        <div className="p-4 lg:p-6 border-b border-zinc-800 flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-teal-400">{sale.invoice_number}</p>
            <p className="text-sm text-zinc-400">{fmtDate(sale.sale_date)}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusLabels[sale.status]?.cls}`}>{statusLabels[sale.status]?.label}</span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${paymentStatusLabels[sale.payment_status]?.cls}`}>{paymentStatusLabels[sale.payment_status]?.label}</span>
          </div>
        </div>
        <div className="p-4 lg:p-6 border-b border-zinc-800">
          <p className="text-sm text-zinc-500 mb-1">Customer</p>
          <p className="text-zinc-200 font-medium">{sale.customer_name || 'Walk-in Customer'}</p>
          <p className="text-sm text-zinc-400 mt-1">Payment: {paymentLabels[sale.payment_method]}</p>
          {sale.created_by_email && <p className="text-sm text-zinc-400">Sold by: {sale.created_by_email}</p>}
        </div>
        <div className="p-4 lg:p-6 border-b border-zinc-800 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="pb-2 text-left text-xs text-zinc-500 uppercase">#</th>
                <th className="pb-2 text-left text-xs text-zinc-500 uppercase">Product</th>
                <th className="pb-2 text-center text-xs text-zinc-500 uppercase">Qty</th>
                <th className="pb-2 text-right text-xs text-zinc-500 uppercase">Unit Price</th>
                <th className="pb-2 text-right text-xs text-zinc-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {items.map((item, i) => (
                <tr key={item.id}>
                  <td className="py-2 text-zinc-500">{i + 1}</td>
                  <td className="py-2 text-zinc-200">{item.product_name}</td>
                  <td className="py-2 text-center text-zinc-400">{item.quantity}</td>
                  <td className="py-2 text-right text-zinc-400">{fmt(item.unit_price)}</td>
                  <td className="py-2 text-right font-medium text-zinc-200">{fmt(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 lg:p-6">
          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-zinc-400">Subtotal</span><span className="text-zinc-200">{fmt(sale.subtotal)}</span></div>
              {sale.discount_amount > 0 && <div className="flex justify-between"><span className="text-zinc-400">Discount</span><span className="text-red-400">-{fmt(sale.discount_amount)}</span></div>}
              <div className="flex justify-between text-base font-bold border-t border-zinc-800 pt-2"><span className="text-zinc-200">Grand Total</span><span className="text-teal-400">{fmt(sale.grand_total)}</span></div>
              {sale.payment_status !== 'paid' && <>
                <div className="flex justify-between"><span className="text-zinc-400">Paid</span><span className="text-zinc-200">{fmt(sale.amount_paid)}</span></div>
                <div className="flex justify-between font-bold"><span className="text-zinc-400">Balance Due</span><span className="text-red-400">{fmt(balanceDue)}</span></div>
              </>}
            </div>
          </div>
          {sale.notes && <p className="mt-4 text-sm text-zinc-400"><span className="text-zinc-500">Notes: </span>{sale.notes}</p>}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PRINT-ONLY INVOICE
      ══════════════════════════════════════════════════════════════════ */}
      <div className="print-only" style={{
        fontFamily: 'Arial, sans-serif',
        color: DARK,
        background: '#ffffff',
        padding: '18mm 16mm 14mm 16mm',
        fontSize: '14px',
        lineHeight: '1.5',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        colorAdjust: 'exact',
      }}>

        {/* ── Store Header ── */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '4px', textTransform: 'uppercase', color: DARK }}>
            {store.store_name || 'BINTHAWAR ERP'}
          </div>
          {store.address && (
            <div style={{ color: GRAY, lineHeight: '1.5', whiteSpace: 'pre-wrap', fontSize: '12px' }}>
              {store.address}
            </div>
          )}
          <div style={{ color: GRAY, fontSize: '12px', lineHeight: '1.5', marginTop: '2px' }}>
            {store.phone && <span>Phone no. : {store.phone}</span>}
            {store.phone && store.email && <span>{'  |  '}</span>}
            {store.email && <span>Email : {store.email}</span>}
          </div>
        </div>

        {/* Use div background instead of <hr> — border-color gets overridden by print CSS */}
        <div style={{ height: '2px', backgroundColor: '#222222', marginBottom: '10px' }} />

        {/* ── Invoice Title ── */}
        <div style={{
          textAlign: 'center',
          fontSize: '18px',
          fontWeight: '700',
          color: GREEN,
          marginBottom: '12px',
          letterSpacing: '2px',
          textTransform: 'uppercase',
        }}>
          CASH / CREDIT INVOICE
        </div>

        {/* ── Bill To / Invoice Details ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', color: GRAY, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>Bill To</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: DARK }}>{sale.customer_name || 'Walk-in Customer'}</div>
            {customer?.address && (
              <div style={{ fontSize: '12px', color: GRAY, marginTop: '2px', whiteSpace: 'pre-wrap' }}>{customer.address}</div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: GRAY, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>Invoice Details</div>
            <div style={{ fontSize: '13px', marginBottom: '2px', color: DARK }}>
              Invoice No. : <strong>{sale.invoice_number}</strong>
            </div>
            <div style={{ fontSize: '13px', color: DARK }}>
              Date : <strong>{fmtDate(sale.sale_date)}</strong>
            </div>
          </div>
        </div>

        {/* ── Items Table ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0' }}>
          <thead>
            <tr>
              {[
                { label: '#',            align: 'center', width: '30px'  },
                { label: 'Item Name',    align: 'left',   width: null    },
                { label: 'Item Code',    align: 'left',   width: '100px' },
                { label: 'Qty',          align: 'center', width: '45px'  },
                { label: 'Unit',         align: 'center', width: '45px'  },
                { label: 'Price / Unit', align: 'right',  width: '100px' },
                { label: 'Amount',       align: 'right',  width: '90px'  },
              ].map((col) => (
                <th key={col.label} style={{
                  backgroundColor: GREEN,
                  // box-shadow trick: prints even when "Background graphics" is OFF in Windows Chrome
                  boxShadow: `inset 0 0 0 1000px ${GREEN}`,
                  color: '#ffffff',
                  padding: '7px 8px',
                  textAlign: col.align,
                  fontWeight: '700',
                  fontSize: '12px',
                  width: col.width || undefined,
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact',
                  colorAdjust: 'exact',
                }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const bg = i % 2 === 0 ? '#f5f5f5' : '#ffffff'
              const cell = {
                backgroundColor: bg,
                borderBottom: '1px solid #cccccc',
                verticalAlign: 'middle',
                padding: '6px 8px',
                color: DARK,
                fontSize: '13px',
              }
              const barcode = item.products?.barcode || item.products?.sku || ''
              const unit = item.products?.unit || ''
              return (
                <tr key={item.id}>
                  <td style={{ ...cell, textAlign: 'center', fontWeight: '700' }}>{i + 1}</td>
                  <td style={{ ...cell, fontWeight: '700', fontSize: '13px' }}>{item.product_name}</td>
                  <td style={{ ...cell, fontSize: '12px', color: LIGHT_GRAY }}>{barcode}</td>
                  <td style={{ ...cell, textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ ...cell, textAlign: 'center', color: GRAY }}>{unit}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>
                    QR {parseFloat(item.unit_price || 0).toFixed(4)}
                  </td>
                  <td style={{ ...cell, textAlign: 'right', fontWeight: '700' }}>
                    QR {parseFloat(item.total_price || 0).toFixed(2)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* ── Footer: Amount in Words + Totals ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '2px solid #aaaaaa' }}>
          <tbody>
            <tr>
              {/* Amount in words */}
              <td style={{ padding: '8px 8px', verticalAlign: 'middle', width: '52%', color: DARK }}>
                <span style={{ fontWeight: '700', fontSize: '13px' }}>Invoice Amount in Words: </span>
                <span style={{ fontSize: '13px' }}>{numberToWords(sale.grand_total || 0)}</span>
              </td>
              {/* Totals */}
              <td style={{ padding: '0', verticalAlign: 'top', width: '48%', borderLeft: '1px solid #cccccc' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {sale.discount_amount > 0 && (
                      <tr>
                        <td style={{ padding: '8px 10px', textAlign: 'left',  fontSize: '14px', color: GRAY, borderBottom: '1px solid #dddddd' }}>Discount</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '14px', color: '#cc0000', fontWeight: '700', borderBottom: '1px solid #dddddd' }}>
                          -QR {parseFloat(sale.discount_amount || 0).toFixed(2)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ padding: '6px 8px', textAlign: 'left',  fontSize: '13px', color: GRAY, borderBottom: '1px solid #dddddd' }}>Sub Total</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '13px', color: DARK, borderBottom: '1px solid #dddddd' }}>
                        QR {parseFloat(sale.subtotal || 0).toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 8px', textAlign: 'left',  fontWeight: '700', fontSize: '15px', color: DARK, backgroundColor: '#eeeeee', borderTop: '2px solid #aaaaaa' }}>Total</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: '700', fontSize: '15px', color: DARK, backgroundColor: '#eeeeee', borderTop: '2px solid #aaaaaa' }}>
                        QR {parseFloat(sale.grand_total || 0).toFixed(2)}
                      </td>
                    </tr>
                    {sale.payment_status !== 'paid' && (
                      <>
                        <tr>
                          <td style={{ padding: '6px 8px', textAlign: 'left',  fontSize: '13px', color: GRAY, borderBottom: '1px solid #dddddd' }}>Amount Paid</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '13px', color: DARK, borderBottom: '1px solid #dddddd' }}>
                            QR {parseFloat(sale.amount_paid || 0).toFixed(2)}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ padding: '6px 8px', textAlign: 'left',  fontWeight: '700', fontSize: '13px', color: '#cc0000' }}>Balance Due</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', fontSize: '13px', color: '#cc0000' }}>
                            QR {parseFloat(balanceDue).toFixed(2)}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {sale.notes && (
          <div style={{ marginTop: '14px', fontSize: '13px', color: GRAY, borderTop: '1px solid #dddddd', paddingTop: '10px' }}>
            <strong>Notes:</strong> {sale.notes}
          </div>
        )}
      </div>
    </div>
  )
}
