import { supabase } from './supabase'

// Two stores share this codebase; each runs against its own Supabase DB. Pull
// the store's logo_url / store_name from its store_settings row and apply them
// as the browser favicon and tab title, so each deployment is visually distinct.
export async function applyStoreBranding() {
  try {
    const { data } = await supabase
      .from('store_settings')
      .select('store_name, logo_url')
      .limit(1)
      .single()
    if (!data) return

    if (data.store_name) document.title = `${data.store_name} ERP`

    if (data.logo_url) {
      let link = document.querySelector("link[rel='icon']")
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = data.logo_url
    }
  } catch (error) {
    console.error('Error applying store branding:', error)
  }
}
