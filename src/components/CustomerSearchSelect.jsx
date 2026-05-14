import { useState, useEffect, useRef, useMemo } from 'react'

/**
 * Customer search dropdown — mirrors ProductSearchSelect.
 * Type to filter by name or phone, arrow keys to navigate, Enter/click to select.
 * Empty value represents "Walk-in Customer".
 */
export function CustomerSearchSelect({ customers, value, onChange, onConfirm, autoFocus, className, walkInLabel = 'Walk-in Customer', disabled = false }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const wrapperRef = useRef(null)

  const selectedCustomer = customers.find(c => c.id === value)

  // Build the visible list — always lead with the walk-in entry (id null)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = !q
      ? customers
      : customers.filter(c => {
          const name = (c.name || '').toLowerCase()
          const phone = (c.phone || '').toLowerCase()
          return name.includes(q) || phone.includes(q)
        })
    const walkIn = { id: null, name: walkInLabel, _walkIn: true }
    // Hide walk-in when the query clearly doesn't match it
    if (q && !walkInLabel.toLowerCase().includes(q)) return matched
    return [walkIn, ...matched]
  }, [customers, query, walkInLabel])

  useEffect(() => {
    setHighlightIndex(0)
  }, [filtered.length])

  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[highlightIndex]
    if (item) item.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex])

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [autoFocus])

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

  const selectCustomer = (customer) => {
    onChange(customer.id || '')
    setQuery('')
    setOpen(false)
    onConfirm?.()
  }

  const handleInputChange = (e) => {
    if (disabled) return
    setQuery(e.target.value)
    setOpen(true)
  }

  const handleFocus = () => {
    if (disabled) return
    setQuery('')
    setOpen(true)
  }

  const handleKeyDown = (e) => {
    if (disabled) return
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
      const customer = filtered[highlightIndex]
      if (customer) selectCustomer(customer)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    } else if (e.key === 'Tab') {
      setOpen(false)
      setQuery('')
    }
  }

  const displayValue = open ? query : (selectedCustomer?.name || walkInLabel)

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder="Search customer…"
        autoComplete="off"
        data-customer-select
        disabled={disabled}
        className={className}
      />

      {open && (
        <ul
          ref={listRef}
          className="product-search-dropdown absolute z-50 left-0 right-0 mt-1 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl max-h-56 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-400">No customers found</li>
          ) : (
            filtered.map((c, i) => (
              <li
                key={c.id ?? '__walkin__'}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectCustomer(c)
                }}
                onMouseEnter={() => setHighlightIndex(i)}
                className={`px-3 py-2 text-sm cursor-pointer flex justify-between items-center gap-2 ${
                  i === highlightIndex
                    ? 'bg-teal-600/20 text-teal-200'
                    : c._walkIn
                      ? 'text-zinc-400 italic hover:bg-zinc-700/60'
                      : 'text-zinc-200 hover:bg-zinc-700/60'
                }`}
              >
                <span className="truncate">{c.name}</span>
                {c.phone && !c._walkIn && (
                  <span className="text-xs text-zinc-500 shrink-0">{c.phone}</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
