import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Fixed color palette cycled for new categories
const COLOR_PALETTE = [
  'teal', 'blue', 'indigo', 'purple', 'pink',
  'rose', 'orange', 'amber', 'yellow', 'cyan', 'green', 'zinc',
]

// Tailwind badge classes per color name
export const CATEGORY_COLOR_CLASSES = {
  pink:   'bg-pink-900/50 text-pink-400',
  yellow: 'bg-yellow-900/50 text-yellow-400',
  indigo: 'bg-indigo-900/50 text-indigo-400',
  teal:   'bg-teal-900/50 text-teal-400',
  orange: 'bg-orange-900/50 text-orange-400',
  cyan:   'bg-cyan-900/50 text-cyan-400',
  amber:  'bg-amber-900/50 text-amber-400',
  blue:   'bg-blue-900/50 text-blue-400',
  purple: 'bg-purple-900/50 text-purple-400',
  rose:   'bg-rose-900/50 text-rose-400',
  green:  'bg-green-900/50 text-green-400',
  zinc:   'bg-zinc-800 text-zinc-300',
}

export function useExpenseCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('label', { ascending: true })
      if (error) throw error
      setCategories(data || [])
    } catch (err) {
      console.error('Failed to load expense categories:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  const addCategory = useCallback(async (label) => {
    const trimmed = label.trim()
    if (!trimmed) return null

    // Generate a slug value from the label
    const value = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')

    // Pick next color from palette
    const usedColors = categories.map((c) => c.color)
    const color = COLOR_PALETTE.find((c) => !usedColors.includes(c)) || 'zinc'

    const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), 0)

    const { data, error } = await supabase
      .from('expense_categories')
      .insert({ value, label: trimmed, color, sort_order: maxOrder + 1 })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') throw new Error('A category with that name already exists.')
      throw error
    }

    setCategories((prev) => [...prev, data])
    return data
  }, [categories])

  const deleteCategory = useCallback(async (id) => {
    const { error } = await supabase.from('expense_categories').delete().eq('id', id)
    if (error) throw error
    setCategories((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return { categories, loading, addCategory, deleteCategory, refetch: fetchCategories }
}
