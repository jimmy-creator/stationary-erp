import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useStoreSettings } from '../../hooks/useStoreSettings'
import { SearchInput } from '../../components/SearchInput'

export function PurchaseOrderView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isEmployee } = useAuth()
  const { settings: store } = useStoreSettings()
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [reapplyItem, setReapplyItem] = useState(null)
  const [reapplying, setReapplying] = useState(false)
  const [stockLogCounts, setStockLogCounts] = useState({})
  const [appliedThisSession, setAppliedThisSession] = useState(() => new Set())
  const [itemSearch, setItemSearch] = useState('')

  useEffect(() => { fetchOrder() }, [id])

  const fetchOrder = async () => {
    try {
      const [orderRes, itemsRes, returnsRes] = await Promise.all([
        supabase.from('purchase_orders').select('*').eq('id', id).single(),
        supabase.from('purchase_order_items').select('*').eq('po_id', id),
        supabase.from('purchase_returns').select('id, return_number, return_date, grand_total, status, refund_status').eq('po_id', id).order('return_date', { ascending: false }),
      ])
      if (orderRes.error) throw orderRes.error
      setOrder(orderRes.data)
      setItems(itemsRes.data || [])
      setReturns(returnsRes.data || [])

      const productIds = (itemsRes.data || [])
        .map((it) => it.product_id)
        .filter(Boolean)
      if (productIds.length) {
        try {
          const { data: logs } = await supabase
            .from('stock_adjustments')
            .select('product_id, reason')
            .in('product_id', productIds)
          const counts = {}
          for (const log of logs || []) {
            const reason = log.reason || ''
            if (reason.startsWith('PO received:') || reason.startsWith('PO re-applied:')) {
              counts[log.product_id] = (counts[log.product_id] || 0) + 1
            }
          }
          setStockLogCounts(counts)
        } catch {
          // stock_adjustments may not exist; silently skip the count display
        }
      }
    } catch (error) {
      console.error('Error fetching purchase order:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReapply = async () => {
    if (!reapplyItem || !order) return
    setReapplying(true)
    try {
      if (!reapplyItem.product_id) throw new Error('Line has no linked product')

      const { data: prod, error: fetchErr } = await supabase
        .from('products')
        .select('stock_quantity, cost_price')
        .eq('id', reapplyItem.product_id)
        .single()
      if (fetchErr) throw fetchErr
      if (!prod) throw new Error('Product not found')

      const itemQty = Number(reapplyItem.quantity) || 0
      const itemTotal = Number(reapplyItem.total_price) || 0
      const prevStock = Number(prod.stock_quantity) || 0
      const newStock = prevStock + itemQty

      const poSubtotal = items.reduce((s, i) => s + (Number(i.total_price) || 0), 0)
      const taxPct = parseFloat(order.tax_percentage) || 0
      const poCargoCharges = parseFloat(order.cargo_charges) || 0
      const lineShare = poSubtotal > 0 ? itemTotal / poSubtotal : 0
      const itemTax = itemTotal * taxPct / 100
      const cargoShare = lineShare * poCargoCharges
      const itemLandedTotal = itemTotal + itemTax + cargoShare
      const landedCostPerUnit = itemQty > 0 ? itemLandedTotal / itemQty : 0

      const existingCost = parseFloat(prod.cost_price) || 0
      const weightedCostRaw = prevStock > 0
        ? ((existingCost * prevStock) + (landedCostPerUnit * itemQty)) / newStock
        : landedCostPerUnit
      const weightedCost = Number.isFinite(weightedCostRaw) ? weightedCostRaw : 0
      const newCostPrice = Math.round(weightedCost * 100) / 100

      const { error: updErr } = await supabase
        .from('products')
        .update({ stock_quantity: newStock, cost_price: newCostPrice })
        .eq('id', reapplyItem.product_id)
      if (updErr) throw updErr

      try {
        await supabase.from('stock_adjustments').insert({
          product_id: reapplyItem.product_id,
          adjustment_type: 'add',
          quantity: itemQty,
          previous_stock: prevStock,
          new_stock: newStock,
          reason: `PO re-applied: ${order.supplier_name} (landed cost: ${newCostPrice})`,
          created_by_email: user?.email || null,
        })
      } catch (logErr) {
        console.warn('stock_adjustments log failed (non-fatal):', logErr)
      }

      const nowIso = new Date().toISOString()
      await supabase
        .from('purchase_order_items')
        .update({
          received_at: nowIso,
          applied_quantity: itemQty,
          applied_landed_cost: landedCostPerUnit,
        })
        .eq('id', reapplyItem.id)

      setItems((prev) => prev.map((it) => (it.id === reapplyItem.id ? {
        ...it,
        received_at: nowIso,
        applied_quantity: itemQty,
        applied_landed_cost: landedCostPerUnit,
      } : it)))
      setStockLogCounts((prev) => ({
        ...prev,
        [reapplyItem.product_id]: (prev[reapplyItem.product_id] || 0) + 1,
      }))
      setAppliedThisSession((prev) => {
        const next = new Set(prev)
        next.add(reapplyItem.id)
        return next
      })
      setReapplyItem(null)
    } catch (error) {
      console.error('Re-apply failed:', error)
      alert(`Re-apply failed: ${error.message || error}`)
    } finally {
      setReapplying(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      // Revert any stock + cost that was applied by this PO's lines, before the
      // cascade-delete removes them and we lose the applied_quantity record.
      const { data: lines } = await supabase
        .from('purchase_order_items')
        .select('product_id, applied_quantity, applied_landed_cost')
        .eq('po_id', id)
      const failures = []
      for (const line of lines || []) {
        const appliedQty = Number(line.applied_quantity) || 0
        if (!line.product_id || appliedQty <= 0) continue
        const appliedCost = Number(line.applied_landed_cost) || 0
        try {
          const { data: prod, error: prodErr } = await supabase
            .from('products')
            .select('stock_quantity, cost_price')
            .eq('id', line.product_id)
            .single()
          if (prodErr) throw prodErr
          const prevStock = Number(prod?.stock_quantity) || 0
          const prevCost = Number(prod?.cost_price) || 0
          const newStock = Math.max(0, prevStock - appliedQty)
          const newValue = Math.max(0, prevStock * prevCost - appliedQty * appliedCost)
          const newCost = newStock > 0 ? Math.round((newValue / newStock) * 100) / 100 : 0
          const { error: updErr } = await supabase
            .from('products')
            .update({ stock_quantity: newStock, cost_price: newCost })
            .eq('id', line.product_id)
          if (updErr) throw updErr
          try {
            await supabase.from('stock_adjustments').insert({
              product_id: line.product_id,
              adjustment_type: 'remove',
              quantity: appliedQty,
              previous_stock: prevStock,
              new_stock: newStock,
              reason: `PO deleted: ${order?.supplier_name || ''}`,
              created_by_email: user?.email || null,
            })
          } catch (logErr) {
            console.warn('stock_adjustments log failed (non-fatal):', logErr)
          }
        } catch (err) {
          console.error(`Stock revert failed for product ${line.product_id}:`, err)
          failures.push(line.product_id)
        }
      }

      const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
      if (error) throw error
      if (failures.length) {
        alert(`PO deleted, but stock revert failed for ${failures.length} product(s). Check the console.`)
      }
      navigate('/purchase-orders')
    } catch (error) {
      console.error('Error deleting:', error)
      alert('Failed to delete')
    } finally { setDeleting(false); setShowDeleteModal(false) }
  }

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'
  const formatCurrency = (amount) => `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  const statusLabels = {
    draft: { label: 'Draft', class: 'bg-zinc-800 text-zinc-300' },
    sent: { label: 'Sent', class: 'bg-blue-900/50 text-blue-400' },
    confirmed: { label: 'Confirmed', class: 'bg-purple-900/50 text-purple-400' },
    received: { label: 'Received', class: 'bg-green-900/50 text-green-400' },
    cancelled: { label: 'Cancelled', class: 'bg-red-900/50 text-red-400' },
  }

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  if (!order) return <div className="text-center py-8"><p className="text-zinc-500">Not found.</p><Link to="/purchase-orders" className="text-teal-600 hover:underline">Back</Link></div>

  return (
    <div className="max-w-4xl mx-auto print-area">
      {reapplyItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-zinc-200 mb-2">Re-apply Stock</h3>
            <p className="text-zinc-400 mb-2">
              This will add <strong className="text-zinc-200">{reapplyItem.quantity} {reapplyItem.unit}</strong> of <strong className="text-zinc-200">{reapplyItem.product_name}</strong> to stock and update its landed cost.
            </p>
            {reapplyItem.product_id && (
              <p className={`text-sm mb-2 ${stockLogCounts[reapplyItem.product_id] ? 'text-red-400' : 'text-zinc-500'}`}>
                {stockLogCounts[reapplyItem.product_id]
                  ? `⚠ Found ${stockLogCounts[reapplyItem.product_id]} prior PO stock-adjustment log${stockLogCounts[reapplyItem.product_id] > 1 ? 's' : ''} for this product. This line may already have been applied.`
                  : 'No prior PO stock-adjustment logs found for this product — likely was missed.'}
              </p>
            )}
            <p className="text-amber-400 text-sm mb-6">Use this only if the line was missed when the PO was first received. Running it again will double-count.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setReapplyItem(null)} disabled={reapplying} className="px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">Cancel</button>
              <button onClick={handleReapply} disabled={reapplying} className="px-4 py-2 text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50">{reapplying ? 'Applying...' : 'Re-apply'}</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-zinc-200 mb-4">Delete Purchase Order</h3>
            <p className="text-zinc-400 mb-6">Delete <strong>{order.po_number}</strong>?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className="px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 print-hide">
        <div>
          <Link to="/purchase-orders" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to list</Link>
          <h1 className="text-xl lg:text-2xl font-bold text-white">{order.po_number}</h1>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {order.status === 'received' && (
            <Link to={`/purchase-returns/new?po_id=${id}`} className="flex-1 sm:flex-none text-center px-4 py-2 text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-md hover:bg-orange-500/20">Create Return</Link>
          )}
          {!isEmployee && <Link to={`/purchase-orders/${id}/edit`} className="flex-1 sm:flex-none text-center px-4 py-2 text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-md hover:bg-teal-500/20">Edit</Link>}
          {!isEmployee && <button onClick={() => setShowDeleteModal(true)} className="flex-1 sm:flex-none px-4 py-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20">Delete</button>}
          <button onClick={() => window.print()} className="flex-1 sm:flex-none px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">Print</button>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl">
        <div className="p-4 lg:p-6 border-b border-zinc-800">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{store.store_name || 'PURCHASE ORDER'}</h1>
              {store.address && <p className="text-sm text-zinc-400 whitespace-pre-wrap">{store.address}</p>}
              {(store.phone || store.email) && (
                <p className="text-sm text-zinc-500">
                  {store.phone && `Tel: ${store.phone}`}{store.phone && store.email && ' | '}{store.email && store.email}
                </p>
              )}
              <p className="text-sm font-semibold text-zinc-300 mt-2">PURCHASE ORDER</p>
              <p className="text-lg font-semibold text-teal-400">{order.po_number}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-sm text-zinc-500">Date: {formatDate(order.po_date)}</p>
              {order.expected_delivery_date && <p className="text-sm text-zinc-500">Expected: {formatDate(order.expected_delivery_date)}</p>}
              <span className={`inline-block mt-2 px-2 py-1 text-xs font-medium rounded-full ${statusLabels[order.status]?.class}`}>{statusLabels[order.status]?.label}</span>
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-500 uppercase mb-2">Supplier</h3>
          <p className="font-medium text-zinc-200">{order.supplier_name}</p>
          {order.supplier_phone && <p className="text-sm text-zinc-400">Phone: {order.supplier_phone}</p>}
          {order.supplier_email && <p className="text-sm text-zinc-400">Email: {order.supplier_email}</p>}
        </div>

        <div className="p-4 lg:p-6 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-500 uppercase mb-4">Items</h3>
          {items.length > 1 && (
            <div className="mb-3 print-hide">
              <SearchInput value={itemSearch} onChange={setItemSearch} placeholder="Search items..." />
            </div>
          )}
          {(() => {
            const q = itemSearch.trim().toLowerCase()
            const visible = items
              .map((item, i) => ({ item, i }))
              .filter(({ item }) => !q || (item.product_name || '').toLowerCase().includes(q))
            const noMatches = q && visible.length === 0
            return (
              <>
                {noMatches && (
                  <p className="text-sm text-zinc-500 text-center py-4 print-hide">No items match "{itemSearch}".</p>
                )}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">#</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 uppercase">Product</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-zinc-500 uppercase">Qty</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 uppercase">Unit Price</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 uppercase">Total</th>
                  {order.status === 'received' && <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500 uppercase print-hide">Stock</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {visible.map(({ item, i }) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm text-zinc-500">{i + 1}</td>
                    <td className="px-4 py-3 text-sm text-zinc-200">{item.product_name}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400 text-center">{item.quantity} {item.unit}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400 text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-200 text-right">{formatCurrency(item.total_price)}</td>
                    {order.status === 'received' && (
                      <td className="px-4 py-3 text-right print-hide">
                        {appliedThisSession.has(item.id) ? (
                          <span className="text-xs text-green-400">✓ Just applied</span>
                        ) : Number(item.applied_quantity) > 0 ? (
                          <div className="flex flex-col items-end gap-1">
                            <button
                              onClick={() => setReapplyItem(item)}
                              disabled={!item.product_id}
                              className="text-xs text-amber-400 hover:text-amber-300 disabled:text-zinc-600 disabled:cursor-not-allowed"
                              title={item.product_id ? 'Re-apply stock for this line' : 'Line has no linked product'}
                            >
                              Re-apply
                            </button>
                            {item.product_id && (
                              <span className={`text-[10px] ${stockLogCounts[item.product_id] ? 'text-green-500' : 'text-amber-500'}`}>
                                {stockLogCounts[item.product_id] ? `✓ ${stockLogCounts[item.product_id]} log${stockLogCounts[item.product_id] > 1 ? 's' : ''}` : '⚠ no log'}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-500">Pending</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {visible.map(({ item }) => (
              <div key={item.id} className="bg-zinc-800/30 rounded-lg p-3">
                <div className="flex justify-between"><span className="text-sm text-zinc-200">{item.product_name}</span><span className="font-medium text-zinc-200">{formatCurrency(item.total_price)}</span></div>
                <p className="text-xs text-zinc-500">{item.quantity} {item.unit} x {formatCurrency(item.unit_price)}</p>
                {order.status === 'received' && (
                  <div className="mt-2 print-hide flex items-center gap-2">
                    {appliedThisSession.has(item.id) ? (
                      <span className="text-xs text-green-400">✓ Just applied</span>
                    ) : Number(item.applied_quantity) > 0 ? (
                      <>
                        <button onClick={() => setReapplyItem(item)} disabled={!item.product_id} className="text-xs text-amber-400 hover:text-amber-300 disabled:text-zinc-600 disabled:cursor-not-allowed">
                          Re-apply stock
                        </button>
                        {item.product_id && (
                          <span className={`text-[10px] ${stockLogCounts[item.product_id] ? 'text-green-500' : 'text-amber-500'}`}>
                            {stockLogCounts[item.product_id] ? `✓ ${stockLogCounts[item.product_id]} log${stockLogCounts[item.product_id] > 1 ? 's' : ''}` : '⚠ no log'}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-zinc-500">Stock pending — save the PO to apply</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
              </>
            )
          })()}

          <div className="mt-4 flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-zinc-400">Subtotal:</span><span className="text-zinc-200">{formatCurrency(order.subtotal)}</span></div>
              {order.discount_amount > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Discount ({order.discount_percentage}%):</span><span className="text-red-400">-{formatCurrency(order.discount_amount)}</span></div>}
              {order.tax_amount > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">VAT ({order.tax_percentage}%):</span><span className="text-zinc-200">{formatCurrency(order.tax_amount)}</span></div>}
              {order.cargo_charges > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Cargo Charges:</span><span className="text-zinc-200">{formatCurrency(order.cargo_charges)}</span></div>}
              <div className="flex justify-between text-lg font-bold border-t border-zinc-800 pt-2">
                <span className="text-zinc-200">Grand Total:</span>
                <span className="text-teal-400">{formatCurrency(order.grand_total)}</span>
              </div>
            </div>
          </div>
        </div>

        {(order.payment_terms || order.notes) && (
          <div className="p-4 lg:p-6">
            {order.payment_terms && <div className="mb-3"><p className="text-xs font-semibold text-zinc-500 uppercase">Payment Terms</p><p className="text-sm text-zinc-300">{order.payment_terms}</p></div>}
            {order.notes && <div><p className="text-xs font-semibold text-zinc-500 uppercase">Notes</p><p className="text-sm text-zinc-300">{order.notes}</p></div>}
          </div>
        )}
      </div>

      {returns.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl mt-4 print-hide">
          <div className="p-4 lg:p-6 border-b border-zinc-800 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Returns Against This PO</h2>
            <span className="text-xs text-zinc-500">{returns.length} return{returns.length === 1 ? '' : 's'}</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {returns.map((r) => (
              <Link key={r.id} to={`/purchase-returns/${r.id}`} className="flex items-center justify-between p-4 lg:p-6 hover:bg-zinc-800/40 transition-colors">
                <div>
                  <p className="text-teal-400 font-medium">{r.return_number}</p>
                  <p className="text-xs text-zinc-500">{formatDate(r.return_date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${r.status === 'completed' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                    {r.status === 'completed' ? 'Completed' : 'Cancelled'}
                  </span>
                  <span className="font-medium text-zinc-200">{formatCurrency(r.grand_total)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
