import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Package, AlertTriangle, Archive, TrendingUp } from 'lucide-react'
import { SearchInput } from '../components/SearchInput'
import { useDebounce } from '../hooks/useDebounce'

export function StockValue() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filter, setFilter] = useState({ category: '', stock: '', sort: 'value_desc' })

  useEffect(() => {
    fetchData()
  }, [debouncedSearch])

  const fetchData = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('products')
        .select('*, categories(name)')
        .eq('is_active', true)
        .order('name')

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%,brand.ilike.%${debouncedSearch}%`)
      }

      const [productsRes, categoriesRes] = await Promise.all([
        query,
        supabase.from('categories').select('*').order('name'),
      ])

      if (productsRes.error) throw productsRes.error

      const enriched = (productsRes.data || []).map((p) => {
        const stockQty = Number(p.stock_quantity) || 0
        return {
          ...p,
          stock_quantity: stockQty,
          cost_value: (parseFloat(p.cost_price) || 0) * stockQty,
          retail_value: (parseFloat(p.selling_price) || 0) * stockQty,
          potential_profit: ((parseFloat(p.selling_price) || 0) - (parseFloat(p.cost_price) || 0)) * stockQty,
          is_low: stockQty > 0 && stockQty <= p.reorder_level,
          is_out: stockQty <= 0,
        }
      })

      setProducts(enriched)
      setCategories(categoriesRes.data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  const filteredProducts = products
    .filter((p) => {
      if (filter.category && p.category_id !== filter.category) return false
      if (filter.stock === 'low' && !p.is_low) return false
      if (filter.stock === 'out' && !p.is_out) return false
      if (filter.stock === 'in' && p.stock_quantity <= 0) return false
      return true
    })
    .sort((a, b) => {
      switch (filter.sort) {
        case 'value_desc': return b.cost_value - a.cost_value
        case 'value_asc': return a.cost_value - b.cost_value
        case 'qty_desc': return b.stock_quantity - a.stock_quantity
        case 'qty_asc': return a.stock_quantity - b.stock_quantity
        case 'name': return a.name.localeCompare(b.name)
        default: return b.cost_value - a.cost_value
      }
    })

  const totalCostValue = filteredProducts.reduce((sum, p) => sum + p.cost_value, 0)
  const totalRetailValue = filteredProducts.reduce((sum, p) => sum + p.retail_value, 0)
  const totalPotentialProfit = filteredProducts.reduce((sum, p) => sum + p.potential_profit, 0)
  const totalItems = filteredProducts.reduce((sum, p) => sum + (p.stock_quantity || 0), 0)
  const lowStockCount = products.filter((p) => p.is_low).length
  const outOfStockCount = products.filter((p) => p.is_out).length

  // Category breakdown
  const categoryBreakdown = {}
  filteredProducts.forEach((p) => {
    const catName = p.categories?.name || 'Uncategorized'
    if (!categoryBreakdown[catName]) {
      categoryBreakdown[catName] = { cost: 0, retail: 0, items: 0, products: 0 }
    }
    categoryBreakdown[catName].cost += p.cost_value
    categoryBreakdown[catName].retail += p.retail_value
    categoryBreakdown[catName].items += p.stock_quantity || 0
    categoryBreakdown[catName].products += 1
  })

  const sortedCategories = Object.entries(categoryBreakdown).sort(([, a], [, b]) => b.cost - a.cost)

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Stock Value Report</h1>
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, SKU, or brand..." />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Stock at Cost</p>
              <p className="text-lg font-bold text-white">{formatCurrency(totalCostValue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Stock at Retail</p>
              <p className="text-lg font-bold text-teal-400">{formatCurrency(totalRetailValue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Potential Profit</p>
              <p className="text-lg font-bold text-green-400">{formatCurrency(totalPotentialProfit)}</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Units</p>
              <p className="text-lg font-bold text-white">{totalItems.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="flex flex-wrap gap-3 mb-6">
          {outOfStockCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-lg">
              <Archive className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400"><strong>{outOfStockCount}</strong> products out of stock</span>
            </div>
          )}
          {lowStockCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-orange-900/20 border border-orange-500/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-orange-400"><strong>{lowStockCount}</strong> products low stock</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Category</label>
            <select value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Stock Status</label>
            <select value={filter.stock} onChange={(e) => setFilter({ ...filter, stock: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All</option>
              <option value="in">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Sort By</label>
            <select value={filter.sort} onChange={(e) => setFilter({ ...filter, sort: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="value_desc">Value (High to Low)</option>
              <option value="value_asc">Value (Low to High)</option>
              <option value="qty_desc">Quantity (High to Low)</option>
              <option value="qty_asc">Quantity (Low to High)</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {sortedCategories.length > 1 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-medium text-zinc-400 uppercase mb-4">Value by Category</h3>
          <div className="space-y-3">
            {sortedCategories.map(([catName, data]) => {
              const pct = totalCostValue > 0 ? (data.cost / totalCostValue) * 100 : 0
              return (
                <div key={catName}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-300">{catName} <span className="text-zinc-500">({data.products} products, {data.items} units)</span></span>
                    <span className="text-white font-medium">{formatCurrency(data.cost)}</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2">
                    <div className="bg-gradient-to-r from-teal-600 to-teal-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Products Table */}
      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
          No products found.
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
                  <th className="px-6 py-3 text-center text-xs font-medium text-zinc-500 uppercase">Stock</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Cost Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Sell Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Cost Value</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Retail Value</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-800/50">
                    <td className="px-6 py-4">
                      <Link to={`/products/${p.id}`} className="text-sm font-medium text-teal-400 hover:text-teal-300">{p.name}</Link>
                      <p className="text-xs text-zinc-500">{p.sku}{p.brand ? ` - ${p.brand}` : ''}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400">{p.categories?.name || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        p.is_out ? 'bg-red-900/50 text-red-400' :
                        p.is_low ? 'bg-orange-900/50 text-orange-400' :
                        'bg-green-900/50 text-green-400'
                      }`}>
                        {p.stock_quantity} {p.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400 text-right">{formatCurrency(p.cost_price)}</td>
                    <td className="px-6 py-4 text-sm text-zinc-300 text-right">{formatCurrency(p.selling_price)}</td>
                    <td className="px-6 py-4 text-sm text-zinc-200 text-right font-medium">{formatCurrency(p.cost_value)}</td>
                    <td className="px-6 py-4 text-sm text-teal-400 text-right">{formatCurrency(p.retail_value)}</td>
                    <td className={`px-6 py-4 text-sm text-right font-medium ${p.potential_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(p.potential_profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-zinc-800/30">
                <tr>
                  <td colSpan={2} className="px-6 py-3 text-sm font-medium text-zinc-300">Total ({filteredProducts.length} products)</td>
                  <td className="px-6 py-3 text-sm font-bold text-white text-center">{totalItems.toLocaleString()}</td>
                  <td></td>
                  <td></td>
                  <td className="px-6 py-3 text-sm font-bold text-white text-right">{formatCurrency(totalCostValue)}</td>
                  <td className="px-6 py-3 text-sm font-bold text-teal-400 text-right">{formatCurrency(totalRetailValue)}</td>
                  <td className="px-6 py-3 text-sm font-bold text-green-400 text-right">{formatCurrency(totalPotentialProfit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {filteredProducts.map((p) => (
              <Link key={p.id} to={`/products/${p.id}`} className="block bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-800/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-white">{p.name}</p>
                    <p className="text-xs text-zinc-500">{p.sku}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    p.is_out ? 'bg-red-900/50 text-red-400' :
                    p.is_low ? 'bg-orange-900/50 text-orange-400' :
                    'bg-green-900/50 text-green-400'
                  }`}>
                    {p.stock_quantity} {p.unit}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><p className="text-xs text-zinc-500">Cost Value</p><p className="text-sm text-white">{formatCurrency(p.cost_value)}</p></div>
                  <div><p className="text-xs text-zinc-500">Retail Value</p><p className="text-sm text-teal-400">{formatCurrency(p.retail_value)}</p></div>
                  <div><p className="text-xs text-zinc-500">Profit</p><p className={`text-sm font-bold ${p.potential_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(p.potential_profit)}</p></div>
                </div>
              </Link>
            ))}

            {/* Mobile Total */}
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
              <p className="text-sm font-medium text-zinc-300 mb-2">Total ({filteredProducts.length} products, {totalItems.toLocaleString()} units)</p>
              <div className="grid grid-cols-3 gap-2">
                <div><p className="text-xs text-zinc-500">Cost</p><p className="text-sm font-bold text-white">{formatCurrency(totalCostValue)}</p></div>
                <div><p className="text-xs text-zinc-500">Retail</p><p className="text-sm font-bold text-teal-400">{formatCurrency(totalRetailValue)}</p></div>
                <div><p className="text-xs text-zinc-500">Profit</p><p className="text-sm font-bold text-green-400">{formatCurrency(totalPotentialProfit)}</p></div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
