import { supabase } from '../lib/supabase'

export function AdminPage() {
  return (
    <div>
        <p>Admin view</p>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  )
}
