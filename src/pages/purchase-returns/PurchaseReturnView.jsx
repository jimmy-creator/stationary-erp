import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStoreSettings } from '../../hooks/useStoreSettings'

const fmt = (n) => `QR ${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '-'

const GREEN = '#4a90c4'
const DARK = '#111111'
const GRAY = '#444444'

export function PurchaseReturnView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { settings: store } = useStoreSettings()
  const [ret, setRet] = useState(null)
  const [items, setItems] = useState([])
  const [parentPo, setParentPo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => { fetchReturn() }, [id])

  const fetchReturn = async () => {
    try {
      const [retRes, itemsRes] = await Promise.all([
        supabase.from('purchase_returns').select('*').eq('id', id).single(),
        supabase.from('purchase_return_items').select('*, products(unit, barcode, sku)').eq('return_id', id),
      ])
      if (retRes.error) throw retRes.error
      setRet(retRes.data)
      setItems(itemsRes.data || [])

      if (retRes.data.po_id) {
        const { data: po } = await supabase.from('purchase_orders').select('id, po_number, po_date, grand_total').eq('id', retRes.data.po_id).single()
        setParentPo(po)
      }
    } catch (error) {
      console.error('Error fetching return:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!ret) return
    setDeleting(true)
    try {
      // Reverse stock + cost: re-add the units we removed, with the same per-unit
      // landed cost we recorded. Aggregate per-product so multiple lines on the
      // same product net out.
      const { data: applied } = await supabase
        .from('purchase_return_items')
        .select('product_id, applied_quantity, applied_landed_cost')
        .eq('return_id', id)

      const aggregate = {}
      ;(applied || []).forEach((line) => {
        const aq = parseFloat(line.applied_quantity) || 0
        const alc = parseFloat(line.applied_landed_cost) || 0
        if (line.product_id && aq > 0) {
          if (!aggregate[line.product_id]) aggregate[line.product_id] = { qty: 0, value: 0 }
          aggregate[line.product_id].qty += aq
          aggregate[line.product_id].value += aq * alc
        }
      })

      const productIds = Object.keys(aggregate)
      if (productIds.length) {
        const { data: prodRows } = await supabase
          .from('products').select('id, stock_quantity, cost_price').in('id', productIds)
        for (const p of prodRows || []) {
          const { qty, value } = aggregate[p.id]
          const oldStock = parseFloat(p.stock_quantity) || 0
          const oldCost = parseFloat(p.cost_price) || 0
          const newStock = Math.max(0, oldStock + qty)
          const newValue = Math.max(0, oldStock * oldCost + value)
          const newCost = newStock > 0 ? Math.round((newValue / newStock) * 100) / 100 : oldCost
          await supabase.from('products').update({ stock_quantity: newStock, cost_price: newCost }).eq('id', p.id)
        }
      }

      // Reverse debit-note row + recompute parent PO balance
      if (ret.po_id && ret.return_number) {
        const { data: poBefore } = await supabase
          .from('purchase_orders').select('grand_total, amount_paid').eq('id', ret.po_id).single()
        const { data: paymentsBefore } = await supabase
          .from('po_payments').select('amount').eq('po_id', ret.po_id)
        const paymentsBeforeSum = (paymentsBefore || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0)
        const initial = Math.max(0, parseFloat(poBefore?.amount_paid || 0) - paymentsBeforeSum)

        await supabase.from('po_payments').delete()
          .eq('po_id', ret.po_id).eq('payment_method', 'debit_note').eq('reference', ret.return_number)

        const { data: paymentsAfter } = await supabase
          .from('po_payments').select('amount').eq('po_id', ret.po_id)
        const paymentsAfterSum = (paymentsAfter || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0)
        const newAmountPaid = initial + paymentsAfterSum
        const grand = parseFloat(poBefore?.grand_total || 0)
        const newStatus = newAmountPaid >= grand - 0.01 ? 'paid' : newAmountPaid > 0 ? 'partial' : 'unpaid'
        await supabase.from('purchase_orders')
          .update({ amount_paid: newAmountPaid, payment_status: newStatus })
          .eq('id', ret.po_id)
      }

      const { error } = await supabase.from('purchase_returns').delete().eq('id', id)
      if (error) throw error
      navigate('/purchase-returns')
    } catch (error) {
      console.error('Error deleting return:', error)
      alert('Failed to delete return')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const statusLabels = {
    completed: { label: 'Completed', cls: 'bg-green-900/50 text-green-400' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-900/50 text-red-400' },
  }
  const refundLabels = {
    refunded: { label: 'Refunded', cls: 'bg-green-900/50 text-green-400' },
    pending: { label: 'Pending', cls: 'bg-yellow-900/50 text-yellow-400' },
  }
  const refundMethodLabels = { cash: 'Cash', bank_transfer: 'Bank Transfer', debit_note: 'Debit Note' }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>
  }
  if (!ret) {
    return <div className="text-center py-8"><p className="text-zinc-500">Return not found.</p><Link to="/purchase-returns" className="text-teal-600 hover:underline">Back to list</Link></div>
  }

  return (
    <div className="max-w-4xl mx-auto print-area">

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-zinc-200 mb-4">Delete Return</h3>
            <p className="text-zinc-400 mb-6">
              Delete <strong>{ret.return_number}</strong>? Stock and cost will be restored, and any debit note on the parent PO will be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className="px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 print-hide">
        <div>
          <Link to="/purchase-returns" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to list</Link>
          <h1 className="text-xl lg:text-2xl font-bold text-white">{ret.return_number}</h1>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Link to={`/purchase-returns/${id}/edit`} className="flex-1 sm:flex-none text-center px-4 py-2 text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-md hover:bg-teal-500/20">Edit</Link>
          <button onClick={() => setShowDeleteModal(true)} className="flex-1 sm:flex-none px-4 py-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20">Delete</button>
          <button onClick={() => window.print()} className="flex-1 sm:flex-none px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">Print</button>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl print-hide">
        <div className="p-4 lg:p-6 border-b border-zinc-800 flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-teal-400">{ret.return_number}</p>
            <p className="text-sm text-zinc-400">{fmtDate(ret.return_date)}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusLabels[ret.status]?.cls}`}>{statusLabels[ret.status]?.label}</span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${refundLabels[ret.refund_status]?.cls}`}>{refundLabels[ret.refund_status]?.label}</span>
          </div>
        </div>
        <div className="p-4 lg:p-6 border-b border-zinc-800">
          <p className="text-sm text-zinc-500 mb-1">Supplier</p>
          <p className="text-zinc-200 font-medium">{ret.supplier_name}</p>
          {parentPo && (
            <p className="text-sm text-zinc-400 mt-1">
              Against PO: <Link to={`/purchase-orders/${parentPo.id}`} className="text-teal-400 hover:underline">{parentPo.po_number}</Link> ({fmtDate(parentPo.po_date)})
            </p>
          )}
          <p className="text-sm text-zinc-400 mt-1">Refund: {refundMethodLabels[ret.refund_method] || ret.refund_method}</p>
          {ret.reason && <p className="text-sm text-zinc-400">Reason: {ret.reason}</p>}
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
                  <td className="py-2 text-center text-zinc-400">{item.quantity} {item.unit}</td>
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
              <div className="flex justify-between"><span className="text-zinc-400">Subtotal</span><span className="text-zinc-200">{fmt(ret.subtotal)}</span></div>
              <div className="flex justify-between text-base font-bold border-t border-zinc-800 pt-2"><span className="text-zinc-200">Total</span><span className="text-teal-400">{fmt(ret.grand_total)}</span></div>
              {parseFloat(ret.amount_refunded || 0) > 0 && (
                <div className="flex justify-between"><span className="text-zinc-400">Refunded</span><span className="text-zinc-200">{fmt(ret.amount_refunded)}</span></div>
              )}
            </div>
          </div>
          {ret.notes && <p className="mt-4 text-sm text-zinc-400"><span className="text-zinc-500">Notes: </span>{ret.notes}</p>}
        </div>
      </div>

      {/* Print-only debit note */}
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
            {store.phone && <span>Phone no. : {store.phone}</span>}
            {store.phone && store.email && <span>{'  |  '}</span>}
            {store.email && <span>Email : {store.email}</span>}
          </div>
        </div>

        <div style={{ height: '2px', backgroundColor: '#222222', marginBottom: '10px' }} />

        <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: '700', marginBottom: '12px', letterSpacing: '2px', textTransform: 'uppercase' }}>
          DEBIT NOTE / PURCHASE RETURN
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', color: GRAY, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>Supplier</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: DARK }}>{ret.supplier_name}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: GRAY, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>Return Details</div>
            <div style={{ fontSize: '13px', marginBottom: '2px', color: DARK }}>Return No. : <strong>{ret.return_number}</strong></div>
            <div style={{ fontSize: '13px', color: DARK }}>Date : <strong>{fmtDate(ret.return_date)}</strong></div>
            {parentPo && (
              <div style={{ fontSize: '13px', color: DARK }}>Against PO : <strong>{parentPo.po_number}</strong></div>
            )}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0' }}>
          <thead>
            <tr>
              {[
                { label: '#',           align: 'center', width: '30px'  },
                { label: 'Item Name',   align: 'left',   width: null    },
                { label: 'Item Code',   align: 'left',   width: '100px' },
                { label: 'Qty',         align: 'center', width: '45px'  },
                { label: 'Unit',        align: 'center', width: '45px'  },
                { label: 'Price / Unit',align: 'right',  width: '100px' },
                { label: 'Amount',      align: 'right',  width: '90px'  },
              ].map((col) => (
                <th key={col.label} style={{
                  backgroundImage: `linear-gradient(${GREEN}, ${GREEN})`,
                  color: '#ffffff',
                  padding: '7px 8px',
                  textAlign: col.align,
                  fontWeight: '700',
                  fontSize: '12px',
                  width: col.width || undefined,
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact',
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
                backgroundImage: `linear-gradient(${bg}, ${bg})`,
                borderBottom: '1px solid #cccccc',
                verticalAlign: 'middle',
                padding: '6px 8px',
                color: DARK,
                fontSize: '13px',
              }
              const barcode = item.products?.barcode || item.products?.sku || ''
              const unit = item.unit || item.products?.unit || ''
              return (
                <tr key={item.id}>
                  <td style={{ ...cell, textAlign: 'center', fontWeight: '700' }}>{i + 1}</td>
                  <td style={{ ...cell, fontWeight: '700' }}>{item.product_name}</td>
                  <td style={{ ...cell, fontSize: '12px', color: '#666666' }}>{barcode}</td>
                  <td style={{ ...cell, textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ ...cell, textAlign: 'center', color: GRAY }}>{unit}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>QR {parseFloat(item.unit_price || 0).toFixed(4)}</td>
                  <td style={{ ...cell, textAlign: 'right', fontWeight: '700' }}>QR {parseFloat(item.total_price || 0).toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '2px solid #aaaaaa', marginTop: '4px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px 8px', verticalAlign: 'middle', width: '52%', color: DARK }}>
                <div style={{ fontSize: '12px', color: GRAY, textTransform: 'uppercase', fontWeight: 700 }}>Refund</div>
                <div style={{ fontSize: '13px', marginTop: '2px' }}>
                  {refundMethodLabels[ret.refund_method] || ret.refund_method} — {refundLabels[ret.refund_status]?.label}
                </div>
                {ret.reason && <div style={{ fontSize: '12px', color: GRAY, marginTop: '4px' }}><strong>Reason:</strong> {ret.reason}</div>}
              </td>
              <td style={{ padding: '0', verticalAlign: 'top', width: '48%', borderLeft: '1px solid #cccccc' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '6px 8px', textAlign: 'left', fontSize: '13px', color: GRAY, borderBottom: '1px solid #dddddd' }}>Sub Total</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '13px', color: DARK, borderBottom: '1px solid #dddddd' }}>QR {parseFloat(ret.subtotal || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 8px', textAlign: 'left', fontWeight: '700', fontSize: '15px', color: DARK, backgroundImage: 'linear-gradient(#eeeeee, #eeeeee)', borderTop: '2px solid #aaaaaa' }}>Total Returned</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: '700', fontSize: '15px', color: DARK, backgroundImage: 'linear-gradient(#eeeeee, #eeeeee)', borderTop: '2px solid #aaaaaa' }}>QR {parseFloat(ret.grand_total || 0).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {ret.notes && (
          <div style={{ marginTop: '14px', fontSize: '13px', color: GRAY, borderTop: '1px solid #dddddd', paddingTop: '10px' }}>
            <strong>Notes:</strong> {ret.notes}
          </div>
        )}
      </div>
    </div>
  )
}
