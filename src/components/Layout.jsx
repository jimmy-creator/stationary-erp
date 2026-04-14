import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard,
  Package,
  FolderOpen,
  Truck,
  Users2,
  ShoppingCart,
  ShoppingBag,
  Receipt,
  Users,
  Wallet,
  CreditCard,
  Calculator,
  FileBarChart,
  BarChart3,
  UserCog,
  LogOut,
  Menu,
  X,
} from 'lucide-react'

export function Layout() {
  const { user, userRole, signOut, isAdmin, canView } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navSections = [
    {
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, moduleKey: null },
      ],
    },
    {
      title: 'Store',
      items: [
        { to: '/products', label: 'Products', icon: Package, moduleKey: 'products' },
        { to: '/categories', label: 'Categories', icon: FolderOpen, moduleKey: 'categories' },
        { to: '/sales', label: 'Sales', icon: ShoppingCart, moduleKey: 'sales' },
        { to: '/customers', label: 'Customers', icon: Users2, moduleKey: 'customers' },
      ],
    },
    {
      title: 'Procurement',
      items: [
        { to: '/suppliers', label: 'Suppliers', icon: Truck, moduleKey: 'suppliers' },
        { to: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingBag, moduleKey: 'purchase-orders' },
      ],
    },
    {
      title: 'Finance',
      items: [
        { to: '/expenses', label: 'Expenses', icon: Receipt, moduleKey: 'expenses' },
        { to: '/accounts-receivable', label: 'Receivables', icon: Wallet, moduleKey: 'accounts-receivable' },
        { to: '/accounts-payable', label: 'Payables', icon: CreditCard, moduleKey: 'accounts-payable' },
        { to: '/daily-cash', label: 'Daily Cash', icon: Calculator, moduleKey: 'daily-cash' },
      ],
    },
    {
      title: 'Reports',
      items: [
        { to: '/profit-loss', label: 'P&L Statement', icon: FileBarChart, moduleKey: 'profit-loss' },
        { to: '/stock-value', label: 'Stock Value', icon: BarChart3, moduleKey: 'stock-value' },
      ],
    },
    {
      title: 'People',
      items: [
        { to: '/employees', label: 'Employees', icon: Users, moduleKey: 'employees' },
      ],
    },
  ]

  const adminSection = {
    title: 'Admin',
    items: [
      { to: '/users', label: 'User Management', icon: UserCog, moduleKey: null },
    ],
  }

  // Filter sections based on permissions
  const filteredSections = navSections.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.moduleKey === null) return true
      if (isAdmin) return true
      return canView(item.moduleKey)
    }),
  })).filter((section) => section.items.length > 0)

  if (isAdmin) filteredSections.push(adminSection)

  return (
    <div className="min-h-screen bg-zinc-950">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-zinc-900 border-r border-zinc-800 z-30 transform transition-transform duration-300 lg:translate-x-0 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-zinc-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wider">STATIONERY</h1>
              <p className="text-[10px] text-zinc-500 tracking-widest">ERP SYSTEM</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 flex-1 overflow-y-auto min-h-0">
          <div className="pb-2 space-y-4">
            {filteredSections.map((section, sIdx) => (
              <div key={sIdx}>
                {section.title && (
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                    {section.title}
                  </p>
                )}
                <ul className="space-y-1">
                  {section.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                            isActive
                              ? 'bg-gradient-to-r from-teal-600/20 to-cyan-600/20 text-white border border-teal-500/20 shadow-lg shadow-teal-500/5'
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon
                              className={`w-[18px] h-[18px] ${isActive ? 'text-teal-400' : ''}`}
                              strokeWidth={1.8}
                            />
                            {item.label}
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-zinc-800 shrink-0 bg-zinc-900">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white text-xs font-bold">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-300 truncate">{user?.email}</p>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  isAdmin ? 'text-teal-400' : 'text-emerald-400'
                }`}
              >
                {userRole}
              </span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-red-400 rounded-lg hover:bg-zinc-800/50 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="lg:pl-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50 px-4 lg:px-6 py-3">
          <div className="flex justify-between items-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-zinc-400 hover:text-white transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 hidden sm:inline">{user?.email}</span>
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                  isAdmin
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {userRole}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
