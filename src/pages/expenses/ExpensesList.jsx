import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { SearchInput } from '../../components/SearchInput'
import { useDebounce } from '../../hooks/useDebounce'
import { useExpenseCategories, CATEGORY_COLOR_CLASSES } from '../../hooks/useExpenseCategories'

const PAGE_SIZE = 20

// ── Manage Categories Modal ────────────────────────────────────────────────────
function ManageCategoriesModal({ onClose }) {
  const { categories, addCategory, deleteCategory } = useExpenseCategories()
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const handleAdd = async () => {
    if (!newLabel.trim()) return
    setSaving(true)
    setError('')
    try {
      await addCategory(newLabel)
      setNewLabel('')
    } catch (err) {
      setError(err.message || 'Failed to add category')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await deleteCategory(id)
    } catch (err) {
      alert(err.message || 'Failed to delete category')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center p-5 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Manage Expense Categories</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">&times;</button>
        </div>

        {/* Add new */}
        <div className="p-5 border-b border-zinc-800">
          <p className="text-sm text-zinc-400 mb-3">Add a new category</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => { setNewLabel(e.target.value); setError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
              placeholder="Category name…"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              onClick={handleAdd}
              disabled={saving || !newLabel.trim()}
              className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-500 disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>

        {/* List */}
        <ul className="p-5 space-y-2 max-h-72 overflow-y-auto">
          {categories.map((cat) => (
            <li key={cat.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${CATEGORY_COLOR_CLASSES[cat.color] || CATEGORY_COLOR_CLASSES.zinc}`}>
                  {cat.label}
                </span>
              </div>
              <button
                onClick={() => handleDelete(cat.id)}
                disabled={deletingId === cat.id}
                className="text-xs text-red-500 hover:text-red-400 disabled:opacity-40"
              >
                {deletingId === cat.id ? 'Removing…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>

        <div className="p-5 border-t border-zinc-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-300 bg-zinc-800 rounded-lg hover:bg-zinc-700">Done</button>
        </div>
      </div>
    </div>
  )
}

// ── Main List Component ────────────────────────────────────────────────────────
export function ExpensesList() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filter, setFilter] = useState({ category: '', month: '' })
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [months, setMonths] = useState([])
  const [showManageCategories, setShowManageCategories] = useState(false)

  const { categories } = useExpenseCategories()

  // Build a lookup map from DB categories
  const categoryMap = Object.fromEntries(
    categories.map((c) => [c.value, { label: c.label, class: CATEGORY_COLOR_CLASSES[c.color] || CATEGORY_COLOR_CLASSES.zinc }])
  )

  // Fetch available months once on mount
  useEffect(() => {
    const fetchMonths = async () => {
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('expense_date')
          .order('expense_date', { ascending: false })
        if (error) throw error
        const uniqueMonths = [...new Set((data || []).map((e) => e.expense_date.substring(0, 7)))].sort().reverse()
        setMonths(uniqueMonths)
      } catch (error) {
        console.error('Error fetching months:', error)
      }
    }
    fetchMonths()
  }, [])

  // Reset page when search or filters change
  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, filter.category, filter.month])

  const applyFilters = useCallback((query) => {
    if (debouncedSearch) {
      query = query.or(`description.ilike.%${debouncedSearch}%,vendor.ilike.%${debouncedSearch}%`)
    }
    if (filter.category) {
      query = query.eq('category', filter.category)
    }
    if (filter.month) {
      const [year, month] = filter.month.split('-')
      const lastDay = new Date(Number(year), Number(month), 0).getDate()
      query = query.gte('expense_date', `${filter.month}-01`).lte('expense_date', `${filter.month}-${String(lastDay).padStart(2, '0')}`)
    }
    return query
  }, [debouncedSearch, filter.category, filter.month])

  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        setLoading(true)

        let query = supabase
          .from('expenses')
          .select('*', { count: 'exact' })
          .order('expense_date', { ascending: false })
        query = applyFilters(query)
        query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

        let statsQuery = supabase.from('expenses').select('amount')
        statsQuery = applyFilters(statsQuery)

        const [dataResult, statsResult] = await Promise.all([query, statsQuery])
        if (dataResult.error) throw dataResult.error
        if (statsResult.error) throw statsResult.error

        setExpenses(dataResult.data || [])
        setTotalCount(dataResult.count || 0)
        setTotalAmount((statsResult.data || []).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0))
      } catch (error) {
        console.error('Error fetching expenses:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchExpenses()
  }, [debouncedSearch, filter.category, filter.month, page, applyFilters])

  const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const formatCurrency = (amount) => `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  const paymentMethodLabels = { cash: 'Cash', bank_transfer: 'Bank Transfer', credit_card: 'Credit Card', cheque: 'Cheque' }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const rangeStart = totalCount === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, totalCount)

  return (
    <div>
      {showManageCategories && (
        <ManageCategoriesModal onClose={() => setShowManageCategories(false)} />
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Expenses</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowManageCategories(true)}
            className="flex-1 sm:flex-none text-center px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700 text-sm"
          >
            Categories
          </button>
          <Link to="/expenses/new" className="flex-1 sm:flex-none text-center bg-gradient-to-r from-teal-600 to-teal-500 text-white px-4 py-2 rounded-md hover:from-teal-500 hover:to-teal-400 transition-colors">
            + Add Expense
          </Link>
        </div>
      </div>

      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Search by description or vendor..." /></div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Category</label>
            <select
              value={filter.category}
              onChange={(e) => setFilter({ ...filter, category: e.target.value })}
              className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Month</label>
            <select
              value={filter.month}
              onChange={(e) => setFilter({ ...filter, month: e.target.value })}
              className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All</option>
              {months.map((m) => (
                <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <div className="w-full bg-blue-900/30 border border-blue-800/50 rounded-md p-3">
              <p className="text-sm text-teal-400">Total</p>
              <p className="text-lg font-bold text-teal-300">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
      ) : expenses.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">No expenses found.</div>
      ) : (
        <>
          <div className="hidden md:block bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Vendor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Payment</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {expenses.map((expense) => {
                  const cat = categoryMap[expense.category]
                  return (
                    <tr key={expense.id} className="hover:bg-zinc-800/50">
                      <td className="px-6 py-4 text-sm text-zinc-500">{formatDate(expense.expense_date)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${cat?.class || 'bg-zinc-800 text-zinc-300'}`}>
                          {cat?.label || expense.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-200 max-w-xs truncate">{expense.description}</td>
                      <td className="px-6 py-4 text-sm text-zinc-400">{expense.vendor || '-'}</td>
                      <td className="px-6 py-4 text-sm text-zinc-400">{paymentMethodLabels[expense.payment_method] || expense.payment_method}</td>
                      <td className="px-6 py-4 text-sm font-medium text-zinc-200 text-right">{formatCurrency(expense.amount)}</td>
                      <td className="px-6 py-4 text-sm"><Link to={`/expenses/${expense.id}/edit`} className="text-teal-400 hover:text-teal-300">Edit</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            {expenses.map((expense) => {
              const cat = categoryMap[expense.category]
              return (
                <Link key={expense.id} to={`/expenses/${expense.id}/edit`} className="block bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-800/50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm text-zinc-500">{formatDate(expense.expense_date)}</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${cat?.class || 'bg-zinc-800 text-zinc-300'}`}>
                      {cat?.label || expense.category}
                    </span>
                  </div>
                  <p className="text-zinc-200 font-medium">{expense.description}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-zinc-500">{paymentMethodLabels[expense.payment_method]}</span>
                    <span className="font-bold text-zinc-200">{formatCurrency(expense.amount)}</span>
                  </div>
                </Link>
              )
            })}
          </div>

          <div className="mt-6 bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-zinc-400">
              Showing {rangeStart}-{rangeEnd} of {totalCount}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-400">Page {page + 1} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
