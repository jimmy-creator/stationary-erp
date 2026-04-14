import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
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
import { ProfitLoss } from './pages/ProfitLoss'
import { StockValue } from './pages/StockValue'
import { AccountsReceivable } from './pages/accounts-receivable/AccountsReceivable'
import { CollectPayment } from './pages/accounts-receivable/CollectPayment'
import { AccountsPayable } from './pages/accounts-payable/AccountsPayable'
import { MakePayment } from './pages/accounts-payable/MakePayment'
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
            <Route path="/products" element={<ProductsList />} />
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/:id" element={<ProductView />} />
            <Route path="/products/:id/edit" element={<ProductForm />} />
            <Route path="/categories" element={<CategoriesList />} />
            <Route path="/categories/new" element={<CategoryForm />} />
            <Route path="/categories/:id/edit" element={<CategoryForm />} />
            <Route path="/suppliers" element={<SuppliersList />} />
            <Route path="/suppliers/new" element={<SupplierForm />} />
            <Route path="/suppliers/:id" element={<SupplierView />} />
            <Route path="/suppliers/:id/edit" element={<SupplierForm />} />
            <Route path="/customers" element={<CustomersList />} />
            <Route path="/customers/new" element={<CustomerForm />} />
            <Route path="/customers/:id" element={<CustomerView />} />
            <Route path="/customers/:id/edit" element={<CustomerForm />} />
            <Route path="/sales" element={<SalesList />} />
            <Route path="/sales/new" element={<SaleForm />} />
            <Route path="/sales/:id" element={<SaleView />} />
            <Route path="/sales/:id/edit" element={<SaleForm />} />
            <Route path="/purchase-orders" element={<PurchaseOrdersList />} />
            <Route path="/purchase-orders/new" element={<PurchaseOrderForm />} />
            <Route path="/purchase-orders/:id" element={<PurchaseOrderView />} />
            <Route path="/purchase-orders/:id/edit" element={<PurchaseOrderForm />} />
            <Route path="/expenses" element={<ExpensesList />} />
            <Route path="/expenses/new" element={<ExpenseForm />} />
            <Route path="/expenses/:id/edit" element={<ExpenseForm />} />
            <Route path="/employees" element={<EmployeesList />} />
            <Route path="/employees/new" element={<EmployeeForm />} />
            <Route path="/employees/:id" element={<EmployeeView />} />
            <Route path="/employees/:id/edit" element={<EmployeeForm />} />
            <Route path="/daily-cash" element={<DailyCash />} />
            <Route path="/profit-loss" element={<ProfitLoss />} />
            <Route path="/stock-value" element={<StockValue />} />
            <Route path="/accounts-receivable" element={<AccountsReceivable />} />
            <Route path="/accounts-receivable/:id/collect" element={<CollectPayment />} />
            <Route path="/accounts-payable" element={<AccountsPayable />} />
            <Route path="/accounts-payable/:id/pay" element={<MakePayment />} />
            <Route path="/users" element={<UsersList />} />
            <Route path="/users/new" element={<UserForm />} />
            <Route path="/users/:id/permissions" element={<UserPermissions />} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
