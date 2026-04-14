import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchUserRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (error) throw error
      return data?.role || 'employee'
    } catch (error) {
      console.error('Error fetching user role:', error)
      return 'employee'
    }
  }

  const fetchUserPermissions = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('module_key, can_view, can_edit')
        .eq('user_id', userId)

      if (error) throw error

      // Convert array to object for easier access
      const permissionsMap = {}
      data?.forEach((perm) => {
        permissionsMap[perm.module_key] = {
          canView: perm.can_view,
          canEdit: perm.can_edit,
        }
      })
      return permissionsMap
    } catch (error) {
      console.error('Error fetching user permissions:', error)
      return {}
    }
  }

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, session?.user?.email)

        if (session?.user) {
          setUser(session.user)
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(async () => {
            const role = await fetchUserRole(session.user.id)
            setUserRole(role)

            // Admins have all permissions, only fetch for non-admins
            if (role !== 'admin') {
              const perms = await fetchUserPermissions(session.user.id)
              setPermissions(perms)
            } else {
              setPermissions({}) // Admins bypass permission checks
            }

            setLoading(false)
          }, 0)
        } else {
          setUser(null)
          setUserRole(null)
          setPermissions({})
          setLoading(false)
        }
      }
    )

    // Then get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchUserRole(session.user.id).then(async (role) => {
          setUserRole(role)

          if (role !== 'admin') {
            const perms = await fetchUserPermissions(session.user.id)
            setPermissions(perms)
          }

          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  // Check if user can view a module
  const canView = (moduleKey) => {
    if (userRole === 'admin') return true
    return permissions[moduleKey]?.canView ?? false
  }

  // Check if user can edit a module
  const canEdit = (moduleKey) => {
    if (userRole === 'admin') return true
    return permissions[moduleKey]?.canEdit ?? false
  }

  // Refresh permissions (useful after admin updates)
  const refreshPermissions = async () => {
    if (user && userRole !== 'admin') {
      const perms = await fetchUserPermissions(user.id)
      setPermissions(perms)
    }
  }

  const value = {
    user,
    userRole,
    permissions,
    loading,
    signIn,
    signOut,
    isAdmin: userRole === 'admin',
    isEmployee: userRole === 'employee',
    canView,
    canEdit,
    refreshPermissions,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
