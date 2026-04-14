import { useState, useEffect, useRef, useMemo } from 'react'

export function Autocomplete({
  value,
  onChange,
  suggestions,
  placeholder,
  required,
  className,
}) {
  const [isFocused, setIsFocused] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)

  const filtered = useMemo(() => {
    if (value && value.length > 0) {
      const matches = suggestions.filter((item) =>
        item.toLowerCase().includes(value.toLowerCase())
      )
      return matches.slice(0, 10)
    }
    return []
  }, [value, suggestions])

  // Derive isOpen from state - no useEffect needed
  const isOpen = isFocused && filtered.length > 0

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (item) => {
    onChange(item)
    setIsFocused(false)
    inputRef.current?.blur()
  }

  const handleKeyDown = (e) => {
    if (!isOpen) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : prev))
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault()
      handleSelect(filtered[highlightIndex])
    } else if (e.key === 'Escape') {
      setIsFocused(false)
    }
  }

  const handleInputChange = (e) => {
    onChange(e.target.value)
    setHighlightIndex(-1)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        className={className}
        autoComplete="off"
      />
      {isOpen && (
        <ul className="absolute z-20 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg max-h-60 overflow-auto">
          {filtered.map((item, index) => (
            <li
              key={item}
              onClick={() => handleSelect(item)}
              className={`px-3 py-2 cursor-pointer text-sm ${
                index === highlightIndex
                  ? 'bg-teal-500/20 text-teal-300'
                  : 'text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
