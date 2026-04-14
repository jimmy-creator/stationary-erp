import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Mail, Phone, Briefcase, CreditCard } from 'lucide-react'

export function EmployeeView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => { fetchEmployee() }, [id])

  const fetchEmployee = async () => {
    try {
      const { data, error } = await supabase.from('employees').select('*').eq('id', id).single()
      if (error) throw error
      setEmployee(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { error } = await supabase.from('employees').delete().eq('id', id)
      if (error) throw error
      navigate('/employees')
    } catch (error) {
      console.error('Error:', error); alert('Failed to delete')
    } finally { setDeleting(false); setShowDeleteModal(false) }
  }

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'
  const formatCurrency = (amount) => amount ? `QAR ${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'

  const statusLabels = {
    active: { label: 'Active', class: 'bg-green-900/50 text-green-400 border border-green-500/30' },
    inactive: { label: 'Inactive', class: 'bg-zinc-800 text-zinc-400 border border-zinc-700' },
    on_leave: { label: 'On Leave', class: 'bg-blue-900/50 text-blue-400 border border-blue-500/30' },
  }

  if (loading) return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  if (!employee) return <div className="text-center py-8"><p className="text-zinc-500">Not found.</p><Link to="/employees" className="text-teal-600 hover:underline">Back</Link></div>

  return (
    <div className="max-w-4xl mx-auto">
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-zinc-200 mb-4">Delete Employee</h3>
            <p className="text-zinc-400 mb-6">Delete <strong>{employee.first_name} {employee.last_name}</strong>?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className="px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <Link to="/employees" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to list</Link>
          <h1 className="text-xl lg:text-2xl font-bold text-white">{employee.first_name} {employee.last_name}</h1>
          <p className="text-zinc-500">{employee.employee_number}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Link to={`/employees/${id}/edit`} className="flex-1 sm:flex-none text-center px-4 py-2 text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-md hover:bg-teal-500/20">Edit</Link>
          <button onClick={() => setShowDeleteModal(true)} className="flex-1 sm:flex-none px-4 py-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20">Delete</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <span className={`px-3 py-1.5 text-sm font-medium rounded-lg ${statusLabels[employee.status]?.class}`}>{statusLabels[employee.status]?.label}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2"><Mail className="w-5 h-5 text-teal-400" />Contact</h2>
          <div className="space-y-3">
            {employee.email && <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-zinc-500" /><span className="text-zinc-300">{employee.email}</span></div>}
            {employee.phone && <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-zinc-500" /><span className="text-zinc-300">{employee.phone}</span></div>}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2"><Briefcase className="w-5 h-5 text-purple-400" />Employment</h2>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-zinc-500">Position</span><span className="text-zinc-300">{employee.position || '-'}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Department</span><span className="text-zinc-300">{employee.department || '-'}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Hire Date</span><span className="text-zinc-300">{formatDate(employee.hire_date)}</span></div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-green-400" />Salary</h2>
          <div className="flex justify-between"><span className="text-zinc-500">Monthly</span><span className="text-xl font-bold text-white">{formatCurrency(employee.salary)}</span></div>
        </div>
      </div>

      <div className="mt-6 text-xs text-zinc-600 flex gap-4">
        <span>Created: {formatDate(employee.created_at)}</span>
        <span>Updated: {formatDate(employee.updated_at)}</span>
      </div>
    </div>
  )
}
