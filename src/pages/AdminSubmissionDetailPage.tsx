import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Header } from '../components/Header'

type SubmissionStatus =
  | 'submitted'
  | 'reviewed'
  | 'rejected'

interface ChecklistState {
  ppe_worn: boolean
  fall_protection: boolean
  scaffolding_inspected: boolean
  tools_condition_good: boolean
  hazards_identified: boolean
}

const checklistLabels: Record<keyof ChecklistState, string> = {
  ppe_worn: 'PPE worn (hard hat, vest, boots, eye protection)',
  fall_protection: 'Fall protection in place',
  scaffolding_inspected: 'Ladders/scaffolding inspected',
  tools_condition_good: 'Tools and cords in good condition',
  hazards_identified: 'Hazards identified',
}

interface SubmissionPhoto {
  id: string
  storage_path: string
  file_name: string
  url?: string
}

interface SubmissionDetail {
  id: string
  site_name: string
  worker_name: string
  submission_date: string | null
  notes: string | null
  status: SubmissionStatus
  checklist: ChecklistState
}

export function AdminSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [detail, setDetail] =
    useState<SubmissionDetail | null>(null)

  const [photos, setPhotos] =
    useState<SubmissionPhoto[]>([])

  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(false)

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setError('Invalid submission.')
      setLoading(false)
      return
    }

    async function fetchDetail() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('submissions')
        .select(`
          id,
          submission_date,
          notes,
          status,
          ppe_worn,
          fall_protection,
          scaffolding_inspected,
          tools_condition_good,
          hazards_identified,
          sites(name),
          profiles(name)
        `)
        .eq('id', id)
        .neq('status', 'draft')
        .single()

      if (error || !data) {
        setError('Could not load this submission.')
        setLoading(false)
        return
      }

      const site =
        data.sites as unknown as { name: string } | null

      const worker =
        data.profiles as unknown as { name: string } | null

      setDetail({
        id: data.id,
        site_name: site?.name ?? 'Unknown site',
        worker_name: worker?.name ?? 'Unknown worker',
        submission_date: data.submission_date,
        notes: data.notes,
        status: data.status as SubmissionStatus,

        checklist: {
          ppe_worn: data.ppe_worn ?? false,
          fall_protection: data.fall_protection ?? false,
          scaffolding_inspected:
            data.scaffolding_inspected ?? false,
          tools_condition_good:
            data.tools_condition_good ?? false,
          hazards_identified:
            data.hazards_identified ?? false,
        },
      })

      setLoading(false)
    }

    void fetchDetail()
  }, [id])

  useEffect(() => {
    if (!id) return

    async function fetchPhotos() {
      const { data, error } = await supabase
        .from('submission_photos')
        .select('id, storage_path, file_name')
        .eq('submission_id', id)
        .order('created_at', { ascending: true })

      if (error) {
        setError('Could not load submission photos.')
        return
      }

      if (!data || data.length === 0) {
        setPhotos([])
        return
      }

      const paths = data.map(
        (photo) => photo.storage_path,
      )

      const { data: signedData, error: signedError } =
        await supabase.storage
          .from('submission-photos')
          .createSignedUrls(paths, 60 * 60)

      if (signedError) {
        setError('Could not load photo previews.')

        setPhotos(
          data.map((photo) => ({
            ...photo,
            url: undefined,
          })),
        )

        return
      }

      setPhotos(
        data.map((photo, index) => ({
          ...photo,
          url:
            signedData?.[index]?.signedUrl ??
            undefined,
        })),
      )
    }

    void fetchPhotos()
  }, [id])

  async function handleReview(
    newStatus: 'reviewed' | 'rejected',
  ) {
    if (!id || !detail) return
    if (detail.status !== 'submitted') return

    const message =
      newStatus === 'reviewed'
        ? 'Mark this submission as reviewed?'
        : 'Reject this submission?'

    if (!window.confirm(message)) return

    setActioning(true)
    setError(null)

    const { data, error } = await supabase
      .from('submissions')
      .update({
        status: newStatus,
      })
      .eq('id', id)
      .eq('status', 'submitted')
      .select('id')

    if (error) {
      setError(error.message)
      setActioning(false)
      return
    }

    if (!data || data.length === 0) {
      setError(
        'This submission has already been reviewed or changed by another session.',
      )
      setActioning(false)
      return
    }

    setDetail((previous) =>
      previous
        ? {
            ...previous,
            status: newStatus,
          }
        : previous,
    )

    setActioning(false)
  }

  if (loading) {
    return (
      <>
        <Header />

        <div className="page-container">
          <p>Loading...</p>
        </div>
      </>
    )
  }

  if (!detail) {
    return (
      <>
        <Header />

        <div className="page-container">
          <p className="error-text">
            {error ?? 'Submission not found.'}
          </p>

          <div className="btn-row">
            <button
              type="button"
              className="btn"
              onClick={() => navigate('/admin')}
            >
              Back
            </button>
          </div>
        </div>
      </>
    )
  }

  const canReview =
    detail.status === 'submitted'

  return (
    <>
      <Header />

      <div className="page-container">
        <h1>Submission detail</h1>

        <p className="readonly-banner">
          Status: {detail.status}
        </p>

        <div className="field-group">
          <strong>Worker:</strong>{' '}
          {detail.worker_name}
        </div>

        <div className="field-group">
          <strong>Site:</strong>{' '}
          {detail.site_name}
        </div>

        <div className="field-group">
          <strong>Date:</strong>{' '}
          {detail.submission_date ?? 'No date'}
        </div>

        <div className="field-group">
          <h2>Checklist</h2>

          {(Object.keys(checklistLabels) as Array<
            keyof ChecklistState
          >).map((key) => (
            <label
              key={key}
              className="checklist-item"
            >
              <input
                type="checkbox"
                checked={detail.checklist[key]}
                disabled
                readOnly
              />

              <span>
                {checklistLabels[key]}
              </span>
            </label>
          ))}
        </div>

        <div className="field-group">
          <h2>Notes</h2>

          <p>
            {detail.notes || 'No notes provided.'}
          </p>
        </div>

        <div className="field-group">
          <h2>Photos</h2>

          {photos.length === 0 && (
            <p>No photos attached.</p>
          )}

          <div className="photo-grid">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="photo-thumb"
              >
                {photo.url ? (
                  <a
                    href={photo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={photo.url}
                      alt={photo.file_name}
                    />
                  </a>
                ) : (
                  <div className="photo-placeholder" />
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p
            className="error-text"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}

        {canReview && (
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                handleReview('reviewed')
              }
              disabled={actioning}
            >
              {actioning
                ? 'Saving...'
                : 'Mark reviewed'}
            </button>

            <button
              type="button"
              className="btn btn-danger"
              onClick={() =>
                handleReview('rejected')
              }
              disabled={actioning}
            >
              {actioning
                ? 'Saving...'
                : 'Reject'}
            </button>
          </div>
        )}

        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() =>
              navigate('/admin')
            }
            disabled={actioning}
          >
            Back
          </button>
        </div>
      </div>
    </>
  )
}