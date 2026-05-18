import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export function CapitalForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEditing = Boolean(id)

  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    movement_date: new Date().toISOString().split('T')[0],
    direction: 'in',
    amount: '',
    payment_method: 'cash',
    reference: '',
    notes: '',
  })

  useEffect(() => {
    if (!isEditing) return
    ;(async () => {
      const { data, error } = await supabase.from('capital_movements').select('*').eq('id', id).single()
      if (error) return console.error('Error:', error)
      setFormData({
        movement_date: data.movement_date,
        direction: data.direction,
        amount: String(data.amount || ''),
        payment_method: data.payment_method,
        reference: data.reference || '',
        notes: data.notes || '',
      })
    })()
  }, [id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const amount = parseFloat(formData.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Enter a valid amount')
      return
    }
    setSaving(true)
    try {
      const payload = {
        movement_date: formData.movement_date,
        direction: formData.direction,
        amount,
        payment_method: formData.payment_method,
        reference: formData.reference || null,
        notes: formData.notes || null,
      }
      if (isEditing) {
        const { error } = await supabase.from('capital_movements').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('capital_movements').insert({ ...payload, created_by: user?.id || null })
        if (error) throw error
      }
      navigate('/capital')
    } catch (error) {
      console.error('Error saving:', error)
      alert('Failed to save. Make sure migration 034_capital_and_fixed_assets.sql has been run.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link to="/capital" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to list</Link>
        <h1 className="text-xl lg:text-2xl font-bold text-white">{isEditing ? 'Edit Capital Entry' : 'New Capital Entry'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 lg:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Date *</label>
              <input type="date" required value={formData.movement_date} onChange={(e) => setFormData({ ...formData, movement_date: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Direction *</label>
              <select value={formData.direction} onChange={(e) => setFormData({ ...formData, direction: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50">
                <option value="in">Capital Injection (cash in)</option>
                <option value="out">Owner Withdrawal (cash out)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Amount (QAR) *</label>
              <input type="number" required min="0.01" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Method</label>
              <select value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Reference #</label>
              <input type="text" value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1">Notes</label>
              <input type="text" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <Link to="/capital" className="w-full sm:w-auto text-center px-6 py-2 border border-zinc-700 rounded-xl text-zinc-300 hover:bg-zinc-800">Cancel</Link>
          <button type="submit" disabled={saving} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl hover:from-teal-500 hover:to-teal-400 disabled:opacity-50">
            {saving ? 'Saving...' : isEditing ? 'Update' : 'Record'}
          </button>
        </div>
      </form>
    </div>
  )
}
