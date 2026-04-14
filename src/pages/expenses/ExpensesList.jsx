import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { SearchInput } from '../../components/SearchInput'
import { useDebounce } from '../../hooks/useDebounce'

const PAGE_SIZE = 20

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

  // Build shared query conditions
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

  // Fetch paginated expenses + total amount stats
  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        setLoading(true)

        // Paginated data query
        let query = supabase
          .from('expenses')
          .select('*', { count: 'exact' })
          .order('expense_date', { ascending: false })
        query = applyFilters(query)
        query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

        // Stats query for total amount across all filtered rows
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

  const categoryLabels = {
    rent: { label: 'Rent', class: 'bg-pink-900/50 text-pink-400' },
    utilities: { label: 'Utilities', class: 'bg-yellow-900/50 text-yellow-400' },
    salary: { label: 'Salary', class: 'bg-indigo-900/50 text-indigo-400' },
    inventory: { label: 'Inventory', class: 'bg-teal-900/50 text-teal-400' },
    maintenance: { label: 'Maintenance', class: 'bg-orange-900/50 text-orange-400' },
    marketing: { label: 'Marketing', class: 'bg-cyan-900/50 text-cyan-400' },
    transport: { label: 'Transport', class: 'bg-amber-900/50 text-amber-400' },
    office_supplies: { label: 'Office Supplies', class: 'bg-blue-900/50 text-blue-400' },
    other: { label: 'Other', class: 'bg-zinc-800 text-zinc-300' },
  }

  const paymentMethodLabels = { cash: 'Cash', bank_transfer: 'Bank Transfer', credit_card: 'Credit Card', cheque: 'Cheque' }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const rangeStart = totalCount === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, totalCount)

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Expenses</h1>
        <Link to="/expenses/new" className="w-full sm:w-auto text-center bg-gradient-to-r from-teal-600 to-teal-500 text-white px-4 py-2 rounded-md hover:from-teal-500 hover:to-teal-400 transition-colors">+ Add Expense</Link>
      </div>

      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Search by description or vendor..." /></div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Category</label>
            <select value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All</option>
              {Object.entries(categoryLabels).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Month</label>
            <select value={filter.month} onChange={(e) => setFilter({ ...filter, month: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All</option>
              {months.map((m) => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</option>)}
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

      {expenses.length === 0 ? (
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
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-zinc-800/50">
                    <td className="px-6 py-4 text-sm text-zinc-500">{formatDate(expense.expense_date)}</td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${categoryLabels[expense.category]?.class || 'bg-zinc-800 text-zinc-300'}`}>{categoryLabels[expense.category]?.label || expense.category}</span></td>
                    <td className="px-6 py-4 text-sm text-zinc-200 max-w-xs truncate">{expense.description}</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">{expense.vendor || '-'}</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">{paymentMethodLabels[expense.payment_method] || expense.payment_method}</td>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-200 text-right">{formatCurrency(expense.amount)}</td>
                    <td className="px-6 py-4 text-sm"><Link to={`/expenses/${expense.id}/edit`} className="text-teal-400 hover:text-teal-300">Edit</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            {expenses.map((expense) => (
              <Link key={expense.id} to={`/expenses/${expense.id}/edit`} className="block bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-800/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm text-zinc-500">{formatDate(expense.expense_date)}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${categoryLabels[expense.category]?.class || 'bg-zinc-800 text-zinc-300'}`}>{categoryLabels[expense.category]?.label || expense.category}</span>
                </div>
                <p className="text-zinc-200 font-medium">{expense.description}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-zinc-500">{paymentMethodLabels[expense.payment_method]}</span>
                  <span className="font-bold text-zinc-200">{formatCurrency(expense.amount)}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination Controls */}
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
              <span className="text-sm text-zinc-400">
                Page {page + 1} of {totalPages}
              </span>
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
