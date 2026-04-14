import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
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
} from 'lucide-react'

export function Dashboard() {
  const { isAdmin, canView } = useAuth()

  const allModules = [
    {
      title: 'Products',
      description: 'Manage product inventory & stock',
      to: '/products',
      icon: Package,
      gradient: 'from-teal-600 to-teal-400',
      glow: 'shadow-teal-500/20',
      bg: 'bg-teal-500/5 border-teal-500/10 hover:border-teal-500/30',
      moduleKey: 'products',
    },
    {
      title: 'Categories',
      description: 'Organize products by category',
      to: '/categories',
      icon: FolderOpen,
      gradient: 'from-purple-600 to-purple-400',
      glow: 'shadow-purple-500/20',
      bg: 'bg-purple-500/5 border-purple-500/10 hover:border-purple-500/30',
      moduleKey: 'categories',
    },
    {
      title: 'Sales',
      description: 'Create invoices & track sales',
      to: '/sales',
      icon: ShoppingCart,
      gradient: 'from-emerald-600 to-emerald-400',
      glow: 'shadow-emerald-500/20',
      bg: 'bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30',
      moduleKey: 'sales',
    },
    {
      title: 'Customers',
      description: 'Manage retail & wholesale customers',
      to: '/customers',
      icon: Users2,
      gradient: 'from-blue-600 to-blue-400',
      glow: 'shadow-blue-500/20',
      bg: 'bg-blue-500/5 border-blue-500/10 hover:border-blue-500/30',
      moduleKey: 'customers',
    },
    {
      title: 'Suppliers',
      description: 'Manage stationery suppliers',
      to: '/suppliers',
      icon: Truck,
      gradient: 'from-orange-600 to-orange-400',
      glow: 'shadow-orange-500/20',
      bg: 'bg-orange-500/5 border-orange-500/10 hover:border-orange-500/30',
      moduleKey: 'suppliers',
    },
    {
      title: 'Purchase Orders',
      description: 'Order stock from suppliers',
      to: '/purchase-orders',
      icon: ShoppingBag,
      gradient: 'from-violet-600 to-violet-400',
      glow: 'shadow-violet-500/20',
      bg: 'bg-violet-500/5 border-violet-500/10 hover:border-violet-500/30',
      moduleKey: 'purchase-orders',
    },
    {
      title: 'Expenses',
      description: 'Track business expenses',
      to: '/expenses',
      icon: Receipt,
      gradient: 'from-rose-600 to-rose-400',
      glow: 'shadow-rose-500/20',
      bg: 'bg-rose-500/5 border-rose-500/10 hover:border-rose-500/30',
      moduleKey: 'expenses',
    },
    {
      title: 'Employees',
      description: 'Manage store staff',
      to: '/employees',
      icon: Users,
      gradient: 'from-indigo-600 to-indigo-400',
      glow: 'shadow-indigo-500/20',
      bg: 'bg-indigo-500/5 border-indigo-500/10 hover:border-indigo-500/30',
      moduleKey: 'employees',
    },
    {
      title: 'Receivables',
      description: 'Track unpaid invoices & collect',
      to: '/accounts-receivable',
      icon: Wallet,
      gradient: 'from-amber-600 to-amber-400',
      glow: 'shadow-amber-500/20',
      bg: 'bg-amber-500/5 border-amber-500/10 hover:border-amber-500/30',
      moduleKey: 'accounts-receivable',
    },
    {
      title: 'Payables',
      description: 'Track supplier payments',
      to: '/accounts-payable',
      icon: CreditCard,
      gradient: 'from-red-600 to-red-400',
      glow: 'shadow-red-500/20',
      bg: 'bg-red-500/5 border-red-500/10 hover:border-red-500/30',
      moduleKey: 'accounts-payable',
    },
    {
      title: 'Daily Cash',
      description: 'Daily cash & bank summary',
      to: '/daily-cash',
      icon: Calculator,
      gradient: 'from-cyan-600 to-cyan-400',
      glow: 'shadow-cyan-500/20',
      bg: 'bg-cyan-500/5 border-cyan-500/10 hover:border-cyan-500/30',
      moduleKey: 'daily-cash',
    },
    {
      title: 'P&L Statement',
      description: 'Revenue, costs & net profit',
      to: '/profit-loss',
      icon: FileBarChart,
      gradient: 'from-pink-600 to-pink-400',
      glow: 'shadow-pink-500/20',
      bg: 'bg-pink-500/5 border-pink-500/10 hover:border-pink-500/30',
      moduleKey: 'profit-loss',
    },
    {
      title: 'Stock Value',
      description: 'Inventory valuation report',
      to: '/stock-value',
      icon: BarChart3,
      gradient: 'from-sky-600 to-sky-400',
      glow: 'shadow-sky-500/20',
      bg: 'bg-sky-500/5 border-sky-500/10 hover:border-sky-500/30',
      moduleKey: 'stock-value',
    },
  ]

  const adminModules = [
    {
      title: 'User Management',
      description: 'Manage users & permissions',
      to: '/users',
      icon: UserCog,
      gradient: 'from-red-600 to-red-400',
      glow: 'shadow-red-500/20',
      bg: 'bg-red-500/5 border-red-500/10 hover:border-red-500/30',
      moduleKey: null,
    },
  ]

  const visibleModules = allModules.filter((module) => {
    if (isAdmin) return true
    return canView(module.moduleKey)
  })

  const modules = isAdmin ? [...visibleModules, ...adminModules] : visibleModules

  return (
    <div>
      <h1 className="text-xl lg:text-2xl font-bold text-white mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {modules.map((module) => (
          <Link
            key={module.to}
            to={module.to}
            className={`group block p-5 lg:p-6 rounded-2xl border transition-all duration-300 hover:shadow-xl ${module.bg} hover:${module.glow}`}
          >
            <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br ${module.gradient} flex items-center justify-center mb-4 shadow-lg ${module.glow} group-hover:scale-110 transition-transform duration-300`}>
              <module.icon className="w-5 h-5 lg:w-6 lg:h-6 text-white" strokeWidth={1.8} />
            </div>
            <h3 className="font-semibold text-white text-sm lg:text-base">
              {module.title}
            </h3>
            <p className="text-xs text-zinc-500 mt-1 hidden sm:block">
              {module.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
