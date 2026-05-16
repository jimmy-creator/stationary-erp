import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Trash2, Printer } from 'lucide-react'

export function CollectPayment() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isEmployee } = useAuth()

  const [sale, setSale] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [newPayment, setNewPayment] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    discount: '',
    payment_method: 'cash',
    reference: '',
    notes: '',
  })

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      const [saleRes, paymentsRes] = await Promise.all([
        supabase.from('sales').select('*').eq('id', id).single(),
        supabase.from('sale_payments').select('*').eq('sale_id', id).order('payment_date', { ascending: false }),
      ])

      if (saleRes.error) throw saleRes.error
      setSale(saleRes.data)
      setPayments(paymentsRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      // If sale_payments doesn't exist, just load the sale
      try {
        const { data } = await supabase.from('sales').select('*').eq('id', id).single()
        setSale(data)
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

  // amount_paid on the sales row is kept as the running total (initial + all AR collections)
  const totalCollected = parseFloat(sale?.amount_paid || 0)
  const balance = parseFloat(sale?.grand_total || 0) - totalCollected
  // Initial payment = running total minus everything recorded in sale_payments
  const salePaymentsTotal = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
  const initialPayment = Math.max(0, totalCollected - salePaymentsTotal)

  const handleCollect = async () => {
    const amount = parseFloat(newPayment.amount) || 0
    const discount = parseFloat(newPayment.discount) || 0

    if (amount <= 0 && discount <= 0) {
      alert('Please enter a payment amount or a discount')
      return
    }
    if (amount + discount > balance + 0.01) {
      alert(`Payment + discount cannot exceed balance of ${formatCurrency(balance)}`)
      return
    }

    setSaving(true)
    try {
      const inserted = []

      if (discount > 0) {
        const { data, error } = await supabase
          .from('sale_payments')
          .insert({
            sale_id: id,
            payment_date: newPayment.payment_date,
            amount: discount,
            payment_method: 'discount',
            reference: null,
            notes: newPayment.notes ? `Settlement discount — ${newPayment.notes}` : 'Settlement discount',
          })
          .select()
          .single()
        if (error) throw error
        inserted.push(data)
      }

      if (amount > 0) {
        const { data, error } = await supabase
          .from('sale_payments')
          .insert({
            sale_id: id,
            payment_date: newPayment.payment_date,
            amount,
            payment_method: newPayment.payment_method,
            reference: newPayment.reference || null,
            notes: newPayment.notes || null,
          })
          .select()
          .single()
        if (error) throw error
        inserted.push(data)
      }

      const newTotalPaid = totalCollected + amount + discount
      const newBalance = parseFloat(sale.grand_total) - newTotalPaid
      const newStatus = newBalance <= 0.01 ? 'paid' : 'partial'

      const { error: saleError } = await supabase
        .from('sales')
        .update({ payment_status: newStatus, amount_paid: newTotalPaid })
        .eq('id', id)
      if (saleError) throw saleError

      if (newStatus === 'paid') {
        navigate('/accounts-receivable')
        return
      }

      setPayments([...inserted.reverse(), ...payments])
      setSale({ ...sale, payment_status: newStatus, amount_paid: newTotalPaid })
      setNewPayment({
        payment_date: new Date().toISOString().split('T')[0],
        amount: '',
        discount: '',
        payment_method: 'cash',
        reference: '',
        notes: '',
      })
    } catch (error) {
      console.error('Error collecting payment:', error)
      alert('Failed to record payment. Make sure the sale_payments table exists (run the migration).')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePayment = async (paymentId, paymentAmount) => {
    if (!confirm('Delete this payment record?')) return

    try {
      const { error } = await supabase.from('sale_payments').delete().eq('id', paymentId)
      if (error) throw error

      const updatedPayments = payments.filter((p) => p.id !== paymentId)
      setPayments(updatedPayments)

      // Deduct deleted payment from the running total
      const newTotalPaid = Math.max(0, parseFloat(sale.amount_paid) - parseFloat(paymentAmount))
      const newBalance = parseFloat(sale.grand_total) - newTotalPaid
      const newStatus = newBalance <= 0.01 ? 'paid' : newTotalPaid > 0 ? 'partial' : 'unpaid'

      await supabase.from('sales').update({ payment_status: newStatus, amount_paid: newTotalPaid }).eq('id', id)
      setSale({ ...sale, payment_status: newStatus, amount_paid: newTotalPaid })
    } catch (error) {
      console.error('Error deleting payment:', error)
      alert('Failed to delete payment')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div></div>
  }

  if (!sale) {
    return <div className="text-center py-8"><p className="text-zinc-500">Sale not found.</p><Link to="/accounts-receivable" className="text-teal-600 hover:underline">Back</Link></div>
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link to="/accounts-receivable" className="text-teal-600 hover:underline text-sm mb-2 inline-block">&larr; Back to Receivables</Link>
        <h1 className="text-xl lg:text-2xl font-bold text-white">Collect Payment</h1>
        <p className="text-zinc-500">{sale.invoice_number} - {sale.customer_name || 'Walk-in'}</p>
      </div>

      {/* Invoice Summary */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-zinc-500">Invoice Total</p>
            <p className="text-lg font-bold text-white">{formatCurrency(sale.grand_total)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Initial Payment</p>
            <p className="text-lg font-bold text-zinc-300">{formatCurrency(initialPayment)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Total Collected</p>
            <p className="text-lg font-bold text-green-400">{formatCurrency(totalCollected)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Balance Due</p>
            <p className={`text-lg font-bold ${balance > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {formatCurrency(balance)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>Payment Progress</span>
            <span>{sale.grand_total > 0 ? ((totalCollected / parseFloat(sale.grand_total)) * 100).toFixed(0) : 0}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-teal-600 to-teal-400 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(100, sale.grand_total > 0 ? (totalCollected / parseFloat(sale.grand_total)) * 100 : 0)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Collect Payment Form */}
      {balance > 0.01 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 mb-6">
          <h2 className="text-lg font-medium text-white mb-4">Record Payment</h2>
          {(() => {
            const enteredAmount = parseFloat(newPayment.amount) || 0
            const enteredDiscount = parseFloat(newPayment.discount) || 0
            const remainingAfter = Math.max(0, balance - enteredAmount - enteredDiscount)
            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Date *</label>
                    <input type="date" value={newPayment.payment_date} onChange={(e) => setNewPayment({ ...newPayment, payment_date: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Amount (QAR)</label>
                    <input type="number" min="0" step="0.01" max={balance} value={newPayment.amount} onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })} placeholder={balance.toFixed(2)} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Method</label>
                    <select value={newPayment.payment_method} onChange={(e) => setNewPayment({ ...newPayment, payment_method: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50">
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Discount / Write-off (QAR)</label>
                    <input type="number" min="0" step="0.01" max={balance} value={newPayment.discount} onChange={(e) => setNewPayment({ ...newPayment, discount: e.target.value })} placeholder="0.00" className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
                    {enteredDiscount > 0 && (
                      <p className="text-xs text-amber-400 mt-1">Reduces balance without cash collected.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Reference #</label>
                    <input type="text" value={newPayment.reference} onChange={(e) => setNewPayment({ ...newPayment, reference: e.target.value })} placeholder="Receipt/Transfer #" className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Notes</label>
                    <input type="text" value={newPayment.notes} onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })} className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50" />
                  </div>
                </div>

                {(enteredAmount > 0 || enteredDiscount > 0) && (
                  <div className="mt-4 p-3 bg-zinc-800/40 rounded-lg flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {enteredAmount > 0 && <span className="text-zinc-300">Payment: <span className="text-green-400 font-medium">{formatCurrency(enteredAmount)}</span></span>}
                      {enteredDiscount > 0 && <span className="text-zinc-300">Discount: <span className="text-amber-400 font-medium">{formatCurrency(enteredDiscount)}</span></span>}
                    </div>
                    <span className="text-zinc-300">Remaining after: <span className={`font-medium ${remainingAfter <= 0.01 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(remainingAfter)}</span></span>
                  </div>
                )}

                <div className="flex flex-wrap justify-between items-center gap-2 mt-4">
                  <div className="flex flex-wrap gap-3 text-sm">
                    <button
                      onClick={() => setNewPayment({ ...newPayment, amount: balance.toFixed(2), discount: '' })}
                      className="text-teal-400 hover:text-teal-300"
                    >
                      Pay full ({formatCurrency(balance)})
                    </button>
                    <button
                      onClick={() => setNewPayment({ ...newPayment, amount: '', discount: balance.toFixed(2) })}
                      className="text-amber-400 hover:text-amber-300"
                    >
                      Write off full
                    </button>
                  </div>
                  <button
                    onClick={handleCollect}
                    disabled={saving}
                    className="px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl hover:from-teal-500 hover:to-teal-400 disabled:opacity-50"
                  >
                    {saving ? 'Recording...' : 'Record'}
                  </button>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {balance <= 0.01 && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-5 mb-6 text-center">
          <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-green-400 font-medium">Fully Paid</p>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-lg font-medium text-white mb-4">Payment History</h2>

        {initialPayment > 0 && (
          <div className="flex items-center justify-between bg-zinc-800/30 rounded-lg p-3 mb-2">
            <div>
              <span className="text-sm text-zinc-400">{formatDate(sale.sale_date)}</span>
              <span className="ml-3 text-sm text-zinc-300">Initial payment at sale</span>
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400">{sale.payment_method}</span>
            </div>
            <span className="font-medium text-green-400">{formatCurrency(initialPayment)}</span>
          </div>
        )}

        {payments.length === 0 && initialPayment <= 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">No payments recorded yet</p>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => {
              const methodLabels = {
                cash: 'Cash', card: 'Card', bank_transfer: 'Bank Transfer',
                credit_note: 'Credit Note', discount: 'Discount',
              }
              const isNonCash = payment.payment_method === 'discount' || payment.payment_method === 'credit_note'
              return (
                <div key={payment.id} className="flex items-center justify-between bg-zinc-800/30 rounded-lg p-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {payment.receipt_number && (
                        <Link to={`/sale-payments/${payment.id}`} className="text-sm font-medium text-teal-400 hover:text-teal-300">
                          {payment.receipt_number}
                        </Link>
                      )}
                      <span className="text-sm text-zinc-400">{formatDate(payment.payment_date)}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        payment.payment_method === 'discount' ? 'bg-amber-900/40 text-amber-400' :
                        payment.payment_method === 'credit_note' ? 'bg-orange-900/40 text-orange-400' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {methodLabels[payment.payment_method] || payment.payment_method}
                      </span>
                      {payment.reference && <span className="text-xs text-zinc-500">Ref: {payment.reference}</span>}
                    </div>
                    {payment.notes && <p className="text-xs text-zinc-500 mt-1">{payment.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className={`font-medium ${isNonCash ? 'text-amber-400' : 'text-green-400'}`}>{formatCurrency(payment.amount)}</span>
                    {payment.receipt_number && (
                      <Link to={`/sale-payments/${payment.id}`} title="Print receipt" className="text-zinc-400 hover:text-teal-400">
                        <Printer className="w-4 h-4" />
                      </Link>
                    )}
                    {!isEmployee && (
                      <button onClick={() => handleDeletePayment(payment.id, payment.amount)} className="text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function CheckCircle({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}
