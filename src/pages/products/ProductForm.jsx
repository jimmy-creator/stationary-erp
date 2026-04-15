import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Upload, X, Image } from 'lucide-react'

// Convert image to WebP and compress
async function compressToWebP(file, maxWidth = 800, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => resolve(blob),
        'image/webp',
        quality
      )
    }
    img.src = URL.createObjectURL(file)
  })
}

export function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)
  const fileInputRef = useRef(null)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [categories, setCategories] = useState([])
  const [imagePreview, setImagePreview] = useState(null)
  const [imageFile, setImageFile] = useState(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    brand: '',
    unit: 'Pcs',
    secondary_unit: '',
    unit_conversion: '',
    cost_price: '',
    selling_price: '',
    stock_quantity: '0',
    reorder_level: '5',
    barcode: '',
    is_active: true,
    image_url: '',
  })

  useEffect(() => {
    fetchCategories()
    if (isEditing) {
      fetchProduct()
    } else {
      fetchNextBarcode()
    }
  }, [id])

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name')
    setCategories(data || [])
  }

  const fetchNextBarcode = async () => {
    const { data } = await supabase
      .from('products')
      .select('barcode')
      .not('barcode', 'is', null)

    // Find the highest numeric barcode
    let max = 999
    if (data && data.length > 0) {
      data.forEach(({ barcode }) => {
        const n = parseInt(barcode, 10)
        if (!isNaN(n) && n > max) max = n
      })
    }
    setFormData((prev) => ({ ...prev, barcode: String(max + 1) }))
  }

  const fetchProduct = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single()
      if (error) throw error
      setFormData({
        name: data.name || '',
        description: data.description || '',
        category_id: data.category_id || '',
        brand: data.brand || '',
        unit: data.unit || 'Pcs',
        secondary_unit: data.secondary_unit || '',
        unit_conversion: data.unit_conversion?.toString() || '',
        cost_price: data.cost_price || '',
        selling_price: data.selling_price || '',
        stock_quantity: data.stock_quantity?.toString() || '0',
        reorder_level: data.reorder_level?.toString() || '5',
        barcode: data.barcode || '',
        is_active: data.is_active ?? true,
        image_url: data.image_url || '',
      })
      if (data.image_url) setImagePreview(data.image_url)
    } catch (error) {
      console.error('Error fetching product:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Show preview immediately
    setImagePreview(URL.createObjectURL(file))

    // Convert to WebP
    setUploading(true)
    try {
      const webpBlob = await compressToWebP(file)
      setImageFile(webpBlob)
    } catch (error) {
      console.error('Error compressing image:', error)
      setImageFile(file)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = () => {
    setImagePreview(null)
    setImageFile(null)
    setFormData({ ...formData, image_url: '' })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadImage = async (productId) => {
    if (!imageFile) return formData.image_url || null

    const fileName = `${productId}.webp`
    const filePath = `product-images/${fileName}`

    const { error } = await supabase.storage
      .from('products')
      .upload(filePath, imageFile, {
        contentType: 'image/webp',
        upsert: true,
      })

    if (error) {
      console.error('Upload error:', error)
      return formData.image_url || null
    }

    const { data: urlData } = supabase.storage
      .from('products')
      .getPublicUrl(filePath)

    return urlData.publicUrl + '?t=' + Date.now()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Check barcode uniqueness
      if (formData.barcode) {
        let barcodeQuery = supabase
          .from('products')
          .select('id, name')
          .eq('barcode', formData.barcode)

        if (isEditing) {
          barcodeQuery = barcodeQuery.neq('id', id)
        }

        const { data: existing } = await barcodeQuery.maybeSingle()
        if (existing) {
          alert(`Barcode already used by "${existing.name}". Please use a different barcode.`)
          setSaving(false)
          return
        }
      }

      const productData = {
        name: formData.name,
        description: formData.description || null,
        category_id: formData.category_id || null,
        brand: formData.brand || null,
        unit: formData.unit,
        secondary_unit: formData.secondary_unit || null,
        unit_conversion: formData.secondary_unit && formData.unit_conversion
          ? parseFloat(formData.unit_conversion) || null
          : null,
        cost_price: parseFloat(formData.cost_price) || 0,
        selling_price: parseFloat(formData.selling_price) || 0,
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        reorder_level: parseInt(formData.reorder_level) || 5,
        barcode: formData.barcode || null,
        is_active: formData.is_active,
      }

      let productId = id

      if (isEditing) {
        const { error } = await supabase.from('products').update(productData).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('products').insert(productData).select().single()
        if (error) throw error
        productId = data.id
      }

      // Upload image if changed
      if (imageFile) {
        const imageUrl = await uploadImage(productId)
        if (imageUrl) {
          await supabase.from('products').update({ image_url: imageUrl }).eq('id', productId)
        }
      } else if (!imagePreview && formData.image_url) {
        // Image was removed
        await supabase.from('products').update({ image_url: null }).eq('id', productId)
      }

      navigate(`/products/${productId}`)
    } catch (error) {
      console.error('Error saving product:', error)
      alert('Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  const units = ['Pcs', 'Pack', 'Box', 'Dozen', 'Set', 'Ream', 'Roll', 'Kg', 'Meter']

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link to="/products" className="text-teal-600 hover:underline text-sm mb-2 inline-block">
          &larr; Back to list
        </Link>
        <h1 className="text-xl lg:text-2xl font-bold text-white">
          {isEditing ? 'Edit Product' : 'New Product'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product Image */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
          <h2 className="text-lg font-medium text-white mb-4">Product Image</h2>
          <div className="flex items-start gap-4">
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-32 h-32 object-cover rounded-xl border border-zinc-700"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white hover:bg-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-32 h-32 border-2 border-dashed border-zinc-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-teal-500 transition-colors"
              >
                <Image className="w-8 h-8 text-zinc-600 mb-1" />
                <span className="text-xs text-zinc-500">Add Image</span>
              </div>
            )}
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                {imagePreview ? 'Change Image' : 'Upload Image'}
              </button>
              <p className="text-xs text-zinc-500 mt-2">
                Auto-converted to WebP and compressed. Max 800px width.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
          <h2 className="text-lg font-medium text-white mb-4">Product Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1">Product Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Pilot G2 Gel Pen"
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Category</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Brand</label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="e.g. Pilot"
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Base Unit</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
              >
                {units.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Secondary Unit <span className="text-zinc-500 font-normal">(optional)</span></label>
              <input
                type="text"
                value={formData.secondary_unit}
                onChange={(e) => setFormData({ ...formData, secondary_unit: e.target.value })}
                placeholder="e.g. Pieces, Pcs"
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
              />
            </div>
            {formData.secondary_unit && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  How many <span className="text-teal-400">{formData.secondary_unit}</span> per <span className="text-teal-400">{formData.unit}</span>?
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400 text-sm shrink-0">1 {formData.unit} =</span>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    value={formData.unit_conversion}
                    onChange={(e) => setFormData({ ...formData, unit_conversion: e.target.value })}
                    placeholder="e.g. 12"
                    className="w-32 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
                  />
                  <span className="text-zinc-400 text-sm">{formData.secondary_unit}</span>
                </div>
                {formData.unit_conversion && parseFloat(formData.unit_conversion) > 0 && (
                  <p className="text-xs text-teal-400/70 mt-1">
                    Cost per {formData.secondary_unit}: {formData.cost_price
                      ? `QAR ${(parseFloat(formData.cost_price) / parseFloat(formData.unit_conversion)).toFixed(3)}`
                      : '—'}
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Barcode <span className="text-zinc-500 font-normal">(auto-assigned, can edit)</span></label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="Auto-assigned"
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
              />
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
          <h2 className="text-lg font-medium text-white mb-4">Pricing & Stock</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Cost Price (QAR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                placeholder="0.00"
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Selling Price (QAR) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                placeholder="0.00"
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Stock Quantity</label>
              <input
                type="number"
                min="0"
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Reorder Level</label>
              <input
                type="number"
                min="0"
                value={formData.reorder_level}
                onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-zinc-600 bg-zinc-800 text-teal-500 focus:ring-teal-500"
                />
                <span className="text-sm text-zinc-300">Product is active</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <Link
            to="/products"
            className="w-full sm:w-auto text-center px-6 py-2 border border-zinc-700 rounded-xl text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || uploading}
            className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl hover:from-teal-500 hover:to-teal-400 disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEditing ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  )
}
