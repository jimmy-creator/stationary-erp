import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Package, AlertTriangle, CheckCircle, Archive, ChevronLeft, ChevronRight } from 'lucide-react'
import { SearchInput } from '../../components/SearchInput'
import { useDebounce } from '../../hooks/useDebounce'

const PAGE_SIZE = 20

export function ProductsList() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filter, setFilter] = useState({ category: '', stock: '' })
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Summary stats from a separate count query (reflects full filtered set, not just current page)
  const [stats, setStats] = useState({ total: 0, lowStock: 0, outOfStock: 0 })

  // Reset page when search or category filter changes
  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, filter.category])

  useEffect(() => {
    fetchData()
  }, [debouncedSearch, filter.category, page])

  // Fetch categories once on mount
  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('name')
      .then(({ data }) => setCategories(data || []))
  }, [])

  // Fetch summary stats whenever search or category filter changes (independent of page)
  useEffect(() => {
    fetchStats()
  }, [debouncedSearch, filter.category])

  const buildBaseQuery = (selectClause, opts = {}) => {
    let query = supabase
      .from('products')
      .select(selectClause, opts)

    if (debouncedSearch) {
      query = query.or(
        `name.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%,brand.ilike.%${debouncedSearch}%`
      )
    }

    if (filter.category) {
      query = query.eq('category_id', filter.category)
    }

    return query
  }

  const fetchStats = async () => {
    try {
      // Fetch all products matching search + category filter (no pagination) to compute stats
      const { data, error } = await buildBaseQuery('id, stock_quantity, reorder_level')
      if (error) throw error

      const all = data || []
      setStats({
        total: all.length,
        lowStock: all.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= p.reorder_level).length,
        outOfStock: all.filter((p) => p.stock_quantity <= 0).length,
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)

      const query = buildBaseQuery('*, categories(name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      const { data, error, count } = await query
      if (error) throw error

      setProducts(data || [])
      setTotalCount(count ?? 0)
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  // Stock filter is kept client-side because "low stock" depends on per-product reorder_level
  const filteredProducts = products.filter((p) => {
    if (filter.stock === 'low' && !(p.stock_quantity > 0 && p.stock_quantity <= p.reorder_level)) return false
    if (filter.stock === 'out' && p.stock_quantity > 0) return false
    if (filter.stock === 'in' && p.stock_quantity <= 0) return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const rangeStart = page * PAGE_SIZE + 1
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, totalCount)

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Products</h1>
        <Link
          to="/products/new"
          className="w-full sm:w-auto text-center bg-gradient-to-r from-teal-600 to-teal-500 text-white px-4 py-2 rounded-md hover:from-teal-500 hover:to-teal-400 transition-colors"
        >
          + Add Product
        </Link>
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, SKU, or brand..." />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-zinc-500">Total Products</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.lowStock}</p>
              <p className="text-xs text-zinc-500">Low Stock</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <Archive className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.outOfStock}</p>
              <p className="text-xs text-zinc-500">Out of Stock</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Category</label>
            <select
              value={filter.category}
              onChange={(e) => setFilter({ ...filter, category: e.target.value })}
              className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Stock Status</label>
            <select
              value={filter.stock}
              onChange={(e) => setFilter({ ...filter, stock: e.target.value })}
              className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All</option>
              <option value="in">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
          No products found. Add your first product!
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Brand</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-zinc-500 uppercase">Stock</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Cost</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredProducts.map((product) => {
                  const isLow = product.stock_quantity > 0 && product.stock_quantity <= product.reorder_level
                  const isOut = product.stock_quantity <= 0
                  return (
                    <tr key={product.id} className="hover:bg-zinc-800/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img src={product.image_url} alt="" className="w-10 h-10 object-cover rounded-lg border border-zinc-700 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4 text-zinc-600" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-white">{product.name}</p>
                            <p className="text-xs text-zinc-500">{product.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-300">
                        {product.categories?.name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-400">{product.brand || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            isOut ? 'bg-red-900/50 text-red-400' :
                            isLow ? 'bg-orange-900/50 text-orange-400' :
                            'bg-green-900/50 text-green-400'
                          }`}>
                            {product.stock_quantity} {product.unit}
                          </span>
                          {product.secondary_unit && product.unit_conversion && product.stock_quantity > 0 && (
                            <span className="text-xs text-zinc-500">
                              = {Math.round(product.stock_quantity * product.unit_conversion)} {product.secondary_unit}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-400 text-right">
                        {formatCurrency(product.cost_price)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-zinc-200 text-right">
                        {formatCurrency(product.selling_price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link to={`/products/${product.id}`} className="text-teal-400 hover:text-teal-300">
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {filteredProducts.map((product) => {
              const isLow = product.stock_quantity > 0 && product.stock_quantity <= product.reorder_level
              const isOut = product.stock_quantity <= 0
              return (
                <Link
                  key={product.id}
                  to={`/products/${product.id}`}
                  className="block bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-white">{product.name}</p>
                      <p className="text-xs text-zinc-500">{product.sku}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      isOut ? 'bg-red-900/50 text-red-400' :
                      isLow ? 'bg-orange-900/50 text-orange-400' :
                      'bg-green-900/50 text-green-400'
                    }`}>
                      {product.stock_quantity} {product.unit}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-zinc-400">{product.categories?.name || '-'}</span>
                    <span className="font-bold text-zinc-200">{formatCurrency(product.selling_price)}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}

      {/* Pagination Controls */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
          <p className="text-sm text-zinc-400">
            Showing {rangeStart}-{rangeEnd} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-2 text-sm rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-sm text-zinc-400 px-2">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-2 text-sm rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
