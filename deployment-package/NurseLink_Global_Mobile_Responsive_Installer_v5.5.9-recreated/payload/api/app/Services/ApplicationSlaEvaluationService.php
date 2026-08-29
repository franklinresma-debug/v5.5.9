<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ApplicationSlaEvaluationService
{
    private const PENDING_STATUSES = [
        'submitted',
        'under_review',
        'needs_information',
        'ready_for_approval',
    ];

    public function evaluate(): array
    {
        abort_unless(
            Schema::hasTable('nurselink_application_sla_policy')
            && Schema::hasTable('nurselink_application_sla_alerts'),
            503,
            'Application SLA evaluation is not available until the v5.6 migrations are complete.'
        );

        $policy = DB::table('nurselink_application_sla_policy')
            ->orderByDesc('id')
            ->first();

        abort_unless($policy, 503, 'Application SLA policy is unavailable.');

        if (! (bool) $policy->enabled) {
            $resolved = DB::table('nurselink_application_sla_alerts')
                ->whereNull('resolved_at')
                ->update(['resolved_at' => now(), 'updated_at' => now()]);

            return $this->summary((int) $policy->version, 0, 0, 0, $resolved);
        }

        $timezone = (string) $policy->timezone;
        $businessDays = json_decode((string) $policy->business_days, true);
        $businessDays = is_array($businessDays)
            ? array_values(array_unique(array_map('intval', $businessDays)))
            : [1, 2, 3, 4, 5];
        $now = Carbon::now($timezone);
        $rows = DB::table('nurselink_memberships')
            ->whereIn('status', self::PENDING_STATUSES)
            ->orderBy('id')
            ->get();

        $warning = 0;
        $breached = 0;
        $created = 0;
        $activeMembershipIds = [];

        foreach ($rows as $membership) {
            $activeMembershipIds[] = (int) $membership->id;
            $source = $membership->review_started_at
                ?? $membership->created_at
                ?? $membership->updated_at;

            if (! $source) {
                continue;
            }

            $dueAt = ! empty($membership->review_due_at)
                ? Carbon::parse($membership->review_due_at)->setTimezone($timezone)
                : $this->addPolicyHours(
                    Carbon::parse($source)->setTimezone($timezone),
                    (int) $policy->target_hours,
                    $businessDays
                );

            $state = null;
            if ($now->greaterThanOrEqualTo($dueAt)) {
                $state = 'breached';
                $breached++;
            } elseif ($now->greaterThanOrEqualTo((clone $dueAt)->subHours((int) $policy->warning_hours))) {
                $state = 'warning';
                $warning++;
            }

            if (! $state) {
                $this->resolveMembershipAlerts((int) $membership->id);
                continue;
            }

            if ($state === 'breached') {
                DB::table('nurselink_application_sla_alerts')
                    ->where('membership_id', $membership->id)
                    ->where('alert_state', 'warning')
                    ->whereNull('resolved_at')
                    ->update(['resolved_at' => now(), 'updated_at' => now()]);
            }

            $inserted = DB::table('nurselink_application_sla_alerts')->insertOrIgnore([
                'membership_id' => $membership->id,
                'policy_version' => $policy->version,
                'alert_state' => $state,
                'due_at' => $dueAt->copy()->utc(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ($inserted === 1) {
                $created++;
            }

            $this->notifyAssignedReviewer($membership, $state, (int) $policy->version);
        }

        $resolveQuery = DB::table('nurselink_application_sla_alerts')->whereNull('resolved_at');
        if ($activeMembershipIds) {
            $resolveQuery->whereNotIn('membership_id', $activeMembershipIds);
        }
        $resolved = $resolveQuery->update(['resolved_at' => now(), 'updated_at' => now()]);

        return $this->summary((int) $policy->version, $warning, $breached, $created, $resolved);
    }

    private function addPolicyHours(Carbon $start, int $hours, array $businessDays): Carbon
    {
        $cursor = $start->copy();
        $remaining = max(1, $hours);

        while ($remaining > 0) {
            $cursor->addHour();
            if (in_array($cursor->dayOfWeekIso, $businessDays, true)) {
                $remaining--;
            }
        }

        return $cursor;
    }

    private function resolveMembershipAlerts(int $membershipId): void
    {
        DB::table('nurselink_application_sla_alerts')
            ->where('membership_id', $membershipId)
            ->whereNull('resolved_at')
            ->update(['resolved_at' => now(), 'updated_at' => now()]);
    }

    private function notifyAssignedReviewer(object $membership, string $state, int $policyVersion): void
    {
        $userId = (string) ($membership->assigned_reviewer_user_id ?? '');
        if ($userId === '' || ! Schema::hasTable('nurselink_notifications')) {
            return;
        }

        DB::transaction(function () use ($membership, $state, $policyVersion, $userId): void {
            $alert = DB::table('nurselink_application_sla_alerts')
                ->where('membership_id', $membership->id)
                ->where('policy_version', $policyVersion)
                ->where('alert_state', $state)
                ->lockForUpdate()
                ->first();

            if (! $alert || $alert->notified_at) {
                return;
            }

            DB::table('nurselink_notifications')->insert([
                'user_id' => $userId,
                'type' => "membership.review.sla.{$state}",
                'severity' => $state === 'breached' ? 'warning' : 'info',
                'title' => $state === 'breached' ? 'Membership review SLA breached' : 'Membership review SLA warning',
                'message' => 'An assigned membership review requires attention. Open the Applications queue for details.',
                'action_url' => '/admin/#applications',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('nurselink_application_sla_alerts')
                ->where('id', $alert->id)
                ->update([
                    'notified_user_id' => $userId,
                    'notified_at' => now(),
                    'updated_at' => now(),
                ]);
        });
    }

    private function summary(int $version, int $warning, int $breached, int $created, int $resolved): array
    {
        return [
            'policy_version' => $version,
            'warning' => $warning,
            'breached' => $breached,
            'alerts_created' => $created,
            'alerts_resolved' => $resolved,
            'evaluated_at' => now()->toIso8601String(),
        ];
    }
}
