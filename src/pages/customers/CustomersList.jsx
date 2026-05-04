import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { SearchInput } from '../../components/SearchInput'
import { useDebounce } from '../../hooks/useDebounce'

export function CustomersList() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filter, setFilter] = useState({ type: '' })

  useEffect(() => {
    fetchCustomers()
  }, [debouncedSearch])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      let query = supabase.from('customers').select('*').order('name')

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`)
      }

      const { data, error } = await query
      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const typeLabels = {
    retail: { label: 'Retail', class: 'bg-blue-900/50 text-blue-400' },
    wholesale: { label: 'Wholesale', class: 'bg-purple-900/50 text-purple-400' },
  }

  const filteredCustomers = customers.filter((c) => {
    if (filter.type && c.customer_type !== filter.type) return false
    return true
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Customers</h1>
        <Link to="/customers/new" className="w-full sm:w-auto text-center bg-gradient-to-r from-teal-600 to-teal-500 text-white px-4 py-2 rounded-md hover:from-teal-500 hover:to-teal-400 transition-colors">
          + Add Customer
        </Link>
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, phone, or email..." />
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Type</label>
            <select value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">All Types</option>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </select>
          </div>
          <div className="flex items-end">
            <div className="w-full bg-blue-900/30 border border-blue-800/50 rounded-md p-3">
              <p className="text-sm text-teal-400">Total Customers</p>
              <p className="text-lg font-bold text-teal-300">{filteredCustomers.length}</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
          No customers found. Add your first customer!
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-zinc-800/50">
                    <td className="px-6 py-4 text-sm font-medium text-white">{customer.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeLabels[customer.customer_type]?.class || 'bg-zinc-800 text-zinc-300'}`}>
                        {typeLabels[customer.customer_type]?.label || customer.customer_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-400">{customer.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">{customer.email || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link to={`/customers/${customer.id}`} className="text-teal-400 hover:text-teal-300">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            {filteredCustomers.map((customer) => (
              <Link key={customer.id} to={`/customers/${customer.id}`} className="block bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-800/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-white">{customer.name}</p>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeLabels[customer.customer_type]?.class}`}>
                    {typeLabels[customer.customer_type]?.label}
                  </span>
                </div>
                {customer.phone && <p className="text-sm text-zinc-400">{customer.phone}</p>}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
