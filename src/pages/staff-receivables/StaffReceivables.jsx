import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { DollarSign, Clock, CheckCircle, Printer } from 'lucide-react'
import { SearchInput } from '../../components/SearchInput'
import { useDebounce } from '../../hooks/useDebounce'
import { useStoreSettings } from '../../hooks/useStoreSettings'

export function StaffReceivables() {
  const { settings: store } = useStoreSettings()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [filter, setFilter] = useState({ status: '' })

  useEffect(() => {
    fetchData()
  }, [debouncedSearch])

  const fetchData = async () => {
    try {
      setLoading(true)
      // Staff Receivables surfaces two kinds of employees:
      //   1. Those with an outstanding opening balance (legacy advances/loans)
      //   2. Those linked to a login account — they may have cash in custody
      //      from receipts they issued. Linked staff appear even with no
      //      opening balance until they remit the cash they collected.
      let query = supabase
        .from('employees')
        .select('id, first_name, last_name, opening_balance, opening_balance_date, auth_user_id')
        .or('opening_balance.gt.0,auth_user_id.not.is.null')
        .order('first_name')

      if (debouncedSearch) {
        query = query.or(`first_name.ilike.%${debouncedSearch}%,last_name.ilike.%${debouncedSearch}%`)
      }

      const { data: employees, error } = await query
      if (error) throw error

      const employeeIds = (employees || []).map((e) => e.id)
      const authUserIds = (employees || []).map((e) => e.auth_user_id).filter(Boolean)

      // Repayments — cash the employee has handed back, against their balance.
      const remittedByEmployee = {}
      if (employeeIds.length) {
        const { data: ps } = await supabase
          .from('employee_payments')
          .select('employee_id, amount')
          .in('employee_id', employeeIds)
        ;(ps || []).forEach((p) => {
          remittedByEmployee[p.employee_id] =
            (remittedByEmployee[p.employee_id] || 0) + parseFloat(p.amount || 0)
        })
      }

      // Cash custody — every cash receipt the linked user issued is money
      // they're holding on behalf of the company.
      const custodyByAuthUser = {}
      if (authUserIds.length) {
        const cashReceipts = await Promise.all([
          supabase.from('sale_payments').select('created_by, amount').eq('payment_method', 'cash').in('created_by', authUserIds),
          supabase.from('customer_payments').select('created_by, amount').eq('payment_method', 'cash').in('created_by', authUserIds),
        ])
        cashReceipts.forEach((res) => {
          ;(res.data || []).forEach((p) => {
            if (!p.created_by) return
            custodyByAuthUser[p.created_by] =
              (custodyByAuthUser[p.created_by] || 0) + parseFloat(p.amount || 0)
          })
        })
      }

      const enriched = (employees || []).map((e) => {
        const opening = parseFloat(e.opening_balance || 0)
        const custody = e.auth_user_id ? (custodyByAuthUser[e.auth_user_id] || 0) : 0
        const remitted = remittedByEmployee[e.id] || 0
        const totalOwed = opening + custody
        const balance = Math.max(0, totalOwed - remitted)
        const referenceDate = e.opening_balance_date || null
        const daysOverdue = referenceDate
          ? Math.floor((new Date() - new Date(referenceDate)) / (1000 * 60 * 60 * 24))
          : 0
        const status = balance <= 0.01 ? 'paid' : remitted > 0 ? 'partial' : 'unpaid'
        return {
          id: e.id,
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || '(no name)',
          opening_date: referenceDate,
          opening_balance: opening,
          custody,
          grand_total: totalOwed,
          total_paid: remitted,
          balance,
          payment_status: status,
          days_overdue: daysOverdue,
          has_login: Boolean(e.auth_user_id),
        }
      })

      setRows(enriched)
    } catch (error) {
      console.error('Error fetching staff receivables:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'
  const formatDatePrint = (date) => date ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'

  const filteredRows = rows.filter((r) => {
    if (!filter.status && r.balance <= 0.01) return false
    if (filter.status === 'unpaid' && r.payment_status !== 'unpaid') return false
    if (filter.status === 'partial' && r.payment_status !== 'partial') return false
    if (filter.status === 'overdue' && (r.days_overdue <= 30 || r.balance <= 0.01)) return false
    if (filter.status === 'settled' && r.balance > 0.01) return false
    return true
  })

  const outstanding = rows.filter((r) => r.balance > 0.01)
  const totalOutstanding = outstanding.reduce((sum, r) => sum + r.balance, 0)
  const totalUnpaid = outstanding.filter((r) => r.payment_status === 'unpaid').reduce((s, r) => s + r.balance, 0)
  const totalPartial = outstanding.filter((r) => r.payment_status === 'partial').reduce((s, r) => s + r.balance, 0)
  const overdueCount = outstanding.filter((r) => r.days_overdue > 30).length

  const filteredOutstanding = filteredRows.reduce((sum, r) => sum + r.balance, 0)

  const getAgingClass = (days) => {
    if (days > 60) return 'bg-red-900/50 text-red-400'
    if (days > 30) return 'bg-orange-900/50 text-orange-400'
    if (days > 14) return 'bg-yellow-900/50 text-yellow-400'
    return 'bg-green-900/50 text-green-400'
  }

  const handlePrint = () => window.print()

  return (
    <div>
      {/* ══ Printable Report ══ */}
      <div className="hidden print:block print-area">
        <div style={{ padding: '28px 32px' }}>
          <h1 style={{ fontSize: '18pt', fontWeight: 700, marginBottom: '2px', color: '#111' }}>{store.store_name}</h1>
          {(store.phone || store.email) && <p style={{ fontSize: '9pt', color: '#666', margin: 0 }}>{store.phone && `Tel: ${store.phone}`}{store.phone && store.email && ' | '}{store.email}</p>}
          <h2 style={{ fontSize: '14pt', fontWeight: 600, marginTop: '12px', marginBottom: '4px', color: '#111' }}>Staff Receivables Report</h2>
          <p style={{ fontSize: '10pt', color: '#666', marginBottom: '20px' }}>
            Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>

          <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', borderBottom: '2px solid #e5e7eb', paddingBottom: '12px' }}>
            <div><p style={{ fontSize: '9pt', color: '#666', textTransform: 'uppercase' }}>Total Outstanding</p><p style={{ fontSize: '16pt', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(filteredOutstanding)}</p></div>
            <div><p style={{ fontSize: '9pt', color: '#666', textTransform: 'uppercase' }}>Staff</p><p style={{ fontSize: '16pt', fontWeight: 700, color: '#111' }}>{filteredRows.length}</p></div>
          </div>

          <h2 style={{ fontSize: '12pt', fontWeight: 600, marginBottom: '8px', color: '#111' }}>Staff Balances</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '10pt' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #d1d5db' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#666', fontWeight: 600, fontSize: '9pt', textTransform: 'uppercase' }}>Employee</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#666', fontWeight: 600, fontSize: '9pt', textTransform: 'uppercase' }}>Opened</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#666', fontWeight: 600, fontSize: '9pt', textTransform: 'uppercase' }}>Owed</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#666', fontWeight: 600, fontSize: '9pt', textTransform: 'uppercase' }}>Remitted</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#666', fontWeight: 600, fontSize: '9pt', textTransform: 'uppercase' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '8px', fontWeight: 500, color: '#111' }}>{r.name}</td>
                  <td style={{ padding: '8px', color: '#666' }}>{formatDatePrint(r.opening_date)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#374151' }}>{formatCurrency(r.grand_total)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#16a34a' }}>{formatCurrency(r.total_paid)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(r.balance)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #111' }}>
                <td style={{ padding: '8px', fontWeight: 700, color: '#111' }}>Total</td>
                <td style={{ padding: '8px' }} />
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#111' }}>{formatCurrency(filteredRows.reduce((s, r) => s + r.grand_total, 0))}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{formatCurrency(filteredRows.reduce((s, r) => s + r.total_paid, 0))}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{formatCurrency(filteredOutstanding)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ Screen UI ══ */}
      <div className="print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-xl lg:text-2xl font-bold text-white">Staff Receivables</h1>
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700 transition-colors">
            <Printer className="w-4 h-4" /> Print Report
          </button>
        </div>

        <div className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by employee name..." />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center"><DollarSign className="w-5 h-5 text-red-400" /></div>
              <div><p className="text-xs text-zinc-500">Total Outstanding</p><p className="text-lg font-bold text-red-400">{formatCurrency(totalOutstanding)}</p></div>
            </div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center"><Clock className="w-5 h-5 text-orange-400" /></div>
              <div><p className="text-xs text-zinc-500">Unpaid</p><p className="text-lg font-bold text-orange-400">{formatCurrency(totalUnpaid)}</p></div>
            </div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-yellow-400" /></div>
              <div><p className="text-xs text-zinc-500">Partial</p><p className="text-lg font-bold text-yellow-400">{formatCurrency(totalPartial)}</p></div>
            </div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center"><Clock className="w-5 h-5 text-red-400" /></div>
              <div><p className="text-xs text-zinc-500">Overdue (30d+)</p><p className="text-lg font-bold text-red-400">{overdueCount}</p></div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
          <label className="block text-sm font-medium text-zinc-300 mb-1">Status</label>
          <select value={filter.status} onChange={(e) => setFilter({ status: e.target.value })} className="w-full sm:w-64 bg-zinc-800/50 border border-zinc-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Outstanding</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="overdue">Overdue (30d+)</option>
            <option value="settled">Settled / Paid</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
        ) : filteredRows.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
            {filter.status === 'settled' ? 'No settled staff balances yet.' : 'No outstanding staff balances.'}
          </div>
        ) : (
          <>
            <div className="hidden md:block bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-zinc-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Opened</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Age</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Owed</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Remitted</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Balance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredRows.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-800/50">
                      <td className="px-6 py-4 text-sm">
                        <Link to={`/employees/${r.id}`} className="text-teal-400 hover:text-teal-300 font-medium">{r.name}</Link>
                        {r.has_login && r.custody > 0 && (
                          <p className="text-xs text-zinc-500 mt-0.5">Custody: {formatCurrency(r.custody)}{r.opening_balance > 0 && ` + Opening: ${formatCurrency(r.opening_balance)}`}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-400">{formatDate(r.opening_date)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          r.payment_status === 'paid' ? 'bg-green-900/50 text-green-400' :
                          r.payment_status === 'unpaid' ? 'bg-red-900/50 text-red-400' :
                          'bg-yellow-900/50 text-yellow-400'
                        }`}>
                          {r.payment_status === 'paid' ? 'Paid' : r.payment_status === 'unpaid' ? 'Unpaid' : 'Partial'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getAgingClass(r.days_overdue)}`}>{r.days_overdue}d</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-200 text-right">{formatCurrency(r.grand_total)}</td>
                      <td className="px-6 py-4 text-sm text-green-400 text-right">{formatCurrency(r.total_paid)}</td>
                      <td className="px-6 py-4 text-sm font-bold text-red-400 text-right">{formatCurrency(r.balance)}</td>
                      <td className="px-6 py-4 text-sm">
                        <Link to={`/staff-receivables/${r.id}/collect`} className="text-teal-400 hover:text-teal-300">
                          {r.balance <= 0.01 ? 'Edit Payments' : 'Collect'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-zinc-800/30">
                  <tr>
                    <td colSpan={4} className="px-6 py-3 text-sm font-medium text-zinc-300">Total ({filteredRows.length})</td>
                    <td className="px-6 py-3 text-sm font-bold text-white text-right">{formatCurrency(filteredRows.reduce((s, r) => s + r.grand_total, 0))}</td>
                    <td className="px-6 py-3 text-sm font-bold text-green-400 text-right">{formatCurrency(filteredRows.reduce((s, r) => s + r.total_paid, 0))}</td>
                    <td className="px-6 py-3 text-sm font-bold text-red-400 text-right">{formatCurrency(filteredOutstanding)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="md:hidden space-y-4">
              {filteredRows.map((r) => (
                <div key={r.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <Link to={`/employees/${r.id}`} className="font-medium text-teal-400">{r.name}</Link>
                      <p className="text-xs text-zinc-500">{formatDate(r.opening_date)}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        r.payment_status === 'paid' ? 'bg-green-900/50 text-green-400' :
                        r.payment_status === 'unpaid' ? 'bg-red-900/50 text-red-400' :
                        'bg-yellow-900/50 text-yellow-400'
                      }`}>
                        {r.payment_status === 'paid' ? 'Paid' : r.payment_status === 'unpaid' ? 'Unpaid' : 'Partial'}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getAgingClass(r.days_overdue)}`}>{r.days_overdue}d</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div><p className="text-xs text-zinc-500">Owed</p><p className="text-sm text-white">{formatCurrency(r.grand_total)}</p></div>
                    <div><p className="text-xs text-zinc-500">Remitted</p><p className="text-sm text-green-400">{formatCurrency(r.total_paid)}</p></div>
                    <div><p className="text-xs text-zinc-500">Balance</p><p className="text-sm font-bold text-red-400">{formatCurrency(r.balance)}</p></div>
                  </div>
                  <Link to={`/staff-receivables/${r.id}/collect`} className="block w-full text-center py-2 bg-teal-600/20 border border-teal-500/30 rounded-lg text-sm text-teal-400 hover:bg-teal-600/30 transition-colors">
                    {r.balance <= 0.01 ? 'Edit Payments' : 'Collect Payment'}
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
