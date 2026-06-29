import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { SearchInput } from '../../components/SearchInput'
import { useDebounce } from '../../hooks/useDebounce'

const METHOD_LABELS = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
}

const formatCurrency = (amount) => `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'

export function Receipts() {
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [method, setMethod] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Only rows with a receipt_number are real cash receipts (RCT-…); discount /
      // credit-note adjustments have NULL receipt numbers and aren't receipts.
      const [saleRes, custRes] = await Promise.all([
        supabase
          .from('sale_payments')
          .select('id, payment_date, amount, payment_method, reference, receipt_number, sales(invoice_number, customer_name)')
          .not('receipt_number', 'is', null)
          .order('payment_date', { ascending: false }),
        supabase
          .from('customer_payments')
          .select('id, payment_date, amount, payment_method, reference, receipt_number, customers(name)')
          .not('receipt_number', 'is', null)
          .order('payment_date', { ascending: false }),
      ])
      if (saleRes.error) throw saleRes.error
      if (custRes.error) throw custRes.error

      const saleReceipts = (saleRes.data || []).map((p) => ({
        id: p.id,
        receipt_number: p.receipt_number,
        date: p.payment_date,
        customer: p.sales?.customer_name || 'Walk-in',
        against: p.sales?.invoice_number || '-',
        method: p.payment_method,
        reference: p.reference,
        amount: parseFloat(p.amount || 0),
        link: `/sale-payments/${p.id}`,
      }))
      const openingReceipts = (custRes.data || []).map((p) => ({
        id: p.id,
        receipt_number: p.receipt_number,
        date: p.payment_date,
        customer: p.customers?.name || '-',
        against: 'Opening Balance',
        method: p.payment_method,
        reference: p.reference,
        amount: parseFloat(p.amount || 0),
        link: `/customer-payments/${p.id}`,
      }))

      const all = [...saleReceipts, ...openingReceipts].sort((a, b) => new Date(b.date) - new Date(a.date))
      setReceipts(all)
    } catch (error) {
      console.error('Error fetching receipts:', error)
    } finally {
      setLoading(false)
    }
  }

  const filtered = receipts.filter((r) => {
    if (method && r.method !== method) return false
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      return (
        (r.receipt_number || '').toLowerCase().includes(q) ||
        (r.customer || '').toLowerCase().includes(q) ||
        (r.against || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const totalAmount = filtered.reduce((sum, r) => sum + r.amount, 0)

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Receipts</h1>
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by receipt #, customer, or invoice..." />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Receipts</p>
          <p className="text-lg font-bold text-white">{filtered.length}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500">Total Received</p>
          <p className="text-lg font-bold text-green-400">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
        <label className="block text-sm font-medium text-zinc-300 mb-1">Method</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full sm:w-64 bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">All Methods</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank Transfer</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">No receipts found.</div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Receipt #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Against</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Method</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-800/50">
                    <td className="px-6 py-4">
                      <Link to={r.link} className="text-sm font-medium text-teal-400 hover:text-teal-300">{r.receipt_number}</Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400">{formatDate(r.date)}</td>
                    <td className="px-6 py-4 text-sm text-zinc-300">{r.customer}</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">{r.against}</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">{METHOD_LABELS[r.method] || r.method}</td>
                    <td className="px-6 py-4 text-sm text-green-400 text-right">{formatCurrency(r.amount)}</td>
                    <td className="px-6 py-4 text-sm">
                      <Link to={r.link} className="text-teal-400 hover:text-teal-300">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-zinc-800/30">
                <tr>
                  <td colSpan={5} className="px-6 py-3 text-sm font-medium text-zinc-300">Total ({filtered.length} receipts)</td>
                  <td className="px-6 py-3 text-sm font-bold text-green-400 text-right">{formatCurrency(totalAmount)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {filtered.map((r) => (
              <Link key={r.id} to={r.link} className="block bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-medium text-teal-400">{r.receipt_number}</span>
                    <p className="text-xs text-zinc-500">{formatDate(r.date)}</p>
                  </div>
                  <span className="font-bold text-green-400">{formatCurrency(r.amount)}</span>
                </div>
                <p className="text-sm text-zinc-300">{r.customer}</p>
                <p className="text-xs text-zinc-500 mt-1">{r.against} · {METHOD_LABELS[r.method] || r.method}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
