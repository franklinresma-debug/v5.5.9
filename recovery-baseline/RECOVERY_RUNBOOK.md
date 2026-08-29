# NurseLink Production Recovery Runbook

Baseline: `NurseLink_Production_Baseline_20260827-064621.tar.gz`

SHA-256:

```text
DB5488AE7D728345E70C5D378B8A90B003DEB2248170869220877EC3ADB9A2BE
```

This is a sanitized source and built-assets baseline. It excludes `.env`, credentials, dependencies, caches, logs, database contents, and member-uploaded documents.

## Required protected materials

Keep these outside the downloadable baseline:

- API `.env` and other server secrets
- MariaDB backup
- Private membership evidence and uploaded documents
- TLS certificates and server configuration

The database backup created before Cycle Health deployment is stored on the VPS at:

```text
/home/nurselink-backup/cycle-health-v559-compat-20260827-034641/nurselink.sql.gz
```

## Verify the archive

```bash
sha256sum NurseLink_Production_Baseline_20260827-064621.tar.gz
```

The result must match the SHA-256 above.

## Preview restoration

Always start with dry-run mode:

```bash
chmod +x restore-nurselink-baseline.sh
./restore-nurselink-baseline.sh \
  --archive NurseLink_Production_Baseline_20260827-064621.tar.gz \
  --dry-run
```

Dry-run validates archive paths and lists proposed file changes without modifying production.

## Before applying

1. Confirm the target paths are correct.
2. Create a fresh database dump and source backup.
3. Confirm the secure API `.env` is available.
4. Confirm dependencies can be restored from `composer.lock` and `package-lock.json`.
5. Put the site into an approved maintenance window.

## Apply source restoration

```bash
sudo ./restore-nurselink-baseline.sh \
  --archive NurseLink_Production_Baseline_20260827-064621.tar.gz \
  --apply
```

The script overlays source and built assets. It deliberately preserves existing `.env`, `vendor`, `node_modules`, `storage`, caches, uploads, Git data, and NurseLink backup directories. It does not restore the database.

## Restore dependencies when needed

```bash
cd /var/www/nurselink-api
composer install --no-dev --prefer-dist --optimize-autoloader

cd /var/www/nurselink-web
npm ci
npm run build
```

Only run dependency installation when network access and the maintenance window have been approved.

## Database restoration

Database restoration is intentionally manual and separate because it overwrites live data. Before restoring, create another current dump and verify the selected backup. Restore only during an approved outage.

Example:

```bash
gzip -t /path/to/nurselink.sql.gz
gunzip -c /path/to/nurselink.sql.gz | mariadb --defaults-extra-file=/root/secure-db-client.cnf nurselink
```

Never place database credentials inside this baseline or command history.

## Post-restore validation

```bash
cd /var/www/nurselink-api
php artisan optimize:clear
php artisan migrate:status
php artisan route:list

node --check /var/www/nurselink-web/dist/admin/dashboard.js
curl -I https://app.amsertech.com/
curl -H 'Accept: application/json' \
  https://api.amsertech.com/api/nurselink/admin/membership-cycle-health/1
```

The unauthenticated Cycle Health request must return `401` or `403`.

Finally, run the complete membership lifecycle:

```text
Registration → verification → Smart Registration → submission → review
→ Needs Information → resubmission → approval → member number
→ activation → onboarding → Cycle Health
```

## Rollback

Restore the pre-recovery source backup and database dump created immediately before the recovery attempt. Do not use the older v5.5.9 recreated installer as a rollback baseline because production contains substantially newer functionality.
