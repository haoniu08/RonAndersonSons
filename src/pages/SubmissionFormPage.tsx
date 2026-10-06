import { useEffect, useState, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Header } from '../components/Header'


interface Site {
  id: string
  name: string
}

type SubmissionStatus =
  | 'draft'
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

interface SubmissionPhoto {
  id: string
  storage_path: string
  file_name: string
  url?: string
}

const emptyChecklist: ChecklistState = {
  ppe_worn: false,
  fall_protection: false,
  scaffolding_inspected: false,
  tools_condition_good: false,
  hazards_identified: false,
}

const checklistLabels: Record<keyof ChecklistState, string> = {
  ppe_worn: 'PPE worn (hard hat, vest, boots, eye protection)',
  fall_protection: 'Fall protection in place',
  scaffolding_inspected: 'Ladders/scaffolding inspected',
  tools_condition_good: 'Tools and cords in good condition',
  hazards_identified: 'Hazards identified',
}

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function SubmissionFormPage() {
  const { profile } = useAuth()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const isNew = id === 'new'

  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState('')
  const [submissionDate, setSubmissionDate] = useState('')
  const [checklist, setChecklist] =
    useState<ChecklistState>(emptyChecklist)
  const [notes, setNotes] = useState('')

  const [status, setStatus] =
    useState<SubmissionStatus>('draft')

  const [submissionId, setSubmissionId] =
    useState<string | null>(null)

  const [photos, setPhotos] =
    useState<SubmissionPhoto[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<string[]>([])
  const [photoErrors, setPhotoErrors] = useState<string[]>([])

  const isReadOnly = status !== 'draft'
  const busy = saving || uploading

  useEffect(() => {
    async function fetchSites() {
      const { data, error } = await supabase
        .from('sites')
        .select('id, name')
        .eq('active', true)
        .order('name')

      if (error) {
        setError('Could not load sites.')
        return
      }

      setSites(data ?? [])
    }

    void fetchSites()
  }, [])

  useEffect(() => {
    if (isNew) {
      setLoading(false)
      return
    }

    if (!id) {
      setError('Invalid submission.')
      setLoading(false)
      return
    }

    async function fetchSubmission() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('submissions')
        .select(`
          id,
          site_id,
          submission_date,
          ppe_worn,
          fall_protection,
          scaffolding_inspected,
          tools_condition_good,
          hazards_identified,
          notes,
          status
        `)
        .eq('id', id)
        .single()

      if (error || !data) {
        setError('Could not load this submission.')
        setLoading(false)
        return
      }

      setSubmissionId(data.id)
      setSiteId(data.site_id ?? '')
      setSubmissionDate(data.submission_date ?? '')

      setChecklist({
        ppe_worn: data.ppe_worn ?? false,
        fall_protection: data.fall_protection ?? false,
        scaffolding_inspected:
          data.scaffolding_inspected ?? false,
        tools_condition_good:
          data.tools_condition_good ?? false,
        hazards_identified:
          data.hazards_identified ?? false,
      })

      setNotes(data.notes ?? '')
      setStatus(data.status as SubmissionStatus)
      setLoading(false)
    }

    void fetchSubmission()
  }, [id, isNew])

  useEffect(() => {
    if (!submissionId) return

    async function fetchPhotos() {
      const { data, error } = await supabase
        .from('submission_photos')
        .select('id, storage_path, file_name')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: true })

      if (error) {
        setPhotoErrors((previous) => [
          ...previous,
          'Could not load submission photos.',
        ])
        return
      }

      if (!data || data.length === 0) {
        setPhotos([])
        return
      }

      const paths = data.map((photo) => photo.storage_path)

      const { data: signedData, error: signedError } =
        await supabase.storage
          .from('submission-photos')
          .createSignedUrls(paths, 60 * 60)

      if (signedError) {
        setPhotoErrors((previous) => [
          ...previous,
          'Could not load photo previews.',
        ])
        setPhotos(data)
        return
      }

      const photosWithUrls: SubmissionPhoto[] = data.map(
        (photo, index) => ({
          ...photo,
          url: signedData?.[index]?.signedUrl ?? undefined,
        }),
      )

      setPhotos(photosWithUrls)
    }

    void fetchPhotos()
  }, [submissionId])

  function validate(): string[] {
    const errors: string[] = []

    if (!siteId) {
      errors.push('Please select a site.')
    }

    if (!submissionDate) {
      errors.push('Please select a date.')
    }

    if (!Object.values(checklist).every(Boolean)) {
      errors.push(
        'All checklist items must be confirmed before submitting.',
      )
    }

    if (photos.length === 0) {
      errors.push('Please attach at least one photo.')
    }

    return errors
  }

  async function ensureDraftExists(): Promise<string | null> {
    if (!profile) return null

    if (submissionId) {
      return submissionId
    }

    const { data, error } = await supabase
      .from('submissions')
      .insert({
        user_id: profile.id,
        site_id: siteId || null,
        submission_date: submissionDate || null,
        ...checklist,
        notes,
        status: 'draft',
      })
      .select('id')
      .single()

    if (error || !data) {
      setError(
        error?.message ?? 'Could not create draft submission.',
      )
      return null
    }

    setSubmissionId(data.id)

    navigate(`/framer/submissions/${data.id}`, {
      replace: true,
    })

    return data.id
  }

  async function saveDraft() {
    if (!profile || isReadOnly || busy) return

    setSaving(true)
    setError(null)
    setFieldErrors([])

    const draftPayload = {
      site_id: siteId || null,
      submission_date: submissionDate || null,
      ...checklist,
      notes,
      status: 'draft' as const,
    }

    if (submissionId) {
      const { error } = await supabase
        .from('submissions')
        .update(draftPayload)
        .eq('id', submissionId)

      if (error) {
        setError(error.message)
      }

      setSaving(false)
      return
    }

    const { data, error } = await supabase
      .from('submissions')
      .insert({
        user_id: profile.id,
        ...draftPayload,
      })
      .select('id')
      .single()

    if (error || !data) {
      setError(error?.message ?? 'Could not save draft.')
      setSaving(false)
      return
    }

    setSubmissionId(data.id)

    navigate(`/framer/submissions/${data.id}`, {
      replace: true,
    })

    setSaving(false)
  }

  async function handlePhotoSelect(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = event.target.files

    if (!files || files.length === 0) return
    if (!profile || isReadOnly || busy) return

    setPhotoErrors([])

    const validFiles: File[] = []
    const validationErrors: string[] = []

    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        validationErrors.push(
          `${file.name}: unsupported file type. Use JPEG, PNG, or WebP.`,
        )
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        validationErrors.push(
          `${file.name}: exceeds the 5 MB limit.`,
        )
        continue
      }

      validFiles.push(file)
    }

    if (validationErrors.length > 0) {
      setPhotoErrors(validationErrors)
    }

    if (validFiles.length === 0) {
      event.target.value = ''
      return
    }

    setUploading(true)
    setError(null)

    const currentSubmissionId = await ensureDraftExists()

    if (!currentSubmissionId) {
      setPhotoErrors((previous) => [
        ...previous,
        'Could not create a draft before uploading.',
      ])

      setUploading(false)
      event.target.value = ''
      return
    }

    for (const file of validFiles) {
      const uniqueFileName =
        `${crypto.randomUUID()}-${file.name}`

      const storagePath =
        `${profile.id}/${currentSubmissionId}/${uniqueFileName}`

      const { error: uploadError } =
        await supabase.storage
          .from('submission-photos')
          .upload(storagePath, file)

      if (uploadError) {
        setPhotoErrors((previous) => [
          ...previous,
          `${file.name}: upload failed (${uploadError.message})`,
        ])
        continue
      }

      const { data: insertedPhoto, error: insertError } =
        await supabase
          .from('submission_photos')
          .insert({
            submission_id: currentSubmissionId,
            storage_path: storagePath,
            file_name: file.name,
          })
          .select('id, storage_path, file_name')
          .single()

      if (insertError || !insertedPhoto) {
        await supabase.storage
          .from('submission-photos')
          .remove([storagePath])

        setPhotoErrors((previous) => [
          ...previous,
          `${file.name}: upload could not be completed.`,
        ])

        continue
      }

      const { data: signedData, error: signedError } =
        await supabase.storage
          .from('submission-photos')
          .createSignedUrl(storagePath, 60 * 60)

      if (signedError) {
        setPhotoErrors((previous) => [
          ...previous,
          `${file.name}: uploaded successfully, but preview could not be generated.`,
        ])
      }

      setPhotos((previous) => [
        ...previous,
        {
          ...insertedPhoto,
          url: signedData?.signedUrl ?? undefined,
        },
      ])
    }

    setUploading(false)
    event.target.value = ''
  }

  async function handleRemovePhoto(photo: SubmissionPhoto) {
    if (isReadOnly || busy) return

    const confirmed = window.confirm(
      `Remove ${photo.file_name}?`,
    )

    if (!confirmed) return

    setUploading(true)
    setPhotoErrors([])

    const { error: storageError } =
      await supabase.storage
        .from('submission-photos')
        .remove([photo.storage_path])

    if (storageError) {
      setPhotoErrors([
        `Could not remove ${photo.file_name} from storage.`,
      ])
      setUploading(false)
      return
    }

    const { error: databaseError } =
      await supabase
        .from('submission_photos')
        .delete()
        .eq('id', photo.id)

    if (databaseError) {
      setPhotoErrors([
        'The photo file was removed, but its database record could not be deleted.',
      ])
      setUploading(false)
      return
    }

    setPhotos((previous) =>
      previous.filter(
        (existingPhoto) =>
          existingPhoto.id !== photo.id,
      ),
    )

    setUploading(false)
  }

  async function handleSubmitForm() {
    if (!profile || isReadOnly || busy) return

    const errors = validate()
    setFieldErrors(errors)

    if (errors.length > 0) return

    setSaving(true)
    setError(null)

    let currentSubmissionId = submissionId

    if (!currentSubmissionId) {
      const { data, error } = await supabase
        .from('submissions')
        .insert({
          user_id: profile.id,
          site_id: siteId,
          submission_date: submissionDate,
          ...checklist,
          notes,
          status: 'draft',
        })
        .select('id')
        .single()

      if (error || !data) {
        setError(
          error?.message ??
            'Could not create submission.',
        )
        setSaving(false)
        return
      }

      currentSubmissionId = data.id
      setSubmissionId(data.id)
    }

    const { error } = await supabase
      .from('submissions')
      .update({
        site_id: siteId,
        submission_date: submissionDate,
        ...checklist,
        notes,
        status: 'submitted',
      })
      .eq('id', currentSubmissionId)

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    navigate('/framer', {
      state: {
        successMessage: 'Safety form submitted successfully.',
      },
    })
  }

  async function handleDelete() {
    if (isReadOnly || busy) return

    if (!submissionId) {
      navigate('/framer')
      return
    }

    const confirmed = window.confirm(
      'Delete this draft? This cannot be undone.',
    )

    if (!confirmed) return

    setSaving(true)
    setError(null)

    if (photos.length > 0) {
      const { error: storageError } =
        await supabase.storage
          .from('submission-photos')
          .remove(
            photos.map(
              (photo) => photo.storage_path,
            ),
          )

      if (storageError) {
        setError(
          'Could not delete the draft photos.',
        )
        setSaving(false)
        return
      }
    }

    const { error } = await supabase
      .from('submissions')
      .delete()
      .eq('id', submissionId)

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    navigate('/framer')
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

  return (
    <>
      <Header />
      <div className="page-container">
        <h1>
          {isNew
            ? 'New safety form'
            : isReadOnly
              ? 'Submission'
              : 'Edit draft'}
        </h1>

        {isReadOnly && (
          <p className="readonly-banner">
            This submission is {status} and can no longer be edited.
          </p>
        )}

        {error && (
          <p className="error-text">
            {error}
          </p>
        )}

        {fieldErrors.length > 0 && (
          <ul className="error-list">
            {fieldErrors.map((message) => (
              <li key={message}>
                {message}
              </li>
            ))}
          </ul>
        )}

        <div className="field-group">
          <label htmlFor="site">
            Site
          </label>

          <select
            id="site"
            className="field-select"
            value={siteId}
            onChange={(event) =>
              setSiteId(event.target.value)
            }
            disabled={isReadOnly || busy}
          >
            <option value="">
              Select a site
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
          <label htmlFor="date">
            Date
          </label>

          <input
            id="date"
            type="date"
            className="field-input"
            value={submissionDate}
            onChange={(event) =>
              setSubmissionDate(event.target.value)
            }
            disabled={isReadOnly || busy}
          />
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
                checked={checklist[key]}
                disabled={isReadOnly || busy}
                onChange={(event) =>
                  setChecklist((previous) => ({
                    ...previous,
                    [key]: event.target.checked,
                  }))
                }
              />

              <span>
                {checklistLabels[key]}
              </span>
            </label>
          ))}
        </div>

        <div className="field-group">
          <label htmlFor="notes">
            Notes
          </label>

          <textarea
            id="notes"
            className="field-textarea"
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            disabled={isReadOnly || busy}
          />
        </div>

        <div className="field-group">
          <h2>Photos</h2>

          {!isReadOnly && (
            <>
              <input
                type="file"
                className="field-input"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handlePhotoSelect}
                disabled={busy}
              />

              <p className="helper-text">
                JPEG, PNG, or WebP. Maximum 5 MB per photo.
              </p>
            </>
          )}

          {uploading && (
            <p>
              Uploading...
            </p>
          )}

          {photoErrors.length > 0 && (
            <ul className="error-list">
              {photoErrors.map(
                (message, index) => (
                  <li
                    key={`${message}-${index}`}
                  >
                    {message}
                  </li>
                ),
              )}
            </ul>
          )}

          {photos.length === 0 && (
            <p>
              No photos attached.
            </p>
          )}

          <div className="photo-grid">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="photo-thumb"
              >
              {photo.url ? (
                <a href={photo.url} target="_blank" rel="noopener noreferrer">
                  <img src={photo.url} alt={photo.file_name} />
                </a>
              ) : (
                <div className="photo-placeholder" />
              )}

                {!isReadOnly && (
                  <button
                    type="button"
                    className="photo-remove-btn"
                    aria-label={`Remove ${photo.file_name}`}
                    onClick={() =>
                      handleRemovePhoto(photo)
                    }
                    disabled={busy}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {!isReadOnly && (
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              onClick={saveDraft}
              disabled={busy}
            >
              {saving
                ? 'Saving...'
                : 'Save draft'}
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmitForm}
              disabled={busy}
            >
              {saving
                ? 'Submitting...'
                : 'Submit'}
            </button>

            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={busy}
            >
              Delete draft
            </button>
          </div>
        )}

        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() =>
              navigate('/framer')
            }
            disabled={busy}
          >
            Back
          </button>
        </div>
      </div>
    </>
  )
}