import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStoreSettings } from '../hooks/useStoreSettings'
import {
  ShoppingCart,
  Undo2,
  ShoppingBag,
  RotateCcw,
  Printer,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

const formatCurrency = (amount) =>
  `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

const sumActive = (rows) =>
  rows
    .filter((r) => r.status !== 'cancelled')
    .reduce((s, r) => s + parseFloat(r.grand_total || 0), 0)

const statusClasses = {
  completed: 'bg-green-900/50 text-green-400',
  returned: 'bg-orange-900/50 text-orange-400',
  cancelled: 'bg-red-900/50 text-red-400',
  draft: 'bg-zinc-800 text-zinc-400',
  sent: 'bg-blue-900/50 text-blue-400',
  confirmed: 'bg-indigo-900/50 text-indigo-400',
  received: 'bg-green-900/50 text-green-400',
}

export function Daybook() {
  const { settings: store } = useStoreSettings()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState([])
  const [salesReturns, setSalesReturns] = useState([])
  const [purchases, setPurchases] = useState([])
  const [purchaseReturns, setPurchaseReturns] = useState([])

  useEffect(() => {
    fetchData()
  }, [selectedDate])

  const fetchData = async () => {
    try {
      setLoading(true)
      const d = selectedDate

      const [salesRes, srRes, poRes, prRes] = await Promise.all([
        supabase
          .from('sales')
          .select('id, invoice_number, sale_date, customer_name, grand_total, amount_paid, payment_method, payment_status, status, salesperson_name, created_by_email')
          .eq('sale_date', d)
          .order('created_at', { ascending: true }),
        supabase
          .from('sales_returns')
          .select('id, return_number, return_date, customer_name, grand_total, refund_method, refund_status, status')
          .eq('return_date', d)
          .order('created_at', { ascending: true }),
        supabase
          .from('purchase_orders')
          .select('id, po_number, po_date, supplier_name, grand_total, amount_paid, status')
          .eq('po_date', d)
          .order('created_at', { ascending: true }),
        supabase
          .from('purchase_returns')
          .select('id, return_number, return_date, supplier_name, grand_total, refund_method, refund_status, status')
          .eq('return_date', d)
          .order('created_at', { ascending: true }),
      ])

      setSales(salesRes.data || [])
      setSalesReturns(srRes.data || [])
      setPurchases(poRes.data || [])
      setPurchaseReturns(prRes.data || [])
    } catch (error) {
      console.error('Error fetching daybook:', error)
    } finally {
      setLoading(false)
    }
  }

  const goToDate = (offset) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + offset)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const salesTotal = sumActive(sales)
  const salesReturnsTotal = sumActive(salesReturns)
  const purchasesTotal = sumActive(purchases)
  const purchaseReturnsTotal = sumActive(purchaseReturns)
  const netTrading = salesTotal - salesReturnsTotal
  const netProcurement = purchasesTotal - purchaseReturnsTotal

  const friendlyDate = new Date(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const isEmpty =
    sales.length === 0 &&
    salesReturns.length === 0 &&
    purchases.length === 0 &&
    purchaseReturns.length === 0

  const printSection = (title, rows, numberKey, partyLabel, partyKey, color) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginBottom: '18px' }}>
      <thead>
        <tr style={{ borderBottom: `2px solid ${color}` }}>
          <th colSpan={4} style={{ textAlign: 'left', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>
            {title} ({rows.length})
          </th>
          <th style={{ textAlign: 'right', padding: '6px', color: '#111', fontWeight: 700, fontSize: '11pt' }}>
            {formatCurrency(sumActive(rows))}
          </th>
        </tr>
        <tr style={{ borderBottom: '1px solid #d1d5db' }}>
          <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>#</th>
          <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Number</th>
          <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>{partyLabel}</th>
          <th style={{ textAlign: 'left', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Status</th>
          <th style={{ textAlign: 'right', padding: '4px 6px', color: '#666', fontWeight: 600, textTransform: 'uppercase', fontSize: '8pt' }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={5} style={{ padding: '8px 6px', color: '#999', fontStyle: 'italic' }}>None</td>
          </tr>
        ) : (
          rows.map((r, i) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '5px 6px', color: '#666' }}>{i + 1}</td>
              <td style={{ padding: '5px 6px', color: '#111', fontWeight: 500 }}>{r[numberKey]}</td>
              <td style={{ padding: '5px 6px', color: '#374151' }}>{r[partyKey] || (partyKey === 'customer_name' ? 'Walk-in' : '-')}</td>
              <td style={{ padding: '5px 6px', color: r.status === 'cancelled' ? '#dc2626' : '#374151', textTransform: 'capitalize' }}>{r.status}</td>
              <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: r.status === 'cancelled' ? '#999' : '#111', textDecoration: r.status === 'cancelled' ? 'line-through' : 'none' }}>
                {formatCurrency(r.grand_total)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )

  const screenSection = (title, icon, color, rows, numberKey, partyLabel, partyKey, viewPath, total) => (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-zinc-300 uppercase tracking-wider flex items-center gap-2">
          {icon}
          {title} <span className="text-zinc-500">({rows.length})</span>
        </h3>
        <span className={`text-sm font-bold ${color}`}>{formatCurrency(total)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-zinc-600 italic">No entries.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.id}
              to={`${viewPath}/${r.id}`}
              className="flex items-center justify-between bg-zinc-800/30 rounded-lg p-3 hover:bg-zinc-800/60 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-medium ${color}`}>{r[numberKey]}</span>
                  <span className="text-sm text-zinc-300 truncate">
                    {r[partyKey] || (partyKey === 'customer_name' ? 'Walk-in' : '-')}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${statusClasses[r.status] || 'bg-zinc-800 text-zinc-400'}`}>
                    {r.status}
                  </span>
                </div>
              </div>
              <span className={`font-medium ml-4 ${r.status === 'cancelled' ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                {formatCurrency(r.grand_total)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )

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

          <h2 style={{ fontSize: '14pt', fontWeight: 600, marginTop: '12px', marginBottom: '4px', color: '#111' }}>Daybook</h2>
          <p style={{ fontSize: '10pt', color: '#666', marginBottom: '20px' }}>{friendlyDate}</p>

          {/* Summary */}
          <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', borderBottom: '2px solid #e5e7eb', paddingBottom: '12px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: '8pt', color: '#666', textTransform: 'uppercase', margin: 0 }}>Sales</p>
              <p style={{ fontSize: '14pt', fontWeight: 700, color: '#16a34a', margin: 0 }}>{formatCurrency(salesTotal)}</p>
            </div>
            <div>
              <p style={{ fontSize: '8pt', color: '#666', textTransform: 'uppercase', margin: 0 }}>Sales Returns</p>
              <p style={{ fontSize: '14pt', fontWeight: 700, color: '#ea580c', margin: 0 }}>{formatCurrency(salesReturnsTotal)}</p>
            </div>
            <div>
              <p style={{ fontSize: '8pt', color: '#666', textTransform: 'uppercase', margin: 0 }}>Purchases</p>
              <p style={{ fontSize: '14pt', fontWeight: 700, color: '#dc2626', margin: 0 }}>{formatCurrency(purchasesTotal)}</p>
            </div>
            <div>
              <p style={{ fontSize: '8pt', color: '#666', textTransform: 'uppercase', margin: 0 }}>Purchase Returns</p>
              <p style={{ fontSize: '14pt', fontWeight: 700, color: '#16a34a', margin: 0 }}>{formatCurrency(purchaseReturnsTotal)}</p>
            </div>
            <div>
              <p style={{ fontSize: '8pt', color: '#666', textTransform: 'uppercase', margin: 0 }}>Net Trading</p>
              <p style={{ fontSize: '14pt', fontWeight: 700, color: '#111', margin: 0 }}>{formatCurrency(netTrading)}</p>
            </div>
            <div>
              <p style={{ fontSize: '8pt', color: '#666', textTransform: 'uppercase', margin: 0 }}>Net Procurement</p>
              <p style={{ fontSize: '14pt', fontWeight: 700, color: '#111', margin: 0 }}>{formatCurrency(netProcurement)}</p>
            </div>
          </div>

          {printSection('Sales', sales, 'invoice_number', 'Customer', 'customer_name', '#16a34a')}
          {printSection('Sales Returns', salesReturns, 'return_number', 'Customer', 'customer_name', '#ea580c')}
          {printSection('Purchases', purchases, 'po_number', 'Supplier', 'supplier_name', '#dc2626')}
          {printSection('Purchase Returns', purchaseReturns, 'return_number', 'Supplier', 'supplier_name', '#16a34a')}
        </div>
      </div>

      {/* ══ Screen UI ══ */}
      <div className="print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-xl lg:text-2xl font-bold text-white">Daybook</h1>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            <Printer className="w-4 h-4" /> Print Report
          </button>
        </div>

        {/* Date selector */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button onClick={() => goToDate(-1)} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700">&larr;</button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-zinc-800/50 border border-zinc-700 rounded-lg text-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button onClick={() => goToDate(1)} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700">&rarr;</button>
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="px-3 py-2 text-sm text-teal-400 hover:text-teal-300"
          >
            Today
          </button>
          <span className="text-zinc-500 text-sm">{friendlyDate}</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Sales ({sales.length})</p>
                    <p className="text-lg font-bold text-teal-400">{formatCurrency(salesTotal)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <Undo2 className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Sales Returns ({salesReturns.length})</p>
                    <p className="text-lg font-bold text-orange-400">{formatCurrency(salesReturnsTotal)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Purchases ({purchases.length})</p>
                    <p className="text-lg font-bold text-red-400">{formatCurrency(purchasesTotal)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <RotateCcw className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Purchase Returns ({purchaseReturns.length})</p>
                    <p className="text-lg font-bold text-emerald-400">{formatCurrency(purchaseReturnsTotal)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Net cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${netTrading >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    <ArrowUpRight className={`w-5 h-5 ${netTrading >= 0 ? 'text-green-400' : 'text-red-400'}`} />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Net Trading (Sales − Sales Returns)</p>
                    <p className={`text-lg font-bold ${netTrading >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(netTrading)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <ArrowDownRight className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Net Procurement (Purchases − Purchase Returns)</p>
                    <p className="text-lg font-bold text-white">{formatCurrency(netProcurement)}</p>
                  </div>
                </div>
              </div>
            </div>

            {isEmpty ? (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
                No transactions on this date.
              </div>
            ) : (
              <div className="space-y-6">
                {screenSection(
                  'Sales',
                  <ShoppingCart className="w-4 h-4 text-teal-400" />,
                  'text-teal-400',
                  sales,
                  'invoice_number',
                  'Customer',
                  'customer_name',
                  '/sales',
                  salesTotal,
                )}
                {screenSection(
                  'Sales Returns',
                  <Undo2 className="w-4 h-4 text-orange-400" />,
                  'text-orange-400',
                  salesReturns,
                  'return_number',
                  'Customer',
                  'customer_name',
                  '/sales-returns',
                  salesReturnsTotal,
                )}
                {screenSection(
                  'Purchases',
                  <ShoppingBag className="w-4 h-4 text-red-400" />,
                  'text-red-400',
                  purchases,
                  'po_number',
                  'Supplier',
                  'supplier_name',
                  '/purchase-orders',
                  purchasesTotal,
                )}
                {screenSection(
                  'Purchase Returns',
                  <RotateCcw className="w-4 h-4 text-emerald-400" />,
                  'text-emerald-400',
                  purchaseReturns,
                  'return_number',
                  'Supplier',
                  'supplier_name',
                  '/purchase-returns',
                  purchaseReturnsTotal,
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
