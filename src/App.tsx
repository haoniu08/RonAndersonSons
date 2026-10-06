import { supabase } from './lib/supabase'
import { useAuth } from './context/AuthContext'

function App() {
  const { session, profile, loading } = useAuth()

  return (
    <div style={{ padding: '2rem' }}>
      <p>Loading: {String(loading)}</p>
      <p>Session: {session ? session.user.email : 'none'}</p>
      <p>Profile: {profile ? JSON.stringify(profile) : 'none'}</p>

      <button
        onClick={() =>
          supabase.auth.signInWithPassword({
            email: 'framer@ras-test.com',
            password: 'framer123',
          })
        }
      >
        Sign in as Framer
      </button>

      <button
        onClick={() =>
          supabase.auth.signInWithPassword({
            email: 'admin@ras-test.com',
            password: 'admin123',
          })
        }
      >
        Sign in as Admin
      </button>

      <button
        onClick={() => supabase.auth.signOut()}
      >
        Sign out
      </button>

      <button
        onClick={async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')

          console.log('profiles:', data)
          console.log('error:', error)
        }}
      >
        Test profiles read
      </button>
    </div>
  )
}

export default App