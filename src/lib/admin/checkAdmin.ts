// src/lib/admin/checkAdmin.ts
import { createClient } from '@/lib/supabase/server'

export async function checkIsAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { isAdmin: false, user: null }
  }

  // Check if user exists in admin_users view
  const { data: adminUser, error } = await supabase
    .from('admin_users')
    .select('id, email, is_admin')
    .eq('id', user.id)
    .single()

  const isAdmin = !error && adminUser?.is_admin === true

  return { isAdmin, user }
}