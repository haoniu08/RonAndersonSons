import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Header } from '../components/Header'

type SubmissionStatus = 'submitted' | 'reviewed' | 'rejected'

interface AdminSubmissionRow {
  id: string
  submission_date: string | null
  status: SubmissionStatus
  sites: { name: string } | null
  profiles: { name: string } | null
}

interface FilterOption {
  id: string
  name: string
}

const RAS_GREEN = '#045339'

export function AdminPage() {
  const { profile } = useAuth()

  const [submissions, setSubmissions] = useState<AdminSubmissionRow[]>([])
  const [sites, setSites] = useState<FilterOption[]>([])
  const [workers, setWorkers] = useState<FilterOption[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [siteFilter, setSiteFilter] = useState('')
  const [workerFilter, setWorkerFilter] = useState('')
  const [statusFilter, setStatusFilter] =
    useState<'' | SubmissionStatus>('')

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // -------------------------------------------------------
  // Load filter dropdown options
  // -------------------------------------------------------
  useEffect(() => {
    async function fetchOptions() {
      const [siteResult, workerResult] = await Promise.all([
        supabase
          .from('sites')
          .select('id, name')
          .order('name'),

        supabase
          .from('profiles')
          .select('id, name')
          .eq('role', 'framer')
          .order('name'),
      ])

      if (siteResult.error || workerResult.error) {
        setError('Could not load filter options.')
        return
      }

      setSites(siteResult.data ?? [])
      setWorkers(workerResult.data ?? [])
    }

    void fetchOptions()
  }, [])

  // -------------------------------------------------------
  // Load submissions whenever filters change
  // -------------------------------------------------------
  useEffect(() => {
    async function fetchSubmissions() {
      setLoading(true)
      setError(null)

      if (dateFrom && dateTo && dateFrom > dateTo) {
        setSubmissions([])
        setError('From date cannot be later than To date.')
        setLoading(false)
        return
      }

      let query = supabase
        .from('submissions')
        .select(`
          id,
          submission_date,
          status,
          sites(name),
          profiles(name)
        `)
        .neq('status', 'draft')
        .order('created_at', { ascending: false })

      if (siteFilter) {
        query = query.eq('site_id', siteFilter)
      }

      if (workerFilter) {
        query = query.eq('user_id', workerFilter)
      }

      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      if (dateFrom) {
        query = query.gte('submission_date', dateFrom)
      }

      if (dateTo) {
        query = query.lte('submission_date', dateTo)
      }

      const { data, error } = await query

      if (error) {
        setError(error.message)
      } else {
        setSubmissions(data as unknown as AdminSubmissionRow[])
      }

      setLoading(false)
    }

    void fetchSubmissions()
  }, [
    siteFilter,
    workerFilter,
    statusFilter,
    dateFrom,
    dateTo,
  ])

  function clearFilters() {
    setSiteFilter('')
    setWorkerFilter('')
    setStatusFilter('')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters =
    siteFilter ||
    workerFilter ||
    statusFilter ||
    dateFrom ||
    dateTo

  // -------------------------------------------------------
  // Summary stats for currently filtered submissions
  // -------------------------------------------------------
  const summary = {
    total: submissions.length,

    submitted: submissions.filter(
      (submission) =>
        submission.status === 'submitted',
    ).length,

    reviewed: submissions.filter(
      (submission) =>
        submission.status === 'reviewed',
    ).length,

    rejected: submissions.filter(
      (submission) =>
        submission.status === 'rejected',
    ).length,
  }

  // -------------------------------------------------------
  // Submissions-per-site chart data
  // -------------------------------------------------------
  const submissionsBySite =
    submissions.reduce<Record<string, number>>(
      (accumulator, submission) => {
        const siteName =
          submission.sites?.name ?? 'Unknown site'

        accumulator[siteName] =
          (accumulator[siteName] ?? 0) + 1

        return accumulator
      },
      {},
    )

  const chartData = Object.entries(submissionsBySite)
    .map(([site, count]) => ({
      site,
      count,
    }))
    .sort((a, b) => b.count - a.count)

  return (
    <>
      <Header />

      <div className="page-container">
        <h1>Admin dashboard</h1>

        <p>
          Logged in as {profile?.name}
        </p>

        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() =>
              supabase.auth.signOut()
            }
          >
            Sign out
          </button>
        </div>

        <h2>Filters</h2>

        <div className="field-group">
          <label htmlFor="filter-site">
            Site
          </label>

          <select
            id="filter-site"
            className="field-select"
            value={siteFilter}
            onChange={(event) =>
              setSiteFilter(event.target.value)
            }
          >
            <option value="">
              All sites
            </option>

            {sites.map((site) => (
              <option
                key={site.id}
                value={site.id}
              >
                {site.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field-group">
          <label htmlFor="filter-worker">
            Worker
          </label>

          <select
            id="filter-worker"
            className="field-select"
            value={workerFilter}
            onChange={(event) =>
              setWorkerFilter(event.target.value)
            }
          >
            <option value="">
              All workers
            </option>

            {workers.map((worker) => (
              <option
                key={worker.id}
                value={worker.id}
              >
                {worker.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field-group">
          <label htmlFor="filter-status">
            Status
          </label>

          <select
            id="filter-status"
            className="field-select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | ''
                  | SubmissionStatus,
              )
            }
          >
            <option value="">
              All statuses
            </option>

            <option value="submitted">
              Submitted
            </option>

            <option value="reviewed">
              Reviewed
            </option>

            <option value="rejected">
              Rejected
            </option>
          </select>
        </div>

        <div className="field-group">
          <label htmlFor="filter-date-from">
            From date
          </label>

          <input
            id="filter-date-from"
            type="date"
            className="field-input"
            value={dateFrom}
            onChange={(event) =>
              setDateFrom(event.target.value)
            }
          />
        </div>

        <div className="field-group">
          <label htmlFor="filter-date-to">
            To date
          </label>

          <input
            id="filter-date-to"
            type="date"
            className="field-input"
            value={dateTo}
            onChange={(event) =>
              setDateTo(event.target.value)
            }
          />
        </div>

        {hasActiveFilters && (
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>
        )}

        <h2>Summary</h2>

        <div className="summary-grid">
          <div className="summary-card">
            <span className="summary-value">
              {summary.total}
            </span>

            <span className="summary-label">
              Total
            </span>
          </div>

          <div className="summary-card">
            <span className="summary-value">
              {summary.submitted}
            </span>

            <span className="summary-label">
              Awaiting review
            </span>
          </div>

          <div className="summary-card">
            <span className="summary-value">
              {summary.reviewed}
            </span>

            <span className="summary-label">
              Reviewed
            </span>
          </div>

          <div className="summary-card">
            <span className="summary-value">
              {summary.rejected}
            </span>

            <span className="summary-label">
              Rejected
            </span>
          </div>
        </div>

        <h2>Submissions per site</h2>

        {chartData.length === 0 ? (
          <p>No data to chart yet.</p>
        ) : (
          <div
            style={{
              width: '100%',
              height: Math.max(220, chartData.length * 60),
            }}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{
                  top: 8,
                  right: 12,
                  left: 8,
                  bottom: 8,
                }}
              >
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />

                <YAxis
                  type="category"
                  dataKey="site"
                  width={150}
                  tick={{ fontSize: 12 }}
                />

                <Tooltip />

                <Bar
                  dataKey="count"
                  fill={RAS_GREEN}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <h2>Submissions</h2>

        {loading && (
          <p>Loading...</p>
        )}

        {error && (
          <p
            className="error-text"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}

        {!loading &&
          !error &&
          submissions.length === 0 && (
            <p>No matching submissions.</p>
          )}

        <ul className="submission-list">
          {submissions.map((submission) => (
            <li key={submission.id}>
              <Link
                to={`/admin/submissions/${submission.id}`}
                className="submission-card"
              >
                <div className="site-name">
                  {submission.sites?.name ??
                    'Unknown site'}
                </div>

                <div className="meta-row">
                  Worker:{' '}
                  {submission.profiles?.name ??
                    'Unknown worker'}
                </div>

                <div className="meta-row">
                  {submission.submission_date ??
                    'No date'}
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