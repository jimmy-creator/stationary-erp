/**
 * Core finance calculation functions.
 * Pure functions — no side effects, no Supabase, no React.
 * Imported by both the app components and the test suite.
 */

// ─── Sale totals ──────────────────────────────────────────────────────────────

/**
 * Calculate sale totals from line items and percentages.
 * @param {Array<{unit_price: number, quantity: number}>} items
 * @param {number} discountPct  0–100
 * @param {number} taxPct       0–100
 */
export function calcSaleTotals(items, discountPct = 0, taxPct = 0) {
  const subtotal = items.reduce((sum, item) => {
    return sum + (parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 0)
  }, 0)

  const discountAmount = subtotal * (parseFloat(discountPct) || 0) / 100
  const afterDiscount  = subtotal - discountAmount
  const taxAmount      = afterDiscount * (parseFloat(taxPct) || 0) / 100
  const grandTotal     = afterDiscount + taxAmount

  return {
    subtotal:       round2(subtotal),
    discountAmount: round2(discountAmount),
    afterDiscount:  round2(afterDiscount),
    taxAmount:      round2(taxAmount),
    grandTotal:     round2(grandTotal),
  }
}

/**
 * Validate that a stored sale's grand_total matches the calculated value.
 * Returns the difference (0 = correct).
 */
export function validateSaleTotals(sale) {
  const expected = round2(
    parseFloat(sale.subtotal || 0)
    - parseFloat(sale.discount_amount || 0)
    + parseFloat(sale.tax_amount || 0)
  )
  return round2(parseFloat(sale.grand_total || 0) - expected)
}

// ─── Balance calculations ─────────────────────────────────────────────────────

/**
 * Outstanding balance for a single sale.
 */
export function saleBalance(sale) {
  return Math.max(0, round2(parseFloat(sale.grand_total || 0) - parseFloat(sale.amount_paid || 0)))
}

/**
 * Total AR outstanding from a list of sales.
 */
export function calcAR(sales) {
  return round2(sales
    .filter(s => s.payment_status !== 'paid')
    .reduce((sum, s) => sum + saleBalance(s), 0))
}

/**
 * Total AP outstanding from a list of purchase orders.
 */
export function calcAP(orders) {
  return round2(orders
    .filter(o => o.payment_status !== 'paid')
    .reduce((sum, o) => sum + Math.max(0, parseFloat(o.grand_total || 0) - parseFloat(o.amount_paid || 0)), 0))
}

// ─── Cash flow ────────────────────────────────────────────────────────────────

/**
 * Net cash = (cash sales received + cash collections) - (cash expenses + cash PO payments)
 */
export function calcNetCash({ cashSalesReceived, cashCollections, cashExpenses, cashPOPayments }) {
  return round2(
    (parseFloat(cashSalesReceived) || 0) + (parseFloat(cashCollections) || 0)
    - (parseFloat(cashExpenses) || 0) - (parseFloat(cashPOPayments) || 0)
  )
}

// ─── Number to words ─────────────────────────────────────────────────────────

export function numberToWords(amount) {
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ]
  const tensArr = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function convert(n) {
    if (n === 0) return ''
    if (n < 20) return ones[n]
    if (n < 100) return tensArr[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '')
  }

  const intPart = Math.floor(Math.abs(amount))
  const fils    = Math.round((Math.abs(amount) - intPart) * 100)

  if (intPart === 0 && fils === 0) return 'Zero only'

  let result = ''
  let rem = intPart
  if (rem >= 1000000) { result += convert(Math.floor(rem / 1000000)) + ' Million '; rem = rem % 1000000 }
  if (rem >= 1000)    { result += convert(Math.floor(rem / 1000))    + ' Thousand '; rem = rem % 1000 }
  if (rem > 0)          result += convert(rem)

  if (fils > 0) result += ' and ' + convert(fils) + ' Fils'
  return result.trim() + ' only'
}

// ─── Reconciliation helpers ───────────────────────────────────────────────────

/**
 * Sum a numeric field across an array of objects.
 */
export function sumField(arr, key) {
  return (arr || []).reduce((s, x) => s + (parseFloat(x[key]) || 0), 0)
}

/**
 * Sum a numeric field only for rows where filterField === filterVal.
 */
export function sumFieldWhere(arr, key, filterField, filterVal) {
  return (arr || []).filter(x => x[filterField] === filterVal).reduce((s, x) => s + (parseFloat(x[key]) || 0), 0)
}

// ─── Minimum price guard ──────────────────────────────────────────────────────

/**
 * Returns the minimum allowed effective price for an item (90% of selling price).
 */
export function minAllowedPrice(sellingPrice) {
  return round2(parseFloat(sellingPrice) * 0.9)
}

/**
 * Returns true if the item's effective price (after order-level discount) is below
 * the 90% floor of the catalogue selling price.
 * @param {number} unitPrice     — price entered on the line item
 * @param {number} discountPct   — order-level discount 0–100
 * @param {number} sellingPrice  — catalogue selling price
 */
export function isPriceTooLow(unitPrice, discountPct, sellingPrice) {
  const effective = parseFloat(unitPrice) * (1 - (parseFloat(discountPct) || 0) / 100)
  return effective < minAllowedPrice(sellingPrice)
}

// ─── Date range calculator ────────────────────────────────────────────────────

/**
 * Returns { from, to } date strings for a reporting period.
 * @param {'month'|'year'|'range'|'all'} period
 * @param {string} selectedMonth  — 'YYYY-MM' (used for month/year modes)
 * @param {{ from: string, to: string }} dateRange — used for range mode
 */
export function getDateRange(period, selectedMonth, dateRange) {
  if (period === 'month') {
    const [y, m] = selectedMonth.split('-')
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate()
    return { from: `${selectedMonth}-01`, to: `${selectedMonth}-${String(lastDay).padStart(2, '0')}` }
  }
  if (period === 'year') {
    const y = selectedMonth.split('-')[0]
    return { from: `${y}-01-01`, to: `${y}-12-31` }
  }
  if (period === 'range') return dateRange
  return { from: '2000-01-01', to: '2099-12-31' }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function round2(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100
}
