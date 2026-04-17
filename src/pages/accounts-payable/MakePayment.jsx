import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Trash2 } from 'lucide-react'

export function MakePayment() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [order, setOrder] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [newPayment, setNewPayment] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_method: 'bank_transfer',
    reference: '',
    notes: '',
  })

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      const [orderRes, paymentsRes] = await Promise.all([
        supabase.from('purchase_orders').select('*').eq('id', id).single(),
        supabase.from('po_payments').select('*').eq('po_id', id).order('payment_date', { ascending: false }),
      ])

      if (orderRes.error) throw orderRes.error
      setOrder(orderRes.data)
      setPayments(paymentsRes.data || [])
    } catch (error) {
      console.error('Error:', error)
      try {
        const { data } = await supabase.from('purchase_orders').select('*').eq('id', id).single()
        setOrder(data)
        setPayments([])
      } catch (err) {
        console.error('Error:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => `QAR ${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  // amount_paid on the purchase_orders row is kept as the running total (initial + all AP payments)
  const totalPaid = parseFloat(order?.amount_paid || 0)
  const balance = parseFloat(order?.grand_total || 0) - totalPaid
  const poPaymentsTotal = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
  const initialPayment = Math.max(0, totalPaid - poPaymentsTotal)

  const handlePay = async () => {
    if (!newPayment.amount || parseFloat(newPayment.amount) <= 0) {
      alert('Please enter a valid amount')
      return
    }
    if (parseFloat(newPayment.amount) > balance) {
      alert(`Amount cannot exceed balance of ${formatCurrency(balance)}`)
      return
    }

    setSaving(true)
    try {
      const { data: paymentData, error: paymentError } = await supabase
        .from('po_payments')
        .insert({
          po_id: id,
          payment_date: newPayment.payment_date,
          amount: parseFloat(newPayment.amount),
          payment_method: newPayment.payment_method,
          reference: newPayment.reference || null,
          notes: newPayment.notes || null,
        })
        .select()
        .single()

      if (paymentError) throw paymentError

      const newTotalPaid = totalPaid + parseFloat(newPayment.amount)
      const newBalance = parseFloat(order.grand_total) - newTotalPaid
      const newStatus = newBalance <= 0.01 ? 'paid' : 'partial'

      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({ payment_status: newStatus, amount_paid: newTotalPaid })
        .eq('id', id)

      if (poError) throw poError

      if (newStatus === 'paid') {
        navigate('/accounts-payable')
        return
      }

      setPayments([paymentData, ...payments])
      setOrder({ ...order, payment_status: newStatus, amount_paid: newTotalPaid })
      setNewPayment({
        payment_date: new Date().toISOString().split('T')[0],
        amount: '',
        payment_method: 'bank_transfer',
        reference: '',
        notes: '',
      })
    } catch (error) {
      console.error('Error making payment:', error)
      alert('Failed to record payment. Make sure the po_payments table exists (run the migration).')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePayment = async (paymentId) => {
    if (!confirm('Delete this payment record?')) return
    try {
      const { error } = await supabase.from('po_payments').delete().eq('id', paymentId)
      if (error) throw error

      const deletedAmount = parseFloat(payments.find(p => p.id === paymentId)?.amount || 0)
      const updatedPayments = payments.filter((p) => p.id !== paymentId)
      setPayments(updatedPayments)

      const newTotalPaid = Math.max(0, parseFloat(order.amount_paid) - deletedAmount)
      const newBalance = parseFloat(order.grand_total) - newTotalPaid
      const newStatus = newBalance <= 0.01 ? 'paid' : newTotalPaid > 0 ? 'partial' : 'unpaid'

      await supabase.from('purchase_orders').update({ payment_status: newStatus, amount_paid: newTotalPaid }).eq('id', id)
      setOrder({ ...order, payment_status: newStatus, amount_paid: newTotalPaid })
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to delete payment')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }

  if (!order) {
    return <div className="text-center py-8"><p className="text-zinc-500">Order not found.</p><Link to="/accounts-payable" className="text-teal-600 hover:underline">Back</Link></div>
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link to="/accounts-payable" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to Payables</Link>
        <h1 className="text-xl lg:text-2xl font-bold text-white">Make Payment</h1>
        <p className="text-zinc-500">{order.po_number} - {order.supplier_name}</p>
      </div>

      {/* Order Summary */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-zinc-500">PO Total</p>
            <p className="text-lg font-bold text-white">{formatCurrency(order.grand_total)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Initial Payment</p>
            <p className="text-lg font-bold text-zinc-300">{formatCurrency(initialPayment)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Total Paid</p>
            <p className="text-lg font-bold text-green-400">{formatCurrency(totalPaid)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Balance Due</p>
            <p className={`text-lg font-bold ${balance > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {formatCurrency(balance)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>Payment Progress</span>
            <span>{order.grand_total > 0 ? ((totalPaid / parseFloat(order.grand_total)) * 100).toFixed(0) : 0}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-teal-600 to-teal-400 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(100, order.grand_total > 0 ? (totalPaid / parseFloat(order.grand_total)) * 100 : 0)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Payment Form */}
      {balance > 0.01 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-medium text-white mb-4">Record Payment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Date *</label>
              <input type="date" value={newPayment.payment_date} onChange={(e) => setNewPayment({ ...newPayment, payment_date: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Amount (QAR) *</label>
              <input type="number" min="0.01" step="0.01" max={balance} value={newPayment.amount} onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })} placeholder={balance.toFixed(2)} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Method</label>
              <select value={newPayment.payment_method} onChange={(e) => setNewPayment({ ...newPayment, payment_method: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50">
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Reference #</label>
              <input type="text" value={newPayment.reference} onChange={(e) => setNewPayment({ ...newPayment, reference: e.target.value })} placeholder="Transfer/Cheque #" className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1">Notes</label>
              <input type="text" value={newPayment.notes} onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
            </div>
          </div>
          <div className="flex justify-between items-center mt-4">
            <button onClick={() => setNewPayment({ ...newPayment, amount: balance.toFixed(2) })} className="text-sm text-teal-400 hover:text-teal-300">
              Pay full balance ({formatCurrency(balance)})
            </button>
            <button onClick={handlePay} disabled={saving} className="px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl hover:from-teal-500 hover:to-teal-400 disabled:opacity-50">
              {saving ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </div>
      )}

      {balance <= 0.01 && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-5 mb-6 text-center">
          <svg className="w-8 h-8 text-green-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
          <p className="text-green-400 font-medium">Fully Paid</p>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-lg font-medium text-white mb-4">Payment History</h2>

        {initialPayment > 0 && (
          <div className="flex items-center justify-between bg-zinc-800/30 rounded-lg p-3 mb-2">
            <div>
              <span className="text-sm text-zinc-400">{formatDate(order.po_date)}</span>
              <span className="ml-3 text-sm text-zinc-300">Initial payment</span>
            </div>
            <span className="font-medium text-green-400">{formatCurrency(initialPayment)}</span>
          </div>
        )}

        {payments.length === 0 && initialPayment <= 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">No payments recorded yet</p>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between bg-zinc-800/30 rounded-lg p-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-zinc-400">{formatDate(payment.payment_date)}</span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400">
                      {payment.payment_method === 'bank_transfer' ? 'Bank Transfer' : payment.payment_method === 'cash' ? 'Cash' : 'Cheque'}
                    </span>
                    {payment.reference && <span className="text-xs text-zinc-500">Ref: {payment.reference}</span>}
                  </div>
                  {payment.notes && <p className="text-xs text-zinc-500 mt-1">{payment.notes}</p>}
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className="font-medium text-green-400">{formatCurrency(payment.amount)}</span>
                  <button onClick={() => handleDeletePayment(payment.id)} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
