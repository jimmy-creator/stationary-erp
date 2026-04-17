import { describe, it, expect } from 'vitest'
import {
  calcSaleTotals,
  validateSaleTotals,
  saleBalance,
  calcAR,
  calcAP,
  calcNetCash,
  numberToWords,
  round2,
  sumField,
  sumFieldWhere,
  minAllowedPrice,
  isPriceTooLow,
  getDateRange,
} from '../lib/finance.js'

// ─────────────────────────────────────────────────────────────────────────────
// Sale totals
// ─────────────────────────────────────────────────────────────────────────────
describe('calcSaleTotals', () => {
  it('computes subtotal from items', () => {
    const items = [
      { unit_price: 10, quantity: 2 },
      { unit_price: 5,  quantity: 4 },
    ]
    const { subtotal } = calcSaleTotals(items)
    expect(subtotal).toBe(40)
  })

  it('applies discount correctly', () => {
    const items = [{ unit_price: 100, quantity: 1 }]
    const { discountAmount, afterDiscount } = calcSaleTotals(items, 10)
    expect(discountAmount).toBe(10)
    expect(afterDiscount).toBe(90)
  })

  it('applies tax on after-discount amount', () => {
    const items = [{ unit_price: 100, quantity: 1 }]
    const { taxAmount, grandTotal } = calcSaleTotals(items, 10, 15) // 10% disc → 90, 15% tax → 103.50
    expect(taxAmount).toBe(13.5)
    expect(grandTotal).toBe(103.5)
  })

  it('zero discount and zero tax returns subtotal as grand total', () => {
    const items = [{ unit_price: 50, quantity: 3 }]
    const { grandTotal, subtotal } = calcSaleTotals(items, 0, 0)
    expect(grandTotal).toBe(subtotal)
    expect(grandTotal).toBe(150)
  })

  it('handles empty items list', () => {
    const { subtotal, grandTotal } = calcSaleTotals([])
    expect(subtotal).toBe(0)
    expect(grandTotal).toBe(0)
  })

  it('handles string number inputs', () => {
    const items = [{ unit_price: '25.50', quantity: '2' }]
    const { subtotal } = calcSaleTotals(items)
    expect(subtotal).toBe(51)
  })

  it('rounds to 2 decimal places', () => {
    const items = [{ unit_price: 10, quantity: 3 }]
    const { taxAmount } = calcSaleTotals(items, 0, 15) // 30 * 15% = 4.50 exactly
    expect(taxAmount).toBe(4.5)
  })

  it('QAR 162 with no discount/tax', () => {
    const items = [{ unit_price: 162, quantity: 1 }]
    const { grandTotal } = calcSaleTotals(items)
    expect(grandTotal).toBe(162)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Validate stored sale totals
// ─────────────────────────────────────────────────────────────────────────────
describe('validateSaleTotals', () => {
  it('returns 0 for a correctly stored sale', () => {
    const sale = { subtotal: 100, discount_amount: 10, tax_amount: 13.5, grand_total: 103.5 }
    expect(validateSaleTotals(sale)).toBe(0)
  })

  it('detects a discrepancy', () => {
    const sale = { subtotal: 100, discount_amount: 0, tax_amount: 0, grand_total: 105 }
    expect(validateSaleTotals(sale)).toBe(5)
  })

  it('handles missing fields as zero', () => {
    const sale = { grand_total: 100 }
    expect(validateSaleTotals(sale)).toBe(100) // 100 - 0 = 100 diff
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Sale balance
// ─────────────────────────────────────────────────────────────────────────────
describe('saleBalance', () => {
  it('returns outstanding amount', () => {
    expect(saleBalance({ grand_total: 100, amount_paid: 60 })).toBe(40)
  })

  it('returns 0 when fully paid', () => {
    expect(saleBalance({ grand_total: 100, amount_paid: 100 })).toBe(0)
  })

  it('never returns negative (overpayment)', () => {
    expect(saleBalance({ grand_total: 100, amount_paid: 110 })).toBe(0)
  })

  it('returns grand_total when nothing paid', () => {
    expect(saleBalance({ grand_total: 162, amount_paid: 0 })).toBe(162)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AR calculation
// ─────────────────────────────────────────────────────────────────────────────
describe('calcAR', () => {
  it('sums balances of unpaid and partial sales only', () => {
    const sales = [
      { grand_total: 100, amount_paid: 100, payment_status: 'paid' },
      { grand_total: 200, amount_paid: 50,  payment_status: 'partial' },
      { grand_total: 150, amount_paid: 0,   payment_status: 'unpaid' },
    ]
    expect(calcAR(sales)).toBe(300) // 150 + 150
  })

  it('returns 0 when all sales are paid', () => {
    const sales = [
      { grand_total: 100, amount_paid: 100, payment_status: 'paid' },
      { grand_total: 200, amount_paid: 200, payment_status: 'paid' },
    ]
    expect(calcAR(sales)).toBe(0)
  })

  it('returns 0 for empty list', () => {
    expect(calcAR([])).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// AP calculation
// ─────────────────────────────────────────────────────────────────────────────
describe('calcAP', () => {
  it('sums outstanding PO balances', () => {
    const orders = [
      { grand_total: 500, amount_paid: 500, payment_status: 'paid' },
      { grand_total: 300, amount_paid: 100, payment_status: 'partial' },
      { grand_total: 200, amount_paid: 0,   payment_status: 'unpaid' },
    ]
    expect(calcAP(orders)).toBe(400) // 200 + 200
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Net cash
// ─────────────────────────────────────────────────────────────────────────────
describe('calcNetCash', () => {
  it('computes net cash correctly', () => {
    const result = calcNetCash({
      cashSalesReceived: 1000,
      cashCollections:   200,
      cashExpenses:      300,
      cashPOPayments:    150,
    })
    expect(result).toBe(750) // (1000+200) - (300+150) = 750
  })

  it('returns negative when outflows exceed inflows', () => {
    const result = calcNetCash({
      cashSalesReceived: 100,
      cashCollections:   0,
      cashExpenses:      200,
      cashPOPayments:    0,
    })
    expect(result).toBe(-100)
  })

  it('returns 0 when balanced', () => {
    expect(calcNetCash({ cashSalesReceived: 500, cashCollections: 0, cashExpenses: 300, cashPOPayments: 200 })).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Number to words
// ─────────────────────────────────────────────────────────────────────────────
describe('numberToWords', () => {
  it('zero', () => {
    expect(numberToWords(0)).toBe('Zero only')
  })

  it('whole numbers', () => {
    expect(numberToWords(1)).toBe('One only')
    expect(numberToWords(15)).toBe('Fifteen only')
    expect(numberToWords(100)).toBe('One Hundred only')
    expect(numberToWords(162)).toBe('One Hundred Sixty Two only')
    expect(numberToWords(1000)).toBe('One Thousand only')
    expect(numberToWords(1001)).toBe('One Thousand One only')
  })

  it('decimals become fils', () => {
    expect(numberToWords(5.50)).toBe('Five and Fifty Fils only')
    expect(numberToWords(12.75)).toBe('Twelve and Seventy Five Fils only')
    expect(numberToWords(100.01)).toBe('One Hundred and One Fils only')
  })

  it('large amounts', () => {
    expect(numberToWords(1000000)).toBe('One Million only')
    expect(numberToWords(1500000)).toBe('One Million Five Hundred Thousand only')
  })

  it('typical invoice amounts', () => {
    expect(numberToWords(347)).toBe('Three Hundred Forty Seven only')
    expect(numberToWords(62)).toBe('Sixty Two only')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Reconciliation helpers
// ─────────────────────────────────────────────────────────────────────────────
describe('sumField', () => {
  it('sums a field across rows', () => {
    const rows = [{ amount: 100 }, { amount: 200 }, { amount: 50.5 }]
    expect(sumField(rows, 'amount')).toBe(350.5)
  })

  it('handles missing or null values as 0', () => {
    const rows = [{ amount: 100 }, { amount: null }, { amount: undefined }, {}]
    expect(sumField(rows, 'amount')).toBe(100)
  })

  it('handles empty array', () => {
    expect(sumField([], 'amount')).toBe(0)
  })

  it('handles null/undefined array gracefully', () => {
    expect(sumField(null, 'amount')).toBe(0)
    expect(sumField(undefined, 'amount')).toBe(0)
  })
})

describe('sumFieldWhere', () => {
  it('sums only matching rows', () => {
    const sales = [
      { grand_total: 100, payment_method: 'cash' },
      { grand_total: 200, payment_method: 'card' },
      { grand_total: 150, payment_method: 'cash' },
    ]
    expect(sumFieldWhere(sales, 'grand_total', 'payment_method', 'cash')).toBe(250)
    expect(sumFieldWhere(sales, 'grand_total', 'payment_method', 'card')).toBe(200)
    expect(sumFieldWhere(sales, 'grand_total', 'payment_method', 'bank_transfer')).toBe(0)
  })

  it('reconciliation check 1 — method sum equals total invoiced', () => {
    const sales = [
      { grand_total: 500, payment_method: 'cash' },
      { grand_total: 300, payment_method: 'card' },
      { grand_total: 200, payment_method: 'bank_transfer' },
      { grand_total: 100, payment_method: 'credit' },
    ]
    const total  = sumField(sales, 'grand_total')
    const byMethod = ['cash', 'card', 'bank_transfer', 'credit']
      .reduce((s, m) => s + sumFieldWhere(sales, 'grand_total', 'payment_method', m), 0)
    expect(total).toBe(1100)
    expect(total - byMethod).toBe(0)   // check 1 diff must be 0
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Minimum price guard
// ─────────────────────────────────────────────────────────────────────────────
describe('minAllowedPrice', () => {
  it('returns 90% of selling price', () => {
    expect(minAllowedPrice(100)).toBe(90)
    expect(minAllowedPrice(50)).toBe(45)
    expect(minAllowedPrice(1.5)).toBe(1.35)
  })
})

describe('isPriceTooLow', () => {
  it('passes when unit price is at catalogue price with no discount', () => {
    expect(isPriceTooLow(100, 0, 100)).toBe(false)
  })

  it('passes when effective price is exactly at the 90% floor', () => {
    // 90 unit price, 0% discount → effective 90 = minAllowed(100) = 90 → not too low
    expect(isPriceTooLow(90, 0, 100)).toBe(false)
  })

  it('fails when unit price is below 90% floor', () => {
    expect(isPriceTooLow(89, 0, 100)).toBe(true)
  })

  it('fails when discount pushes effective price below floor', () => {
    // 100 unit price, 15% discount → effective 85 < 90 floor
    expect(isPriceTooLow(100, 15, 100)).toBe(true)
  })

  it('passes when discount keeps effective price above floor', () => {
    // 100 unit price, 5% discount → effective 95 > 90 floor
    expect(isPriceTooLow(100, 5, 100)).toBe(false)
  })

  it('real-world: QAR 162 product, no discount', () => {
    expect(isPriceTooLow(162, 0, 162)).toBe(false)
  })

  it('real-world: QAR 162 product, 15% discount pushes below floor', () => {
    // effective = 162 * 0.85 = 137.7, floor = 145.8 → too low
    expect(isPriceTooLow(162, 15, 162)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Date range calculator
// ─────────────────────────────────────────────────────────────────────────────
describe('getDateRange', () => {
  it('month — returns correct first and last day', () => {
    expect(getDateRange('month', '2026-01', {})).toEqual({ from: '2026-01-01', to: '2026-01-31' })
    expect(getDateRange('month', '2026-02', {})).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })

  it('month — handles leap year February', () => {
    expect(getDateRange('month', '2024-02', {})).toEqual({ from: '2024-02-01', to: '2024-02-29' })
  })

  it('month — 30-day month', () => {
    expect(getDateRange('month', '2026-04', {})).toEqual({ from: '2026-04-01', to: '2026-04-30' })
  })

  it('year — returns full calendar year', () => {
    expect(getDateRange('year', '2026-04', {})).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })

  it('range — passes through custom dates unchanged', () => {
    const range = { from: '2026-01-15', to: '2026-03-31' }
    expect(getDateRange('range', '2026-04', range)).toEqual(range)
  })

  it('all — returns full permissive range', () => {
    expect(getDateRange('all', '2026-04', {})).toEqual({ from: '2000-01-01', to: '2099-12-31' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// round2
// ─────────────────────────────────────────────────────────────────────────────
describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    // 1.005 is stored as 1.00499999... in IEEE 754, so rounds down
    expect(round2(1.005)).toBe(1)
    expect(round2(1.004)).toBe(1)
    expect(round2(10.125)).toBe(10.13)
    expect(round2(10.255)).toBe(10.26)
  })

  it('handles strings', () => {
    expect(round2('25.50')).toBe(25.5)
  })

  it('handles undefined/null as 0', () => {
    expect(round2(undefined)).toBe(0)
    expect(round2(null)).toBe(0)
  })
})
