import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ProtectedModule } from './components/ProtectedModule'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Unauthorized } from './pages/Unauthorized'
import { ProductsList } from './pages/products/ProductsList'
import { ProductForm } from './pages/products/ProductForm'
import { ProductView } from './pages/products/ProductView'
import { CategoriesList } from './pages/categories/CategoriesList'
import { CategoryForm } from './pages/categories/CategoryForm'
import { SuppliersList } from './pages/suppliers/SuppliersList'
import { SupplierForm } from './pages/suppliers/SupplierForm'
import { SupplierView } from './pages/suppliers/SupplierView'
import { CustomersList } from './pages/customers/CustomersList'
import { CustomerForm } from './pages/customers/CustomerForm'
import { CustomerView } from './pages/customers/CustomerView'
import { SalesList } from './pages/sales/SalesList'
import { SaleForm } from './pages/sales/SaleForm'
import { SaleView } from './pages/sales/SaleView'
import { PurchaseOrdersList } from './pages/purchase-orders/PurchaseOrdersList'
import { PurchaseOrderForm } from './pages/purchase-orders/PurchaseOrderForm'
import { PurchaseOrderView } from './pages/purchase-orders/PurchaseOrderView'
import { ExpensesList } from './pages/expenses/ExpensesList'
import { ExpenseForm } from './pages/expenses/ExpenseForm'
import { EmployeesList } from './pages/employees/EmployeesList'
import { EmployeeForm } from './pages/employees/EmployeeForm'
import { EmployeeView } from './pages/employees/EmployeeView'
import { DailyCash } from './pages/DailyCash'
import { CashAccounts } from './pages/CashAccounts'
import { ProfitLoss } from './pages/ProfitLoss'
import { StockValue } from './pages/StockValue'
import { Reconciliation } from './pages/Reconciliation'
import { AccountsReceivable } from './pages/accounts-receivable/AccountsReceivable'
import { CollectPayment } from './pages/accounts-receivable/CollectPayment'
import { AccountsPayable } from './pages/accounts-payable/AccountsPayable'
import { MakePayment } from './pages/accounts-payable/MakePayment'
import { StoreSettings } from './pages/StoreSettings'
import { UsersList } from './pages/users/UsersList'
import { UserForm } from './pages/users/UserForm'
import { UserPermissions } from './pages/users/UserPermissions'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Store */}
            <Route path="/products" element={<ProtectedModule moduleKey="products"><ProductsList /></ProtectedModule>} />
            <Route path="/products/new" element={<ProtectedModule moduleKey="products"><ProductForm /></ProtectedModule>} />
            <Route path="/products/:id" element={<ProtectedModule moduleKey="products"><ProductView /></ProtectedModule>} />
            <Route path="/products/:id/edit" element={<ProtectedModule moduleKey="products"><ProductForm /></ProtectedModule>} />
            <Route path="/categories" element={<ProtectedModule moduleKey="categories"><CategoriesList /></ProtectedModule>} />
            <Route path="/categories/new" element={<ProtectedModule moduleKey="categories"><CategoryForm /></ProtectedModule>} />
            <Route path="/categories/:id/edit" element={<ProtectedModule moduleKey="categories"><CategoryForm /></ProtectedModule>} />
            <Route path="/sales" element={<ProtectedModule moduleKey="sales"><SalesList /></ProtectedModule>} />
            <Route path="/sales/new" element={<ProtectedModule moduleKey="sales"><SaleForm /></ProtectedModule>} />
            <Route path="/sales/:id" element={<ProtectedModule moduleKey="sales"><SaleView /></ProtectedModule>} />
            <Route path="/sales/:id/edit" element={<ProtectedModule moduleKey="sales"><SaleForm /></ProtectedModule>} />
            <Route path="/customers" element={<ProtectedModule moduleKey="customers"><CustomersList /></ProtectedModule>} />
            <Route path="/customers/new" element={<ProtectedModule moduleKey="customers"><CustomerForm /></ProtectedModule>} />
            <Route path="/customers/:id" element={<ProtectedModule moduleKey="customers"><CustomerView /></ProtectedModule>} />
            <Route path="/customers/:id/edit" element={<ProtectedModule moduleKey="customers"><CustomerForm /></ProtectedModule>} />

            {/* Procurement */}
            <Route path="/suppliers" element={<ProtectedModule moduleKey="suppliers"><SuppliersList /></ProtectedModule>} />
            <Route path="/suppliers/new" element={<ProtectedModule moduleKey="suppliers"><SupplierForm /></ProtectedModule>} />
            <Route path="/suppliers/:id" element={<ProtectedModule moduleKey="suppliers"><SupplierView /></ProtectedModule>} />
            <Route path="/suppliers/:id/edit" element={<ProtectedModule moduleKey="suppliers"><SupplierForm /></ProtectedModule>} />
            <Route path="/purchase-orders" element={<ProtectedModule moduleKey="purchase-orders"><PurchaseOrdersList /></ProtectedModule>} />
            <Route path="/purchase-orders/new" element={<ProtectedModule moduleKey="purchase-orders"><PurchaseOrderForm /></ProtectedModule>} />
            <Route path="/purchase-orders/:id" element={<ProtectedModule moduleKey="purchase-orders"><PurchaseOrderView /></ProtectedModule>} />
            <Route path="/purchase-orders/:id/edit" element={<ProtectedModule moduleKey="purchase-orders"><PurchaseOrderForm /></ProtectedModule>} />

            {/* Finance */}
            <Route path="/expenses" element={<ProtectedModule moduleKey="expenses"><ExpensesList /></ProtectedModule>} />
            <Route path="/expenses/new" element={<ProtectedModule moduleKey="expenses"><ExpenseForm /></ProtectedModule>} />
            <Route path="/expenses/:id/edit" element={<ProtectedModule moduleKey="expenses"><ExpenseForm /></ProtectedModule>} />
            <Route path="/accounts-receivable" element={<ProtectedModule moduleKey="accounts-receivable"><AccountsReceivable /></ProtectedModule>} />
            <Route path="/accounts-receivable/:id/collect" element={<ProtectedModule moduleKey="accounts-receivable"><CollectPayment /></ProtectedModule>} />
            <Route path="/accounts-payable" element={<ProtectedModule moduleKey="accounts-payable"><AccountsPayable /></ProtectedModule>} />
            <Route path="/accounts-payable/:id/pay" element={<ProtectedModule moduleKey="accounts-payable"><MakePayment /></ProtectedModule>} />
            <Route path="/daily-cash" element={<ProtectedModule moduleKey="daily-cash"><DailyCash /></ProtectedModule>} />
            <Route path="/cash-accounts" element={<ProtectedModule moduleKey="cash-accounts"><CashAccounts /></ProtectedModule>} />

            {/* Reports */}
            <Route path="/profit-loss" element={<ProtectedModule moduleKey="profit-loss"><ProfitLoss /></ProtectedModule>} />
            <Route path="/stock-value" element={<ProtectedModule moduleKey="stock-value"><StockValue /></ProtectedModule>} />
            <Route path="/reconciliation" element={<ProtectedModule moduleKey="reconciliation"><Reconciliation /></ProtectedModule>} />

            {/* People */}
            <Route path="/employees" element={<ProtectedModule moduleKey="employees"><EmployeesList /></ProtectedModule>} />
            <Route path="/employees/new" element={<ProtectedModule moduleKey="employees"><EmployeeForm /></ProtectedModule>} />
            <Route path="/employees/:id" element={<ProtectedModule moduleKey="employees"><EmployeeView /></ProtectedModule>} />
            <Route path="/employees/:id/edit" element={<ProtectedModule moduleKey="employees"><EmployeeForm /></ProtectedModule>} />

            {/* Admin only */}
            <Route path="/store-settings" element={<ProtectedModule adminOnly><StoreSettings /></ProtectedModule>} />
            <Route path="/users" element={<ProtectedModule adminOnly><UsersList /></ProtectedModule>} />
            <Route path="/users/new" element={<ProtectedModule adminOnly><UserForm /></ProtectedModule>} />
            <Route path="/users/:id/permissions" element={<ProtectedModule adminOnly><UserPermissions /></ProtectedModule>} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
