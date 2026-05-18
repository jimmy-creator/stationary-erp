import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ArrowUpRight, ArrowDownRight, Trash2, Pencil } from 'lucide-react'

const METHOD_LABELS = { cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque' }

export function CapitalList() {
  const { isEmployee } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('capital_movements')
        .select('*')
        .order('movement_date', { ascending: false })
      if (error) throw error
      setRows(data || [])
    } catch (error) {
      console.error('Error fetching capital movements:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this capital entry?')) return
    try {
      const { error } = await supabase.from('capital_movements').delete().eq('id', id)
      if (error) throw error
      setRows(rows.filter((r) => r.id !== id))
    } catch (error) {
      console.error('Error deleting:', error)
      alert('Failed to delete')
    }
  }

  const fmt = (n) => `QAR ${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const totalIn = rows.filter((r) => r.direction === 'in').reduce((s, r) => s + parseFloat(r.amount || 0), 0)
  const totalOut = rows.filter((r) => r.direction === 'out').reduce((s, r) => s + parseFloat(r.amount || 0), 0)
  const net = totalIn - totalOut

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Capital Movements</h1>
        <Link to="/capital/new" className="w-full sm:w-auto text-center bg-gradient-to-r from-teal-600 to-teal-500 text-white px-4 py-2 rounded-md hover:from-teal-500 hover:to-teal-400">
          + New Entry
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center"><ArrowUpRight className="w-5 h-5 text-green-400" /></div>
            <div><p className="text-xs text-zinc-500">Total In</p><p className="text-lg font-bold text-green-400">{fmt(totalIn)}</p></div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center"><ArrowDownRight className="w-5 h-5 text-red-400" /></div>
            <div><p className="text-xs text-zinc-500">Total Out</p><p className="text-lg font-bold text-red-400">{fmt(totalOut)}</p></div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${net >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}><ArrowUpRight className={`w-5 h-5 ${net >= 0 ? 'text-green-400' : 'text-red-400'}`} /></div>
            <div><p className="text-xs text-zinc-500">Net Capital</p><p className={`text-lg font-bold ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(net)}</p></div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
      ) : rows.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">No capital entries yet.</div>
      ) : (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-zinc-800">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Direction</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Reference</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Notes</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-800/50">
                  <td className="px-6 py-4 text-sm text-zinc-300">{fmtDate(r.movement_date)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${r.direction === 'in' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                      {r.direction === 'in' ? 'Injection' : 'Withdrawal'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{METHOD_LABELS[r.payment_method] || r.payment_method}</td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{r.reference || '-'}</td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{r.notes || '-'}</td>
                  <td className={`px-6 py-4 text-sm font-bold text-right ${r.direction === 'in' ? 'text-green-400' : 'text-red-400'}`}>
                    {r.direction === 'in' ? '+' : '-'}{fmt(r.amount)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      {!isEmployee && <Link to={`/capital/${r.id}/edit`} className="text-zinc-400 hover:text-teal-400" title="Edit"><Pencil className="w-4 h-4" /></Link>}
                      {!isEmployee && <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-300" title="Delete"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
