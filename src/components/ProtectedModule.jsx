import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedModule({ moduleKey, adminOnly, children }) {
  const { isAdmin, canView } = useAuth()

  // Admin-only routes (store settings, user management)
  if (adminOnly) {
    if (!isAdmin) return <Navigate to="/unauthorized" replace />
    return children
  }

  // Module-based routes
  if (isAdmin) return children
  if (canView(moduleKey)) return children

  return <Navigate to="/unauthorized" replace />
}
