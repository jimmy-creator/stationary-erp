import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  Package,
  FolderOpen,
  Truck,
  Users2,
  ShoppingCart,
  ShoppingBag,
  Undo2,
  Receipt,
  Users,
  Eye,
  Edit3,
  Check,
} from 'lucide-react'

const MODULES = [
  { key: 'products', label: 'Products', icon: Package },
  { key: 'categories', label: 'Categories', icon: FolderOpen },
  { key: 'sales', label: 'Sales', icon: ShoppingCart },
  { key: 'sales-returns', label: 'Sales Returns', icon: Undo2 },
  { key: 'customers', label: 'Customers', icon: Users2 },
  { key: 'suppliers', label: 'Suppliers', icon: Truck },
  { key: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingBag },
  { key: 'purchase-returns', label: 'Purchase Returns', icon: Undo2 },
  { key: 'expenses', label: 'Expenses', icon: Receipt },
  { key: 'employees', label: 'Employees', icon: Users },
  { key: 'profits', label: 'Profits', icon: ShoppingBag },
]

export function UserPermissions() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [user, setUser] = useState(null)
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isAdmin) {
      navigate('/unauthorized')
      return
    }
    fetchUserAndPermissions()
  }, [id, isAdmin, navigate])

  const fetchUserAndPermissions = async () => {
    try {
      // Fetch user profile
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()

      if (userError) throw userError
      setUser(userData)

      // Redirect if user is admin (admins have full access)
      if (userData.role === 'admin') {
        navigate('/users')
        return
      }

      // Fetch existing permissions
      const { data: permData, error: permError } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', id)

      if (permError) throw permError

      // Build permissions object
      const permObj = {}
      MODULES.forEach((module) => {
        const existing = permData?.find((p) => p.module_key === module.key)
        permObj[module.key] = {
          canView: existing?.can_view ?? true,
          canEdit: existing?.can_edit ?? true,
        }
      })
      setPermissions(permObj)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (moduleKey, field) => {
    setPermissions((prev) => ({
      ...prev,
      [moduleKey]: {
        ...prev[moduleKey],
        [field]: !prev[moduleKey][field],
        // If disabling view, also disable edit
        ...(field === 'canView' && prev[moduleKey].canView
          ? { canEdit: false }
          : {}),
        // If enabling edit, also enable view
        ...(field === 'canEdit' && !prev[moduleKey].canEdit
          ? { canView: true }
          : {}),
      },
    }))
  }

  const handleSelectAll = (field) => {
    const allEnabled = MODULES.every((m) => permissions[m.key]?.[field])
    setPermissions((prev) => {
      const updated = { ...prev }
      MODULES.forEach((module) => {
        updated[module.key] = {
          ...updated[module.key],
          [field]: !allEnabled,
          // Sync view/edit relationship
          ...(field === 'canView' && allEnabled ? { canEdit: false } : {}),
          ...(field === 'canEdit' && !allEnabled ? { canView: true } : {}),
        }
      })
      return updated
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Delete existing permissions
      await supabase.from('user_permissions').delete().eq('user_id', id)

      // Insert new permissions
      const permissionsToInsert = MODULES.map((module) => ({
        user_id: id,
        module_key: module.key,
        can_view: permissions[module.key]?.canView ?? false,
        can_edit: permissions[module.key]?.canEdit ?? false,
      }))

      const { error } = await supabase
        .from('user_permissions')
        .insert(permissionsToInsert)

      if (error) throw error

      navigate('/users')
    } catch (error) {
      console.error('Error saving permissions:', error)
      alert('Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">User not found.</p>
        <Link to="/users" className="text-teal-600 hover:underline">
          Back to users
        </Link>
      </div>
    )
  }

  const allViewEnabled = MODULES.every((m) => permissions[m.key]?.canView)
  const allEditEnabled = MODULES.every((m) => permissions[m.key]?.canEdit)

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/users"
          className="text-teal-600 hover:underline text-sm mb-2 inline-block"
        >
          &larr; Back to users
        </Link>
        <h1 className="text-xl lg:text-2xl font-bold text-white">
          User Permissions
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">
            {user.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <span className="text-zinc-300">{user.email}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {user.role}
          </span>
        </div>
      </div>

      {/* Permissions Table */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        {/* Header Row */}
        <div className="bg-zinc-800/50 px-4 py-3 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-6 text-xs font-medium text-zinc-500 uppercase">
            Module
          </div>
          <div className="col-span-3 text-center">
            <button
              onClick={() => handleSelectAll('canView')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 uppercase hover:text-zinc-300"
            >
              <Eye className="w-4 h-4" />
              View
              {allViewEnabled && <Check className="w-3 h-3 text-teal-400" />}
            </button>
          </div>
          <div className="col-span-3 text-center">
            <button
              onClick={() => handleSelectAll('canEdit')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 uppercase hover:text-zinc-300"
            >
              <Edit3 className="w-4 h-4" />
              Edit
              {allEditEnabled && <Check className="w-3 h-3 text-teal-400" />}
            </button>
          </div>
        </div>

        {/* Module Rows */}
        <div className="divide-y divide-zinc-800">
          {MODULES.map((module) => {
            const Icon = module.icon
            const perm = permissions[module.key] || { canView: false, canEdit: false }

            return (
              <div
                key={module.key}
                className="px-4 py-3 grid grid-cols-12 gap-4 items-center hover:bg-zinc-800/30"
              >
                <div className="col-span-6 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-zinc-400" />
                  </div>
                  <span className="text-sm text-zinc-200">{module.label}</span>
                </div>
                <div className="col-span-3 flex justify-center">
                  <button
                    onClick={() => handleToggle(module.key, 'canView')}
                    className={`w-10 h-6 rounded-full transition-colors relative ${
                      perm.canView
                        ? 'bg-teal-600'
                        : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        perm.canView ? 'left-5' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                <div className="col-span-3 flex justify-center">
                  <button
                    onClick={() => handleToggle(module.key, 'canEdit')}
                    disabled={!perm.canView}
                    className={`w-10 h-6 rounded-full transition-colors relative ${
                      perm.canEdit
                        ? 'bg-teal-600'
                        : 'bg-zinc-700'
                    } ${!perm.canView ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        perm.canEdit ? 'left-5' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-4 p-4 bg-zinc-800/30 border border-zinc-800 rounded-lg">
        <p className="text-sm text-zinc-400">
          <strong className="text-zinc-300">View:</strong> User can see the module in the sidebar and access it.
        </p>
        <p className="text-sm text-zinc-400 mt-1">
          <strong className="text-zinc-300">Edit:</strong> User can create, update, and delete records in the module.
        </p>
        <p className="text-sm text-zinc-500 mt-2">
          Note: Edit permission requires View permission to be enabled.
        </p>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto bg-gradient-to-r from-teal-600 to-teal-500 text-white px-6 py-2 rounded-xl hover:from-teal-500 hover:to-teal-400 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Permissions'}
        </button>
        <button
          onClick={() => navigate('/users')}
          className="w-full sm:w-auto border border-zinc-700 text-zinc-300 px-6 py-2 rounded-xl hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
