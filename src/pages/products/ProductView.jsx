import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Package, Tag, Barcode, AlertTriangle } from 'lucide-react'

export function ProductView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    fetchProduct()
  }, [id])

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('id', id)
        .single()
      if (error) throw error
      setProduct(data)
    } catch (error) {
      console.error('Error fetching product:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
      navigate('/products')
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Failed to delete product. It may be referenced in sales or purchase orders.')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const formatCurrency = (amount) => {
    if (!amount) return '-'
    return `QAR ${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">Product not found.</p>
        <Link to="/products" className="text-teal-600 hover:underline">Back to list</Link>
      </div>
    )
  }

  const isLow = product.stock_quantity > 0 && product.stock_quantity <= product.reorder_level
  const isOut = product.stock_quantity <= 0
  const margin = product.selling_price && product.cost_price
    ? (((product.selling_price - product.cost_price) / product.selling_price) * 100).toFixed(1)
    : null

  return (
    <div className="max-w-4xl mx-auto">
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-zinc-200 mb-4">Delete Product</h3>
            <p className="text-zinc-400 mb-6">
              Are you sure you want to delete <strong>{product.name}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className="px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <Link to="/products" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to list</Link>
          <h1 className="text-xl lg:text-2xl font-bold text-white">{product.name}</h1>
          <p className="text-zinc-500">{product.sku}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Link to={`/products/${id}/edit`} className="flex-1 sm:flex-none text-center px-4 py-2 text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-md hover:bg-teal-500/20">Edit</Link>
          <button onClick={() => setShowDeleteModal(true)} className="flex-1 sm:flex-none px-4 py-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20">Delete</button>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex flex-wrap gap-3 mb-6">
        <span className={`px-3 py-1.5 text-sm font-medium rounded-lg ${product.is_active ? 'bg-green-900/50 text-green-400 border border-green-500/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
          {product.is_active ? 'Active' : 'Inactive'}
        </span>
        <span className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-2 ${
          isOut ? 'bg-red-900/50 text-red-400 border border-red-500/30' :
          isLow ? 'bg-orange-900/50 text-orange-400 border border-orange-500/30' :
          'bg-green-900/50 text-green-400 border border-green-500/30'
        }`}>
          {(isOut || isLow) && <AlertTriangle className="w-4 h-4" />}
          {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'} ({product.stock_quantity} {product.unit})
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-teal-400" />
            Product Details
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-zinc-500">Category</span><span className="text-zinc-300">{product.categories?.name || '-'}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Brand</span><span className="text-zinc-300">{product.brand || '-'}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Unit</span><span className="text-zinc-300">{product.unit}</span></div>
            {product.barcode && <div className="flex justify-between"><span className="text-zinc-500">Barcode</span><span className="text-zinc-300">{product.barcode}</span></div>}
            {product.description && <div className="pt-2 border-t border-zinc-800"><p className="text-sm text-zinc-400">{product.description}</p></div>}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Tag className="w-5 h-5 text-green-400" />
            Pricing & Stock
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-zinc-500">Cost Price</span><span className="text-zinc-300">{formatCurrency(product.cost_price)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Selling Price</span><span className="text-xl font-bold text-white">{formatCurrency(product.selling_price)}</span></div>
            {margin && <div className="flex justify-between"><span className="text-zinc-500">Margin</span><span className="text-emerald-400 font-medium">{margin}%</span></div>}
            <div className="flex justify-between"><span className="text-zinc-500">Stock</span><span className="text-zinc-300">{product.stock_quantity} {product.unit}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Reorder Level</span><span className="text-zinc-300">{product.reorder_level} {product.unit}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Stock Value</span><span className="text-zinc-300">{formatCurrency(product.stock_quantity * product.cost_price)}</span></div>
          </div>
        </div>
      </div>

      <div className="mt-6 text-xs text-zinc-600 flex gap-4">
        <span>Created: {new Date(product.created_at).toLocaleDateString()}</span>
        <span>Updated: {new Date(product.updated_at).toLocaleDateString()}</span>
      </div>
    </div>
  )
}
