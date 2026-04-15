import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

let cachedSettings = null

export function useStoreSettings() {
  const [settings, setSettings] = useState(cachedSettings || {
    store_name: '',
    address: '',
    phone: '',
    email: '',
  })
  const [loading, setLoading] = useState(!cachedSettings)

  useEffect(() => {
    if (cachedSettings) return
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .limit(1)
        .single()

      if (error) throw error
      if (data) {
        cachedSettings = data
        setSettings(data)
      }
    } catch (error) {
      console.error('Error fetching store settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshSettings = async () => {
    cachedSettings = null
    await fetchSettings()
  }

  return { settings, loading, refreshSettings }
}
