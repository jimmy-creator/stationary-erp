import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Package, Trash2, Pencil } from 'lucide-react'

const METHOD_LABELS = { cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque' }

export function FixedAssetsList() {
  const { isEmployee } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('fixed_assets')
        .select('*')
        .order('purchase_date', { ascending: false })
      if (error) throw error
      setRows(data || [])
    } catch (error) {
      console.error('Error fetching fixed assets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this fixed asset?')) return
    try {
      const { error } = await supabase.from('fixed_assets').delete().eq('id', id)
      if (error) throw error
      setRows(rows.filter((r) => r.id !== id))
    } catch (error) {
      console.error('Error deleting:', error)
      alert('Failed to delete')
    }
  }

  const fmt = (n) => `QAR ${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const totalCost = rows.reduce((s, r) => s + parseFloat(r.cost || 0), 0)

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Fixed Assets</h1>
        <Link to="/fixed-assets/new" className="w-full sm:w-auto text-center bg-gradient-to-r from-teal-600 to-teal-500 text-white px-4 py-2 rounded-md hover:from-teal-500 hover:to-teal-400">
          + Add Asset
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center"><Package className="w-5 h-5 text-teal-400" /></div>
            <div><p className="text-xs text-zinc-500">Total Assets</p><p className="text-lg font-bold text-white">{rows.length}</p></div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center"><Package className="w-5 h-5 text-amber-400" /></div>
            <div><p className="text-xs text-zinc-500">Total Cost</p><p className="text-lg font-bold text-amber-400">{fmt(totalCost)}</p></div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
      ) : rows.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">No fixed assets yet.</div>
      ) : (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-zinc-800">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Purchased</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Method</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-800/50">
                  <td className="px-6 py-4 text-sm font-medium text-white">{r.name}</td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{r.category || '-'}</td>
                  <td className="px-6 py-4 text-sm text-zinc-300">{fmtDate(r.purchase_date)}</td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{METHOD_LABELS[r.payment_method] || r.payment_method}</td>
                  <td className="px-6 py-4 text-sm font-bold text-amber-400 text-right">{fmt(r.cost)}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      {!isEmployee && <Link to={`/fixed-assets/${r.id}/edit`} className="text-zinc-400 hover:text-teal-400" title="Edit"><Pencil className="w-4 h-4" /></Link>}
                      {!isEmployee && <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-300" title="Delete"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-zinc-800/30">
              <tr>
                <td colSpan={4} className="px-6 py-3 text-sm font-medium text-zinc-300">Total</td>
                <td className="px-6 py-3 text-sm font-bold text-amber-400 text-right">{fmt(totalCost)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
