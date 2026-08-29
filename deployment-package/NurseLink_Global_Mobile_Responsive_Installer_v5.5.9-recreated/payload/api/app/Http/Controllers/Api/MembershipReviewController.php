<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MembershipReviewController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeReviewer($request);

        $rows = DB::table('nurselink_memberships')
            ->orderByRaw("CASE status
                WHEN 'submitted' THEN 1
                WHEN 'under_review' THEN 2
                WHEN 'needs_information' THEN 3
                WHEN 'ready_for_approval' THEN 4
                WHEN 'approved' THEN 5
                WHEN 'declined' THEN 6
                ELSE 7 END")
            ->orderByDesc('updated_at')
            ->limit(500)
            ->get();

        $members = $this->memberMap($rows->pluck('user_id')->all());

        return response()->json([
            'data' => $rows->map(function ($row) use ($members): array {
                return [
                    'id' => (int) $row->id,
                    'user_id' => (string) $row->user_id,
                    'member' => $members[(string) $row->user_id] ?? (string) $row->user_id,
                    'status' => $row->status,
                    'member_number' => $row->member_number,
                    'reviewer_notes' => $row->reviewer_notes,
                    'reviewed_by' => $row->reviewed_by,
                    'reviewed_at' => $row->reviewed_at,
                    'approved_at' => $row->approved_at,
                    'declined_at' => $row->declined_at,
                    'updated_at' => $row->updated_at,
                ];
            })->values(),
        ]);
    }

    public function review(Request $request, int $id): JsonResponse
    {
        $access = $this->authorizeReviewer($request);

        $data = $request->validate([
            'status' => ['required', 'string', Rule::in([
                'submitted',
                'under_review',
                'needs_information',
                'ready_for_approval',
                'approved',
                'declined',
            ])],
            'reviewer_notes' => ['nullable', 'string', 'max:6000'],
        ]);

        $before = DB::table('nurselink_memberships')
            ->where('id', $id)
            ->first();

        abort_unless($before, 404);

        if ($before->status === 'approved' && $data['status'] !== 'approved') {
            return response()->json([
                'message' => 'Approved membership cannot be downgraded through this workflow.',
            ], 422);
        }

        if ((string) $before->user_id === (string) $request->user()->getKey()) {
            return response()->json([
                'message' => 'Self-actions must use the Membership Command Center with explicit Super Administrator confirmation and audit logging.',
            ], 422);
        }

        $reviewerTransitions = [
            'submitted' => ['under_review', 'needs_information'],
            'under_review' => ['needs_information', 'ready_for_approval'],
            'needs_information' => ['under_review', 'ready_for_approval'],
            'ready_for_approval' => ['under_review', 'needs_information'],
        ];

        $adminTransitions = [
            'submitted' => ['under_review', 'needs_information'],
            'under_review' => ['needs_information', 'ready_for_approval', 'declined'],
            'needs_information' => ['under_review', 'ready_for_approval', 'declined'],
            'ready_for_approval' => ['under_review', 'needs_information', 'approved', 'declined'],
        ];

        $allowed = $access['role'] === 'admin'
            ? ($adminTransitions[$before->status] ?? [])
            : ($reviewerTransitions[$before->status] ?? []);

        if ($data['status'] !== $before->status && ! in_array($data['status'], $allowed, true)) {
            return response()->json([
                'message' => 'That membership transition is not allowed for the current status or reviewer role.',
                'allowed_actions' => $allowed,
            ], 422);
        }

        if (
            in_array($data['status'], ['approved', 'declined'], true)
            && $access['role'] !== 'admin'
        ) {
            abort(403, 'Administrator access is required for final membership decisions.');
        }

        if (
            in_array($data['status'], ['needs_information', 'declined'], true)
            && trim((string) ($data['reviewer_notes'] ?? '')) === ''
        ) {
            return response()->json([
                'message' => 'Reviewer notes are required when requesting information or declining membership.',
            ], 422);
        }

        $update = [
            'status' => $data['status'],
            'reviewer_notes' => $data['reviewer_notes'] ?? null,
            'reviewed_by' => (string) $request->user()->getKey(),
            'reviewed_at' => now(),
            'updated_at' => now(),
        ];

        if ($data['status'] === 'approved') {
            $memberNumber = $before->member_number ?: $this->generateMemberNumber($before);
            $verificationCode = $before->verification_code ?: Str::lower(Str::random(40));

            $update['member_number'] = $memberNumber;
            $update['verification_code'] = $verificationCode;
            $update['approved_at'] = $before->approved_at ?: now();
            $update['declined_at'] = null;
            $update['standing'] = 'active';
            $update['standing_reason'] = 'Initial membership approval';
            $update['standing_changed_by'] =
                (string) $request->user()->getKey();
            $update['standing_changed_at'] = now();
            $update['reactivated_at'] = $before->reactivated_at ?: now();

            $this->syncCoreMembership((string) $before->user_id, $memberNumber);
        } elseif ($data['status'] === 'declined') {
            $update['declined_at'] = now();
        }

        DB::table('nurselink_memberships')
            ->where('id', $id)
            ->update($update);

        $after = DB::table('nurselink_memberships')
            ->where('id', $id)
            ->first();

        $this->audit(
            $request,
            'membership.status_changed',
            'membership',
            (string) $id,
            $before,
            $after
        );

        $this->notifyMembershipStatus($after);

        return response()->json([
            'message' => 'Membership review saved.',
            'data' => [
                'id' => (int) $after->id,
                'status' => $after->status,
                'member_number' => $after->member_number,
                'reviewer_notes' => $after->reviewer_notes,
                'approved_at' => $after->approved_at,
            ],
        ]);
    }

    private function generateMemberNumber(object $membership): string
    {
        $year = now()->format('Y');

        return sprintf(
            'NL-%s-%06d',
            $year,
            (int) $membership->id
        );
    }

    private function syncCoreMembership(string $userId, string $memberNumber): void
    {
        $updates = [];

        if (Schema::hasColumn('users', 'member_number')) {
            $updates['member_number'] = $memberNumber;
        }

        if (Schema::hasColumn('users', 'is_member')) {
            $updates['is_member'] = true;
        }

        if (Schema::hasColumn('users', 'membership_approved_at')) {
            $updates['membership_approved_at'] = now();
        }

        if ($updates !== []) {
            DB::table('users')
                ->where('id', $userId)
                ->update($updates);
        }
    }

    private function notifyMembershipStatus(object $membership): void
    {
        $copy = [
            'submitted' => [
                'info',
                'Membership application received',
                'Your NurseLink membership application is in the review queue.',
                '/application-status',
            ],
            'under_review' => [
                'info',
                'Membership review started',
                'An authorized NurseLink reviewer is reviewing your membership application.',
                '/application-status',
            ],
            'needs_information' => [
                'warning',
                'Additional information is needed',
                'Your membership review needs additional information. Open your application status and review the reviewer notes.',
                '/application-status',
            ],
            'ready_for_approval' => [
                'info',
                'Membership is ready for final approval',
                'Your application has completed reviewer checks and is awaiting final administrator approval.',
                '/application-status',
            ],
            'approved' => [
                'success',
                'NurseLink membership approved',
                'Congratulations. Your NurseLink membership has been approved and your digital member identity is now available.',
                '/dashboard',
            ],
            'declined' => [
                'error',
                'Membership review completed',
                'Your NurseLink membership application was not approved. Review the decision notes in Application Status.',
                '/application-status',
            ],
        ];

        [$severity, $title, $message, $url] = $copy[$membership->status] ?? $copy['submitted'];

        DB::table('nurselink_notifications')->insert([
            'user_id' => $membership->user_id,
            'type' => 'membership.' . $membership->status,
            'severity' => $severity,
            'title' => $title,
            'message' => $message,
            'action_url' => $url,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function authorizeReviewer(Request $request): array
    {
        $user = $request->user();
        abort_unless($user, 401);

        $sessionUserId = (string) $request->session()->get(
            'nurselink_admin_elevated_user_id',
            ''
        );

        $elevatedAt = (int) $request->session()->get(
            'nurselink_admin_elevated_at',
            0
        );

        $expiresAt = (int) $request->session()->get(
            'nurselink_admin_expires_at',
            0
        );

        abort_unless(
            $sessionUserId !== ''
            && hash_equals($sessionUserId, (string) $user->getKey())
            && $elevatedAt > 0
            && $expiresAt >= time()
            && (time() - $elevatedAt) <= 28800,
            403,
            'A separate NurseLink administrator sign-in is required for membership review.'
        );

        $role = null;

        $explicit = DB::table('nurselink_reviewer_access')
            ->where('user_id', $user->getKey())
            ->where('active', true)
            ->first();

        if ($explicit) {
            $role = strtolower((string) $explicit->role);
        }

        $modelRole = strtolower((string) (
            $user->role
            ?? $user->user_role
            ?? $user->user_type
            ?? ''
        ));

        $modelAdmin = (bool) (
            $user->is_admin
            ?? $user->is_super_admin
            ?? false
        );

        if ($modelAdmin || in_array($modelRole, ['admin', 'administrator', 'super_admin'], true)) {
            $role = 'admin';
        }

        if (! in_array($role, ['reviewer', 'admin'], true)) {
            abort(403, 'Reviewer access is required.');
        }

        return ['role' => $role];
    }

    private function memberMap(array $ids): array
    {
        $ids = array_values(array_unique(array_filter(
            array_map(fn ($id) => (string) $id, $ids)
        )));

        if ($ids === []) return [];

        $columns = ['id'];

        foreach (['email', 'name', 'first_name', 'last_name'] as $column) {
            if (Schema::hasColumn('users', $column)) {
                $columns[] = $column;
            }
        }

        $rows = DB::table('users')
            ->whereIn('id', $ids)
            ->get($columns);

        $map = [];

        foreach ($rows as $row) {
            $name = trim((string) ($row->name ?? ''));

            if ($name === '') {
                $name = trim(
                    (string) ($row->first_name ?? '')
                    . ' '
                    . (string) ($row->last_name ?? '')
                );
            }

            $email = trim((string) ($row->email ?? ''));

            $parts = array_values(array_filter([$name, $email]));

            $map[(string) $row->id] = $parts !== []
                ? implode(' · ', $parts)
                : (string) $row->id;
        }

        return $map;
    }

    private function audit(
        Request $request,
        string $action,
        string $targetType,
        string $targetId,
        mixed $before,
        mixed $after
    ): void {
        DB::table('nurselink_review_audit')->insert([
            'reviewer_user_id' => (string) $request->user()->getKey(),
            'action' => $action,
            'target_type' => $targetType,
            'target_id' => $targetId,
            'before_state' => $before ? json_encode($before, JSON_UNESCAPED_UNICODE) : null,
            'after_state' => $after ? json_encode($after, JSON_UNESCAPED_UNICODE) : null,
            'created_at' => now(),
        ]);
    }
}
