import {
  useEffect,
  useState,
} from 'react'

import {
  createApplication,
  getApplication,
  getSmartRegistration,
  uploadApplicationDocument,
} from '../lib/api'

export default function SmartRegistration() {
  const [
    application,
    setApplication,
  ] = useState(null)

  const [
    overview,
    setOverview,
  ] = useState(null)

  const [file, setFile] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  const [uploading, setUploading] =
    useState(false)

  const [message, setMessage] =
    useState('')

  const [error, setError] =
    useState('')

  async function loadData() {
    try {
      let app =
        await getApplication()

      if (!app) {
        app =
          await createApplication()
      }

      setApplication(app)

      try {
        const smart =
          await getSmartRegistration()

        setOverview(
          smart.application
        )
      } catch {
        setOverview(null)
      }
    } catch (err) {
      setError(
        err?.data?.message ||
          err?.message ||
          'Unable to load Smart Registration.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial data loading is the external API synchronization for this page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [])

  async function handleUpload(event) {
    event.preventDefault()

    if (!file || !application) {
      return
    }

    setUploading(true)
    setMessage('')
    setError('')

    try {
      await uploadApplicationDocument(
        file
      )

      await loadData()

      setFile(null)

      event.target.reset()

      setMessage(
        'Document uploaded successfully. Review the extracted fields and complete anything NurseLink could not detect.'
      )
    } catch (err) {
      const validationErrors =
        err?.data?.errors

      if (validationErrors) {
        const first =
          Object.values(
            validationErrors
          )[0]

        setError(
          Array.isArray(first)
            ? first[0]
            : first
        )
      } else {
        setError(
          err?.data?.message ||
            err?.message ||
            'Unable to upload the document.'
        )
      }
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        Loading Smart Registration...
      </div>
    )
  }

  const documents =
    overview?.documents || []

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            Smart Registration
          </div>

          <h1>
            Upload Your Documents
          </h1>

          <p>
            Add your CV and professional
            documents to accelerate your
            NurseLink application.
          </p>
        </div>

        {application && (
          <span className="badge">
            {
              application
                .application_no
            }
          </span>
        )}
      </div>

      <div className="content-grid">
        <form
          className="panel upload-panel"
          onSubmit={handleUpload}
        >
          <h2>Upload Document</h2>

          <p>
            Accepted formats: PDF,
            JPG, JPEG, PNG and DOCX.
            Maximum file size: 15 MB.
          </p>

          {message && (
            <div className="form-success">
              {message}
            </div>
          )}

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <label>
            Select File

            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.docx"
              onChange={(event) =>
                setFile(
                  event.target.files?.[0] ||
                    null
                )
              }
              required
            />
          </label>

          {file && (
            <div className="selected-file">
              <strong>
                Selected:
              </strong>{' '}
              {file.name}
            </div>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={
              uploading || !file
            }
          >
            {uploading
              ? 'Uploading...'
              : 'Upload Document'}
          </button>
        </form>

        <div className="panel">
          <h2>
            How Smart Registration Works
          </h2>

          <div className="checklist smart-steps">
            <div>
              1. Upload your CV and
              credentials.
            </div>

            <div>
              2. NurseLink performs a
              security review.
            </div>

            <div>
              3. Eligible documents are
              processed for data
              extraction.
            </div>

            <div>
              4. You review and confirm
              extracted information.
            </div>

            <div>
              5. Missing application
              fields are highlighted.
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <h2>
            Uploaded Documents
          </h2>

          <span className="muted">
            {documents.length}{' '}
            document(s)
          </span>
        </div>

        {documents.length === 0 ? (
          <p>
            No documents have been
            uploaded yet.
          </p>
        ) : (
          <div className="document-list">
            {documents.map(
              (document) => (
                <div
                  className="document-row"
                  key={document.id}
                >
                  <div>
                    <strong>
                      {
                        document
                          .original_name ||
                        document.category ||
                        'Document'
                      }
                    </strong>

                    <small>
                      {
                        document
                          .category
                      }
                    </small>
                  </div>

                  <span className="document-status">
                    {
                      document
                        .malware_scan_status ||
                      document
                        .security_status ||
                      'Pending'
                    }
                  </span>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
