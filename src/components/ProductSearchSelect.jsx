import { useState, useEffect, useRef, useMemo } from 'react'

/**
 * Cross-platform product search dropdown.
 * Replaces the native <select size=N> trick which only works reliably on Mac.
 * Type to filter, arrow keys to navigate, Enter/click to select.
 */
export function ProductSearchSelect({ products, value, onChange, onConfirm, autoFocus, className }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const wrapperRef = useRef(null)

  // Display name of currently selected product
  const selectedProduct = products.find(p => p.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(p => p.name.toLowerCase().includes(q))
  }, [products, query])

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(0)
  }, [filtered.length])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[highlightIndex]
    if (item) item.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex])

  // Auto-focus when the row is newly added
  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [autoFocus])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectProduct = (product) => {
    onChange(product.id)
    setQuery('')
    setOpen(false)
    onConfirm?.()   // move focus to qty field
  }

  const handleInputChange = (e) => {
    setQuery(e.target.value)
    setOpen(true)
  }

  const handleFocus = () => {
    setQuery('')
    setOpen(true)
  }

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setOpen(true)
        e.preventDefault()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const product = filtered[highlightIndex]
      if (product && product.stock_quantity > 0) selectProduct(product)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    } else if (e.key === 'Tab') {
      setOpen(false)
      setQuery('')
    }
  }

  const displayValue = open ? query : (selectedProduct?.name || '')

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder="Search product…"
        autoComplete="off"
        data-product-select
        className={className}
      />

      {open && (
        <ul
          ref={listRef}
          className="absolute z-50 left-0 right-0 mt-1 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl max-h-56 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500">No products found</li>
          ) : (
            filtered.map((p, i) => {
              const outOfStock = p.stock_quantity <= 0
              return (
                <li
                  key={p.id}
                  onMouseDown={(e) => {
                    e.preventDefault()  // prevent input blur before click fires
                    if (!outOfStock) selectProduct(p)
                  }}
                  onMouseEnter={() => setHighlightIndex(i)}
                  className={`px-3 py-2 text-sm cursor-pointer flex justify-between items-center gap-2 ${
                    outOfStock
                      ? 'text-zinc-600 cursor-not-allowed'
                      : i === highlightIndex
                        ? 'bg-teal-600/20 text-teal-200'
                        : 'text-zinc-200 hover:bg-zinc-700'
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  <span className={`text-xs shrink-0 ${outOfStock ? 'text-red-500' : 'text-zinc-500'}`}>
                    {outOfStock ? 'OUT OF STOCK' : `${p.stock_quantity} ${p.unit}`}
                  </span>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
