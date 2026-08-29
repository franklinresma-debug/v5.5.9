<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require '/var/www/nurselink-api/vendor/autoload.php';
$app = require '/var/www/nurselink-api/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$rows = DB::table('nurselink_memberships as m')
    ->leftJoin('nurselink_smart_registration_profiles as p', 'p.user_id', '=', 'm.user_id')
    ->select([
        'm.id',
        'm.status',
        'm.created_at',
        DB::raw('CASE WHEN p.user_id IS NULL THEN 0 ELSE 1 END AS has_smart_profile'),
        DB::raw('(SELECT COUNT(*) FROM nurselink_smart_registration_documents d WHERE d.user_id = m.user_id AND d.is_current = 1) AS current_evidence_count'),
        DB::raw('(SELECT COUNT(*) FROM nurselink_membership_status_history h WHERE h.membership_id = m.id) AS history_count'),
        DB::raw('(SELECT COUNT(*) FROM nurselink_membership_onboarding o WHERE o.membership_id = m.id) AS onboarding_count'),
    ])
    ->orderBy('m.id')
    ->get();

foreach ($rows as $row) {
    printf(
        "id=%d status=%s created=%s smart_profile=%d evidence=%d history=%d onboarding=%d\n",
        $row->id,
        $row->status,
        $row->created_at,
        $row->has_smart_profile,
        $row->current_evidence_count,
        $row->history_count,
        $row->onboarding_count
    );
}
