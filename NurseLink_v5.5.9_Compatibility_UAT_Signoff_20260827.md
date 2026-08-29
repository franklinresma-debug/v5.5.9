# NurseLink v5.5.9 Compatibility Rollout — UAT Sign-off

Date: 2026-08-27  
Environment: Production (`app.amsertech.com`, `api.amsertech.com`)  
Test account: `lbsfrankresma@gmail.com`  
Application: `NLA-2026-000010`  
Membership: `13`  
Member number: `NL-2026-000013`

## Rollout decision

The recreated v5.5.9 installer was not applied as a wholesale downgrade because production contains substantially newer NurseLink functionality. The Membership Cycle Health capability was ported as a compatibility-safe cumulative update, then validated through a complete synthetic applicant-to-member lifecycle.

## Production changes

- Added Membership Cycle Health inspection and reconciliation endpoints.
- Added Cycle Health visibility to the Administrator application drawer.
- Corrected member-shell staff-link visibility on legacy member pages.
- Corrected duplicate membership-standing formatter names.
- Corrected date-only member-profile JSON serialization.
- Protected identity fields from silent browser autofill changes.
- Added an explicit, autofill-safe mobile-number display/edit path.
- Aligned Smart Registration approval with standard core portfolio initialization.
- Updated onboarding signals to recognize modern core portfolio/employment records.

## Lifecycle UAT results

| Check | Result |
|---|---|
| Account registration and email verification | Pass |
| Smart Registration document presence | Pass |
| Personal and professional information | Pass |
| Application submission | Pass |
| Administrator review transitions | Pass |
| Final membership approval | Pass |
| Member-number generation | Pass — `NL-2026-000013` |
| Member role and core identity activation | Pass |
| Onboarding orientation | Pass |
| Onboarding completion | Pass — completed at `2026-08-27 19:29:11` |
| Portfolio initialization | Pass — one summary, one employment record |
| Portfolio unlock | Pass |
| Jobs unlock | Pass |
| Mentoring unlock | Pass |
| Career Matching unlock | Pass |
| Digital Member ID | Pass |
| Public QR verification | Pass |
| Administrator access boundary | Pass |
| In-app notifications | Pass |
| Email notifications | Pass |

## Final Cycle Health

- Overall status: `healthy`
- History: healthy
- Member number: healthy
- Core activation: healthy
- Onboarding: healthy
- Smart Registration profile: present
- Registration evidence: present
- Warnings: none
- Reconciliation required: no

## Public verification result

The public verification page displays:

- approved NurseLink membership;
- active professional standing;
- member number `NL-2026-000013`;
- active member-service access; and
- the required disclaimer that NurseLink membership verification is not professional-license, PRC, government-ID, immigration, or employer-credential verification.

## Recovery and rollback

- Production baseline: `/home/nurselink-backup/production-baselines/NurseLink_Production_Baseline_20260827-064621/`
- Cycle Health API backup: `/home/nurselink-backup/cycle-health-v559-compat-20260827-034641`
- Administrator UI backup: `/home/nurselink-backup/admin-cycle-health-ui-20260827-040754`
- Member-shell navigation backup: `/home/nurselink-backup/member-shell-staff-links-20260827`
- Profile, standing, onboarding, and activation fixes: `/home/nurselink-backup/member-profile-standing-fix-20260827`
- Local recovery archive SHA-256: `DB5488AE7D728345E70C5D378B8A90B003DEB2248170869220877EC3ADB9A2BE`

## Sign-off status

PASS — The v5.5.9 Cycle Health capability is integrated without downgrading the newer production platform. The tested registration, review, approval, onboarding, identity, verification, and member-access lifecycle is healthy and operational.

## Remaining optional work

- A clearly synthetic `QA TEST` profile image was added to the QA member and verified in the member profile. Activation increased from 67% to 83%, onboarding remained completed, and the Digital Member ID no longer reports a missing photo.
- Membership `13` is retained as the permanent QA fixture unless an audited cleanup is explicitly requested.

Final server verification confirmed the stored photo at `profile-photos/01a04207-150b-719e-aa69-52db30aef18a/cf3f9aa1-07c0-498f-93b1-cf7282b26e98.jpg`, completed onboarding, healthy Cycle Health checks, no warnings, and no reconciliation requirement.

## Post-UAT recovery snapshot

- Final sanitized source/build baseline: `/home/nurselink-backup/production-baselines/NurseLink_Production_Baseline_20260827-120821/`
- Baseline archive size: `53,722,157` bytes
- Baseline SHA-256: `87575494C4CA72C8CBF3CD3C114E8CCD1719E20E3996BB247CF5BA6CD7889067`
- Protected database snapshot: `/home/nurselink-backup/database/nurselink-post-uat-20260827-120821.sql.gz`
- Database snapshot size: `118,604` bytes
- Database SHA-256: `DB180B2421E105A631F4C18748A57026DC9D6424CCA7F0B3B1CA552D879EC5B0`
- Archive and gzip integrity checks: passed
- Temporary backup scripts and credential file: removed

The source restoration script and recovery runbook were attached to the final baseline and recorded in `TOOLKIT_SHA256SUMS`. A non-mutating dry run completed successfully. It reported only the expected runtime-generated difference in `public/nurselink-profile-feed-v6451.json`; no production files were changed.

## Regression coverage added

- API lifecycle tests cover date-only serialization and idempotent core portfolio initialization.
- The API test file passes PHP syntax validation. Production omits PHPUnit development dependencies, so the suite must run in CI or another development environment with Composer development packages installed.
- Dependency-free frontend regression checks cover the standing-helper collision, correct standing formatter usage, date mapping, and the explicit mobile-number display/edit path.
- Frontend regression result: `PASS: 7 NurseLink member frontend regression checks`.
