import { supabase } from '../lib/supabase'

export function FramerPage() {
  return (
    <div>
      <p>Framer view</p>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  )
}