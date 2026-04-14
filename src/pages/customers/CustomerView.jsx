import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { User, Phone, Mail, MapPin } from 'lucide-react'

export function CustomerView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [recentSales, setRecentSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    fetchCustomer()
  }, [id])

  const fetchCustomer = async () => {
    try {
      const [customerRes, salesRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).single(),
        supabase.from('sales').select('*').eq('customer_id', id).order('sale_date', { ascending: false }).limit(10),
      ])
      if (customerRes.error) throw customerRes.error
      setCustomer(customerRes.data)
      setRecentSales(salesRes.data || [])
    } catch (error) {
      console.error('Error fetching customer:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id)
      if (error) throw error
      navigate('/customers')
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('Failed to delete customer')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const formatCurrency = (amount) => {
    return `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  const typeLabels = {
    retail: { label: 'Retail', class: 'bg-blue-900/50 text-blue-400 border border-blue-500/30' },
    wholesale: { label: 'Wholesale', class: 'bg-purple-900/50 text-purple-400 border border-purple-500/30' },
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }

  if (!customer) {
    return <div className="text-center py-8"><p className="text-zinc-500">Customer not found.</p><Link to="/customers" className="text-teal-600 hover:underline">Back to list</Link></div>
  }

  const totalSpent = recentSales.reduce((sum, s) => sum + parseFloat(s.grand_total || 0), 0)

  return (
    <div className="max-w-4xl mx-auto">
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-zinc-200 mb-4">Delete Customer</h3>
            <p className="text-zinc-400 mb-6">Are you sure you want to delete <strong>{customer.name}</strong>?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className="px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <Link to="/customers" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to list</Link>
          <h1 className="text-xl lg:text-2xl font-bold text-white">{customer.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Link to={`/customers/${id}/edit`} className="flex-1 sm:flex-none text-center px-4 py-2 text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-md hover:bg-teal-500/20">Edit</Link>
          <button onClick={() => setShowDeleteModal(true)} className="flex-1 sm:flex-none px-4 py-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20">Delete</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <span className={`px-3 py-1.5 text-sm font-medium rounded-lg ${typeLabels[customer.customer_type]?.class}`}>
          {typeLabels[customer.customer_type]?.label}
        </span>
        <span className={`px-3 py-1.5 text-sm font-medium rounded-lg ${customer.is_active ? 'bg-green-900/50 text-green-400 border border-green-500/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
          {customer.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-teal-400" />
            Contact Information
          </h2>
          <div className="space-y-3">
            {customer.phone && <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-zinc-500" /><span className="text-zinc-300">{customer.phone}</span></div>}
            {customer.email && <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-zinc-500" /><span className="text-zinc-300">{customer.email}</span></div>}
            {customer.address && <div className="flex items-start gap-3"><MapPin className="w-4 h-4 text-zinc-500 mt-0.5" /><span className="text-zinc-300 whitespace-pre-wrap">{customer.address}</span></div>}
            {customer.notes && <div className="pt-2 border-t border-zinc-800"><p className="text-sm text-zinc-400">{customer.notes}</p></div>}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4">Purchase Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-zinc-500">Total Orders</span><span className="text-xl font-bold text-white">{recentSales.length}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Total Spent</span><span className="text-xl font-bold text-teal-400">{formatCurrency(totalSpent)}</span></div>
          </div>
        </div>
      </div>

      {recentSales.length > 0 && (
        <div className="mt-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4">Recent Sales</h2>
          <div className="space-y-2">
            {recentSales.map((sale) => (
              <Link key={sale.id} to={`/sales/${sale.id}`} className="flex items-center justify-between bg-zinc-800/30 rounded-lg p-3 hover:bg-zinc-800/50 transition-colors">
                <div>
                  <span className="text-sm text-teal-400 font-medium">{sale.invoice_number}</span>
                  <span className="text-sm text-zinc-500 ml-3">{new Date(sale.sale_date).toLocaleDateString()}</span>
                </div>
                <span className="font-medium text-white">{formatCurrency(sale.grand_total)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
