import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Building2, Phone, Mail, MapPin, FileText } from 'lucide-react'

export function SupplierView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [supplier, setSupplier] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    fetchSupplier()
  }, [id])

  const fetchSupplier = async () => {
    try {
      const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).single()
      if (error) throw error
      setSupplier(data)
    } catch (error) {
      console.error('Error fetching supplier:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id)
      if (error) throw error
      navigate('/suppliers')
    } catch (error) {
      console.error('Error deleting supplier:', error)
      alert('Failed to delete supplier')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }

  if (!supplier) {
    return <div className="text-center py-8"><p className="text-zinc-500">Supplier not found.</p><Link to="/suppliers" className="text-teal-600 hover:underline">Back to list</Link></div>
  }

  return (
    <div className="max-w-4xl mx-auto">
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-zinc-200 mb-4">Delete Supplier</h3>
            <p className="text-zinc-400 mb-6">Are you sure you want to delete <strong>{supplier.name}</strong>?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className="px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <Link to="/suppliers" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to list</Link>
          <h1 className="text-xl lg:text-2xl font-bold text-white">{supplier.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Link to={`/suppliers/${id}/edit`} className="flex-1 sm:flex-none text-center px-4 py-2 text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-md hover:bg-teal-500/20">Edit</Link>
          <button onClick={() => setShowDeleteModal(true)} className="flex-1 sm:flex-none px-4 py-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20">Delete</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <span className={`px-3 py-1.5 text-sm font-medium rounded-lg ${supplier.is_active ? 'bg-green-900/50 text-green-400 border border-green-500/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
          {supplier.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-400" />
            Contact Information
          </h2>
          <div className="space-y-3">
            {supplier.contact_person && <div className="flex items-center gap-3"><span className="text-zinc-500">Contact:</span><span className="text-zinc-300">{supplier.contact_person}</span></div>}
            {supplier.phone && <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-zinc-500" /><span className="text-zinc-300">{supplier.phone}</span></div>}
            {supplier.email && <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-zinc-500" /><span className="text-zinc-300">{supplier.email}</span></div>}
            {supplier.address && <div className="flex items-start gap-3"><MapPin className="w-4 h-4 text-zinc-500 mt-0.5" /><span className="text-zinc-300 whitespace-pre-wrap">{supplier.address}</span></div>}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            Business Details
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-zinc-500">VAT Number</span><span className="text-zinc-300">{supplier.vat_number || '-'}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Payment Terms</span><span className="text-zinc-300">{supplier.payment_terms || '-'}</span></div>
            {supplier.notes && <div className="pt-2 border-t border-zinc-800"><p className="text-sm text-zinc-400">{supplier.notes}</p></div>}
          </div>
        </div>
      </div>

      <div className="mt-6 text-xs text-zinc-600 flex gap-4">
        <span>Created: {new Date(supplier.created_at).toLocaleDateString()}</span>
        <span>Updated: {new Date(supplier.updated_at).toLocaleDateString()}</span>
      </div>
    </div>
  )
}
