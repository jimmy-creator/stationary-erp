import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { SearchInput } from '../../components/SearchInput'
import { useDebounce } from '../../hooks/useDebounce'

export function SuppliersList() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    fetchSuppliers()
  }, [debouncedSearch])

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      let query = supabase.from('suppliers').select('*').order('name')

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,contact_person.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`)
      }

      const { data, error } = await query
      if (error) throw error
      setSuppliers(data || [])
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Suppliers</h1>
        <Link to="/suppliers/new" className="w-full sm:w-auto text-center bg-gradient-to-r from-teal-600 to-teal-500 text-white px-4 py-2 rounded-md hover:from-teal-500 hover:to-teal-400 transition-colors">
          + Add Supplier
        </Link>
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, contact, or phone..." />
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
          No suppliers found. Add your first supplier!
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Contact Person</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-zinc-800/50">
                    <td className="px-6 py-4 text-sm font-medium text-white">{supplier.name}</td>
                    <td className="px-6 py-4 text-sm text-zinc-300">{supplier.contact_person || '-'}</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">{supplier.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">{supplier.email || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${supplier.is_active ? 'bg-green-900/50 text-green-400' : 'bg-zinc-800 text-zinc-400'}`}>
                        {supplier.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link to={`/suppliers/${supplier.id}`} className="text-teal-400 hover:text-teal-300">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            {suppliers.map((supplier) => (
              <Link key={supplier.id} to={`/suppliers/${supplier.id}`} className="block bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-800/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-white">{supplier.name}</p>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${supplier.is_active ? 'bg-green-900/50 text-green-400' : 'bg-zinc-800 text-zinc-400'}`}>
                    {supplier.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {supplier.contact_person && <p className="text-sm text-zinc-400">{supplier.contact_person}</p>}
                {supplier.phone && <p className="text-sm text-zinc-500">{supplier.phone}</p>}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
