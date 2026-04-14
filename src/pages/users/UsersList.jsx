import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Shield, ShieldCheck, Settings, Trash2, X } from 'lucide-react'

export function UsersList() {
  const navigate = useNavigate()
  const { isAdmin, user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState({ show: false, user: null })
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!isAdmin) {
      navigate('/unauthorized')
      return
    }
    fetchUsers()
  }, [isAdmin, navigate])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId)

      if (error) throw error

      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      )
    } catch (error) {
      console.error('Error updating role:', error)
      alert('Failed to update role')
    }
  }

  const handleDeleteClick = (user) => {
    // Prevent deleting yourself
    if (user.id === currentUser?.id) {
      alert("You cannot delete your own account")
      return
    }
    setDeleteModal({ show: true, user })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteModal.user) return

    setDeleting(true)
    try {
      // Delete user permissions first
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', deleteModal.user.id)

      // Delete the profile (this effectively disables the user)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', deleteModal.user.id)

      if (error) throw error

      // Remove user from local state
      setUsers((prev) => prev.filter((u) => u.id !== deleteModal.user.id))
      setDeleteModal({ show: false, user: null })
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user')
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
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
      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-medium text-zinc-200">
                Delete User
              </h3>
              <button
                onClick={() => setDeleteModal({ show: false, user: null })}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-zinc-400 mb-2">
              Are you sure you want to delete this user?
            </p>
            <p className="text-zinc-200 font-medium mb-4">
              {deleteModal.user?.email}
            </p>
            <p className="text-sm text-zinc-500 mb-6">
              This will remove the user's profile and all their permissions. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModal({ show: false, user: null })}
                disabled={deleting}
                className="px-4 py-2 text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">
            User Management
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage user roles and module permissions
          </p>
        </div>
        <Link
          to="/users/new"
          className="w-full sm:w-auto text-center bg-gradient-to-r from-teal-600 to-teal-500 text-white px-4 py-2 rounded-md hover:from-teal-500 hover:to-teal-400 transition-colors"
        >
          + New User
        </Link>
      </div>

      {users.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
          No users found.
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-zinc-800">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-bold">
                          {user.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-200">
                            {user.email}
                          </p>
                          <p className="text-xs text-zinc-500">
                            ID: {user.id.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={user.id === currentUser?.id}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                          user.role === 'admin'
                            ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        } ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <option value="admin">Admin</option>
                        <option value="employee">Employee</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {user.role !== 'admin' && (
                          <Link
                            to={`/users/${user.id}/permissions`}
                            className="inline-flex items-center gap-1.5 text-teal-400 hover:text-teal-300 text-sm"
                          >
                            <Settings className="w-4 h-4" />
                            Permissions
                          </Link>
                        )}
                        {user.role === 'admin' && (
                          <span className="inline-flex items-center gap-1.5 text-zinc-500 text-sm">
                            <ShieldCheck className="w-4 h-4" />
                            Full Access
                          </span>
                        )}
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDeleteClick(user)}
                            className="inline-flex items-center gap-1.5 text-red-400 hover:text-red-300 text-sm ml-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-bold">
                      {user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">
                        {user.email}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Joined {formatDate(user.created_at)}
                      </p>
                    </div>
                  </div>
                  {user.id !== currentUser?.id && (
                    <button
                      onClick={() => handleDeleteClick(user)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    disabled={user.id === currentUser?.id}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                      user.role === 'admin'
                        ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    } ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <option value="admin">Admin</option>
                    <option value="employee">Employee</option>
                  </select>

                  {user.role !== 'admin' && (
                    <Link
                      to={`/users/${user.id}/permissions`}
                      className="inline-flex items-center gap-1.5 text-teal-400 hover:text-teal-300 text-sm"
                    >
                      <Settings className="w-4 h-4" />
                      Permissions
                    </Link>
                  )}
                  {user.role === 'admin' && (
                    <span className="inline-flex items-center gap-1.5 text-zinc-500 text-sm">
                      <ShieldCheck className="w-4 h-4" />
                      Full Access
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
