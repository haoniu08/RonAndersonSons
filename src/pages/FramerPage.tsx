import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Header } from '../components/Header'

interface SubmissionRow {
  id: string
  submission_date: string | null
  status: 'draft' | 'submitted' | 'reviewed' | 'rejected'
  sites: { name: string } | null
}

interface LocationState {
  successMessage?: string
}

export function FramerPage() {
  const { profile } = useAuth()
  const location = useLocation()

  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const successMessage =
    (location.state as LocationState | null)?.successMessage ?? null

  useEffect(() => {
    if (!profile) return

    async function fetchSubmissions() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('submissions')
        .select('id, submission_date, status, sites(name)')
        .order('created_at', { ascending: false })

      if (error) {
        setError(error.message)
      } else {
        setSubmissions(data as unknown as SubmissionRow[])
      }

      setLoading(false)
    }

    void fetchSubmissions()
  }, [profile])

  return (
    <>
      <Header />

      <div className="page-container">
        <h1>Welcome, {profile?.name}</h1>

        {successMessage && (
          <p
            className="success-text"
            role="status"
            aria-live="polite"
          >
            {successMessage}
          </p>
        )}

        <div className="btn-row framer-actions">
          <Link
            to="/framer/submissions/new"
            className="btn btn-primary"
          >
            New safety form
          </Link>

          <button
            type="button"
            className="btn"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </div>

        <h2>Your submissions</h2>

        {loading && <p>Loading...</p>}

        {error && (
          <p
            className="error-text"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}

        {!loading && !error && submissions.length === 0 && (
          <p>No submissions yet.</p>
        )}

        <ul className="submission-list">
          {submissions.map((submission) => (
            <li key={submission.id}>
              <Link
                to={`/framer/submissions/${submission.id}`}
                className="submission-card"
              >
                <div className="site-name">
                  {submission.sites?.name ?? 'No site selected'}
                </div>

                <div className="meta-row">
                  {submission.submission_date ?? 'No date selected'}
                </div>

                <div className="meta-row">
                  Status: {submission.status}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}