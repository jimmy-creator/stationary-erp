import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Store, Save } from 'lucide-react'

export function StoreSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settingsId, setSettingsId] = useState(null)
  const [formData, setFormData] = useState({
    store_name: '',
    address: '',
    phone: '',
    email: '',
    logo_url: '',
    invoice_header_color: '#4a90c4',
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        setSettingsId(data.id)
        setFormData({
          store_name: data.store_name || '',
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
          logo_url: data.logo_url || '',
          invoice_header_color: data.invoice_header_color || '#4a90c4',
        })
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const settingsData = {
        store_name: formData.store_name,
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        logo_url: formData.logo_url || null,
        invoice_header_color: formData.invoice_header_color || '#4a90c4',
        updated_at: new Date().toISOString(),
      }

      if (settingsId) {
        const { error } = await supabase
          .from('store_settings')
          .update(settingsData)
          .eq('id', settingsId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('store_settings')
          .insert(settingsData)
          .select()
          .single()
        if (error) throw error
        setSettingsId(data.id)
      }

      alert('Store settings saved!')
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Store Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">This information appears on printed invoices and purchase orders</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Store className="w-5 h-5 text-teal-400" />
            Store Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1">Store Name *</label>
              <input
                type="text"
                required
                value={formData.store_name}
                onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                placeholder="Your Store Name"
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                placeholder="Street, Building, City, Country"
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+974 XXXX XXXX"
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="store@example.com"
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1">Logo URL</label>
              <input
                type="text"
                value={formData.logo_url}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                placeholder="/logo-b.svg or https://example.com/logo.png"
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
              />
              <p className="text-xs text-zinc-500 mt-1">Used as the browser tab icon (favicon) for this store.</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1">Invoice Header Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.invoice_header_color}
                  onChange={(e) => setFormData({ ...formData, invoice_header_color: e.target.value })}
                  className="h-10 w-14 bg-zinc-800/50 border border-zinc-700 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.invoice_header_color}
                  onChange={(e) => setFormData({ ...formData, invoice_header_color: e.target.value })}
                  placeholder="#4a90c4"
                  className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">Accent color used on table headers and totals in printed documents.</p>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
          <h2 className="text-lg font-medium text-white mb-4">Print Preview</h2>
          <div className="bg-white rounded-lg p-6 text-black">
            {formData.logo_url && (
              <img
                src={formData.logo_url}
                alt=""
                style={{ maxHeight: '60px', maxWidth: '220px', objectFit: 'contain' }}
                className="mb-2"
              />
            )}
            <h3 className="text-xl font-bold">{formData.store_name || 'Store Name'}</h3>
            {formData.address && <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">{formData.address}</p>}
            <div className="flex gap-4 mt-1">
              {formData.phone && <p className="text-sm text-gray-600">Tel: {formData.phone}</p>}
              {formData.email && <p className="text-sm text-gray-600">Email: {formData.email}</p>}
            </div>
            <div
              className="mt-3 px-3 py-2 text-white text-xs font-semibold uppercase rounded"
              style={{ backgroundColor: formData.invoice_header_color || '#4a90c4' }}
            >
              Sample Invoice Table Header
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl hover:from-teal-500 hover:to-teal-400 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
