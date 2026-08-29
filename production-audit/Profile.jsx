import {

useEffect,
  useState,
} from 'react'

import {
  createApplication,
  getApplication,
  getMember,
  updateApplicationProfile,
  updateMemberProfile,
} from '../lib/api'

import { useAuth } from '../context/AuthContext'

/* NURSELINK_PROFILE_DATE_ONLY_V6415 */
function nurseLinkDateOnly(value) {
  if (!value) return ''
  const text = String(value).trim()
  const exact = text.match(/^(\d{4}-\d{2}-\d{2})/)
  if (exact) return exact[1]

  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return ''

  return [
    parsed.getUTCFullYear(),
    String(parsed.getUTCMonth() + 1).padStart(2, '0'),
    String(parsed.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function normalizeProfileDateFields(profile = {}) {
  return {
    ...profile,
    date_of_birth: nurseLinkDateOnly(profile.date_of_birth),
  }
}


const emptyForm = {
  first_name: '',
  middle_name: '',
  last_name: '',
  suffix: '',
  date_of_birth: '',
  nationality: 'Filipino',
  mobile_phone: '',
  city: '',
  region: '',
  country: 'Philippines',
  professional_title: 'Registered Nurse',
  current_position: '',
  current_employer: '',
  years_experience: '',
}

export default function Profile() {
  const { refreshUser } = useAuth()

  const [
    application,
    setApplication,
  ] = useState(null)

  const [member, setMember] =
    useState(null)

  const [form, setForm] =
    useState(emptyForm)

  const [identityFieldEditing, setIdentityFieldEditing] =
    useState({})

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [message, setMessage] =
    useState('')

  const [error, setError] =
    useState('')

  useEffect(() => {
    async function load() {
      try {
        let currentMember = null

        try {
          currentMember = await getMember()
        } catch (memberError) {
          if (![403, 404].includes(memberError?.status)) {
            throw memberError
          }
        }

        if (currentMember) {
          setMember(currentMember)
          if (currentMember.profile) {
            setForm({
              ...emptyForm,
              ...currentMember.profile,
              years_experience:
                currentMember.profile.years_experience ?? '',
            })
          }
          return
        }

        let app = await getApplication()

        if (!app) {
          app = await createApplication()
        }

        setApplication(app)

        if (app?.profile_data) {
          setForm({
            ...emptyForm,
            ...normalizeProfileDateFields(app.profile_data),

            years_experience:
              app.profile_data
                .years_experience ?? '',
          })
        }
      } catch (err) {
        setError(
          err?.data?.message ||
            err?.message ||
            'Unable to load your application.'
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  function updateField(event) {
    const {
      name,
      value,
    } = event.target
    const field =
      event.target.dataset.profileField || name

    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function beginIdentityFieldEdit(field) {
    setIdentityFieldEditing((current) => ({
      ...current,
      [field]: true,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    setSaving(true)
    setMessage('')
    setError('')

    try {
      const payload = {
        ...form,

        years_experience:
          form.years_experience === ''
            ? null
            : Number(
                form.years_experience
              ),

        progress_percent: 60,
      }

      if (member) {
        const updatedMember = await updateMemberProfile(payload)
        setMember(updatedMember)
      } else {
        if (!application?.id) {
          throw new Error('Unable to resolve your membership application.')
        }

        const updated = await updateApplicationProfile(
          application.id,
          payload
        )
        setApplication(updated)
      }

      await refreshUser()

      setMessage(
        'Your NurseLink profile has been saved successfully.'
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
            'Unable to save your profile.'
        )
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        Loading profile...
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            Membership Application
          </div>

          <h1>My Profile</h1>

          <p>
            {member
              ? 'Keep your NurseLink member profile current.'
              : 'Complete your personal and professional information for your NurseLink application.'}
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

      <form
        className="panel profile-form"
        onSubmit={handleSubmit}
        autoComplete="off"
      >
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

        <h2>Personal Information</h2>

        <div className="profile-grid four">
          <label>
            First Name *

            <input
              name="first_name"
              value={
                form.first_name
              }
              onChange={updateField}
              required
            />
          </label>

          <label>
            Middle Name

            <input
              name="middle_name"
              value={
                form.middle_name
              }
              onChange={updateField}
            />
          </label>

          <label>
            Last Name *

            <input
              name="last_name"
              value={
                form.last_name
              }
              onChange={updateField}
              required
            />
          </label>

          <label>
            Suffix

            <input
              name="suffix"
              value={form.suffix}
              onChange={updateField}
              placeholder="Jr., Sr., III"
            />
          </label>
        </div>

        <div className="profile-grid three">
          <label>
            Date of Birth

            <input
              type="date"
              name="nurselink_member_birth_date"
              data-profile-field="date_of_birth"
              readOnly={!identityFieldEditing.date_of_birth}
              onFocus={() => beginIdentityFieldEdit('date_of_birth')}
              autoComplete="off"
              data-form-type="other"
              value={nurseLinkDateOnly(form.date_of_birth)}
              onChange={updateField}
            />
          </label>

          <label>
            Nationality

            <input
              name="nationality"
              value={
                form.nationality
              }
              onChange={updateField}
            />
          </label>

          <label>
            Mobile Number

            {identityFieldEditing.mobile_phone ? (
              <input
                name="nurselink_member_mobile_phone"
                data-profile-field="mobile_phone"
                autoComplete="one-time-code"
                data-form-type="other"
                value={form.mobile_phone}
                onChange={updateField}
              />
            ) : (
              <span className="profile-readonly-value">
                <strong>{form.mobile_phone || 'Not provided'}</strong>
                <button
                  type="button"
                  onClick={() => beginIdentityFieldEdit('mobile_phone')}
                >
                  Change
                </button>
              </span>
            )}
          </label>
        </div>

        <h2>Current Address</h2>

        <div className="profile-grid three">
          <label>
            City

            <input
              name="city"
              value={form.city}
              onChange={updateField}
            />
          </label>

          <label>
            Region / Province

            <input
              name="region"
              value={form.region}
              onChange={updateField}
            />
          </label>

          <label>
            Country

            <input
              name="country"
              value={form.country}
              onChange={updateField}
            />
          </label>
        </div>

        <h2>
          Professional Information
        </h2>

        <div className="profile-grid two">
          <label>
            Professional Title

            <input
              name="professional_title"
              value={
                form
                  .professional_title
              }
              onChange={updateField}
            />
          </label>

          <label>
            Years of Experience

            <input
              type="number"
              min="0"
              max="70"
              name="years_experience"
              value={
                form
                  .years_experience
              }
              onChange={updateField}
            />
          </label>

          <label>
            Current Position

            <input
              name="current_position"
              value={
                form
                  .current_position
              }
              onChange={updateField}
            />
          </label>

          <label>
            Current Employer

            <input
              name="current_employer"
              value={
                form
                  .current_employer
              }
              onChange={updateField}
            />
          </label>
        </div>

        <div className="profile-actions">
          <button
            className="primary-button"
            type="submit"
            disabled={saving}
          >
            {saving
              ? 'Saving...'
              : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  )
}
