import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { SearchInput } from '../../components/SearchInput'
import { useDebounce } from '../../hooks/useDebounce'

export function CategoriesList() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    fetchCategories()
  }, [debouncedSearch])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      let query = supabase.from('categories').select('*').order('name')

      if (debouncedSearch) {
        query = query.ilike('name', `%${debouncedSearch}%`)
      }

      const { data, error } = await query
      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete category "${name}"? Products in this category will lose their category.`)) return
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
      setCategories(categories.filter((c) => c.id !== id))
    } catch (error) {
      console.error('Error deleting category:', error)
      alert('Failed to delete category')
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
        <h1 className="text-xl lg:text-2xl font-bold text-white">Categories</h1>
        <Link
          to="/categories/new"
          className="w-full sm:w-auto text-center bg-gradient-to-r from-teal-600 to-teal-500 text-white px-4 py-2 rounded-md hover:from-teal-500 hover:to-teal-400 transition-colors"
        >
          + Add Category
        </Link>
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search categories..." />
      </div>

      {categories.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
          No categories found. Add your first category!
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-zinc-800/50">
                  <td className="px-6 py-4 text-sm font-medium text-white">{cat.name}</td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{cat.description || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                    <Link to={`/categories/${cat.id}/edit`} className="text-teal-400 hover:text-teal-300">Edit</Link>
                    <button onClick={() => handleDelete(cat.id, cat.name)} className="text-red-400 hover:text-red-300">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
