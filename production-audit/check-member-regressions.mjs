import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const shellPath = path.join(root, 'src', 'nurselink-mobile.js')
const profilePath = path.join(root, 'src', 'pages', 'Profile.jsx')

const shell = fs.readFileSync(shellPath, 'utf8')
const profile = fs.readFileSync(profilePath, 'utf8')

function count(source, pattern) {
  return [...source.matchAll(pattern)].length
}

const checks = [
  [
    count(shell, /function\s+membershipStandingLabel\s*\(/g) === 1,
    'membershipStandingLabel must have exactly one declaration',
  ],
  [
    count(shell, /function\s+membershipRoleLabel\s*\(/g) === 1,
    'membershipRoleLabel must have exactly one declaration',
  ],
  [
    shell.includes('const standingLabel = membershipStandingLabel(standing)'),
    'digital member card must format the standing value with membershipStandingLabel',
  ],
  [
    profile.includes("date_of_birth: nurseLinkDateOnly(profile.date_of_birth)"),
    'profile must normalize date-only application values',
  ],
  [
    profile.includes("data-profile-field=\"date_of_birth\""),
    'date of birth must map to the API profile key',
  ],
  [
    profile.includes("form.mobile_phone || 'Not provided'"),
    'stored mobile number must render outside the browser autofill path',
  ],
  [
    profile.includes("beginIdentityFieldEdit('mobile_phone')"),
    'mobile number editing must require an explicit member action',
  ],
]

const failures = checks.filter(([passed]) => !passed).map(([, message]) => message)

if (failures.length) {
  console.error('NurseLink member regression checks failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`PASS: ${checks.length} NurseLink member frontend regression checks`)
