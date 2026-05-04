import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Users, CheckCircle } from 'lucide-react'
import { SearchInput } from '../../components/SearchInput'
import { useDebounce } from '../../hooks/useDebounce'

export function EmployeesList() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filter, setFilter] = useState({ department: '', status: '' })

  useEffect(() => { fetchEmployees() }, [debouncedSearch])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      let query = supabase.from('employees').select('*').order('created_at', { ascending: false })
      if (debouncedSearch) {
        query = query.or(`first_name.ilike.%${debouncedSearch}%,last_name.ilike.%${debouncedSearch}%,employee_number.ilike.%${debouncedSearch}%,position.ilike.%${debouncedSearch}%`)
      }
      const { data, error } = await query
      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => amount ? `QAR ${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'

  const statusLabels = {
    active: { label: 'Active', class: 'bg-green-900/50 text-green-400' },
    inactive: { label: 'Inactive', class: 'bg-zinc-800 text-zinc-400' },
    on_leave: { label: 'On Leave', class: 'bg-blue-900/50 text-blue-400' },
  }

  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))]

  const filteredEmployees = employees.filter((e) => {
    if (filter.department && e.department !== filter.department) return false
    if (filter.status && e.status !== filter.status) return false
    return true
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Employees</h1>
        <Link to="/employees/new" className="w-full sm:w-auto text-center bg-gradient-to-r from-teal-600 to-teal-500 text-white px-4 py-2 rounded-md hover:from-teal-500 hover:to-teal-400 transition-colors">+ Add Employee</Link>
      </div>

      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Search by name, ID, or position..." /></div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center"><Users className="w-5 h-5 text-teal-400" /></div>
            <div><p className="text-2xl font-bold text-white">{employees.length}</p><p className="text-xs text-zinc-500">Total</p></div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-400" /></div>
            <div><p className="text-2xl font-bold text-white">{employees.filter((e) => e.status === 'active').length}</p><p className="text-xs text-zinc-500">Active</p></div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Department</label>
            <select value={filter.department} onChange={(e) => setFilter({ ...filter, department: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Status</label>
            <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_leave">On Leave</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
      ) : filteredEmployees.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">No employees found.</div>
      ) : (
        <>
          <div className="hidden md:block bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Salary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-zinc-800/50">
                    <td className="px-6 py-4"><p className="text-sm font-medium text-white">{emp.first_name} {emp.last_name}</p><p className="text-xs text-zinc-500">{emp.employee_number}</p></td>
                    <td className="px-6 py-4 text-sm text-zinc-300">{emp.position || '-'}</td>
                    <td className="px-6 py-4 text-sm text-zinc-300">{emp.department || '-'}</td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${statusLabels[emp.status]?.class}`}>{statusLabels[emp.status]?.label}</span></td>
                    <td className="px-6 py-4 text-sm text-zinc-200 text-right">{formatCurrency(emp.salary)}</td>
                    <td className="px-6 py-4 text-sm"><Link to={`/employees/${emp.id}`} className="text-teal-400 hover:text-teal-300">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            {filteredEmployees.map((emp) => (
              <Link key={emp.id} to={`/employees/${emp.id}`} className="block bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-800/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div><p className="font-medium text-white">{emp.first_name} {emp.last_name}</p><p className="text-xs text-zinc-500">{emp.employee_number}</p></div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusLabels[emp.status]?.class}`}>{statusLabels[emp.status]?.label}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">{emp.position || '-'}</span>
                  <span className="font-medium text-zinc-200">{formatCurrency(emp.salary)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
