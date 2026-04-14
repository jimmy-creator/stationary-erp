import { useAuth } from '../contexts/AuthContext'

/**
 * Component that conditionally renders children based on module permissions
 *
 * @param {string} module - The module key to check permissions for
 * @param {string} action - Either 'view' or 'edit'
 * @param {React.ReactNode} children - Content to render if permission granted
 * @param {React.ReactNode} fallback - Optional content to render if permission denied
 */
export function PermissionGate({ module, action = 'view', children, fallback = null }) {
  const { isAdmin, canView, canEdit } = useAuth()

  // Admins always have access
  if (isAdmin) {
    return children
  }

  // Check permission based on action type
  const hasPermission = action === 'edit' ? canEdit(module) : canView(module)

  if (hasPermission) {
    return children
  }

  return fallback
}

/**
 * Hook to check if current user has permission for a module/action
 *
 * @param {string} module - The module key to check
 * @returns {{ canView: boolean, canEdit: boolean }}
 */
// eslint-disable-next-line react-refresh/only-export-components
export function usePermission(module) {
  const { isAdmin, canView, canEdit } = useAuth()

  if (isAdmin) {
    return { canView: true, canEdit: true }
  }

  return {
    canView: canView(module),
    canEdit: canEdit(module),
  }
}
