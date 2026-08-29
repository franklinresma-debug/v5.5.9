<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ApplicationSlaEvaluationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MembershipAdministrationController extends Controller
{
    private const ELEVATION_TTL_SECONDS = 28800;

    private const PENDING_STATUSES = [
        'submitted',
        'under_review',
        'needs_information',
        'ready_for_approval',
    ];

    public function overview(
        Request $request
    ): JsonResponse {
        $access = $this->requireElevatedSession(
            $request
        );

        $counts = [];
        foreach ([
            'submitted',
            'under_review',
            'needs_information',
            'ready_for_approval',
            'approved',
            'declined',
        ] as $status) {
            $counts[$status] = DB::table(
                'nurselink_memberships'
            )
                ->where(
                    'status',
                    $status
                )
                ->count();
        }

        $pending = DB::table(
            'nurselink_memberships'
        )
            ->whereIn(
                'status',
                self::PENDING_STATUSES
            );

        $overdue = Schema::hasColumn(
            'nurselink_memberships',
            'review_due_at'
        )
            ? (clone $pending)
                ->whereNotNull(
                    'review_due_at'
                )
                ->where(
                    'review_due_at',
                    '<',
                    now()
                )
                ->count()
            : 0;

        $unassigned = Schema::hasColumn(
            'nurselink_memberships',
            'assigned_reviewer_user_id'
        )
            ? (clone $pending)
                ->whereNull(
                    'assigned_reviewer_user_id'
                )
                ->count()
            : 0;

        $aging = [
            '0_2_days' => 0,
            '3_7_days' => 0,
            '8_14_days' => 0,
            '15_plus_days' => 0,
        ];

        $pendingRows = (clone $pending)
            ->get([
                'id',
                'created_at',
                'updated_at',
            ]);

        foreach ($pendingRows as $row) {
            $source = $row->created_at
                ?: $row->updated_at;

            if (! $source) {
                continue;
            }

            $days = now()
                ->diffInDays(
                    \Carbon\Carbon::parse(
                        $source
                    )
                );

            if ($days <= 2) {
                $aging['0_2_days']++;
            } elseif ($days <= 7) {
                $aging['3_7_days']++;
            } elseif ($days <= 14) {
                $aging['8_14_days']++;
            } else {
                $aging['15_plus_days']++;
            }
        }

        $standing = [
            'active' => 0,
            'suspended' => 0,
            'inactive' => 0,
        ];

        foreach (
            array_keys(
                $standing
            ) as $value
        ) {
            $standing[$value] = DB::table(
                'nurselink_memberships'
            )
                ->where(
                    'status',
                    'approved'
                )
                ->where(
                    'standing',
                    $value
                )
                ->count();
        }

        $staff = $this->staffRows(
            $request
        );

        return response()->json([
            'data' => [
                'counts' =>
                    $counts,
                'pending_total' =>
                    array_sum([
                        $counts['submitted'],
                        $counts['under_review'],
                        $counts['needs_information'],
                        $counts['ready_for_approval'],
                    ]),
                'overdue_reviews' =>
                    $overdue,
                'unassigned_reviews' =>
                    $unassigned,
                'aging' =>
                    $aging,
                'standing' =>
                    $standing,
                'staff' => [
                    'total_privileged' =>
                        count($staff),
                    'reviewers' =>
                        count(array_filter(
                            $staff,
                            fn (array $row): bool =>
                                $row['active']
                                && $row['role']
                                    === 'reviewer'
                        )),
                    'administrators' =>
                        count(array_filter(
                            $staff,
                            fn (array $row): bool =>
                                $row['active']
                                && $row['role']
                                    === 'admin'
                        )),
                    'super_administrators' =>
                        count(array_filter(
                            $staff,
                            fn (array $row): bool =>
                                $row['active']
                                && $row['role']
                                    === 'super_admin'
                        )),
                ],
                'permissions' => [
                    'role' =>
                        $access['role'],
                    'can_review' =>
                        $access['is_reviewer'],
                    'can_final_decide' =>
                        $access['is_admin'],
                    'can_assign_reviews' =>
                        $access['is_admin'],
                    'can_manage_roles' =>
                        $access['is_super_admin'],
                    'can_manage_standing' =>
                        $access['is_admin'],
                ],
                'governance' => [
                    'final_approval_requires_admin'
                        => true,
                    'role_assignment_requires_super_admin'
                        => true,
                    'last_super_admin_protected'
                        => true,
                    'separate_admin_sign_in_required'
                        => true,
                ],
            ],
        ]);
    }

    public function queue(
        Request $request
    ): JsonResponse {
        $access = $this->requireElevatedSession(
            $request
        );

        $data = $request->validate([
            'status' => [
                'nullable',
                Rule::in([
                    'submitted',
                    'under_review',
                    'needs_information',
                    'ready_for_approval',
                    'approved',
                    'declined',
                ]),
            ],
            'stage' => [
                'nullable',
                Rule::in([
                    'initial_intake',
                    'document_review',
                    'applicant_follow_up',
                    'admin_review',
                    'completed',
                    'closed',
                ]),
            ],
            'priority' => [
                'nullable',
                Rule::in([
                    'low',
                    'normal',
                    'high',
                    'urgent',
                ]),
            ],
            'assignment' => [
                'nullable',
                Rule::in([
                    'all',
                    'assigned',
                    'unassigned',
                    'mine',
                ]),
            ],
            'overdue' => [
                'nullable',
                'boolean',
            ],
            'search' => [
                'nullable',
                'string',
                'max:190',
            ],
            'organization' => [
                'nullable',
                'string',
                'max:190',
            ],
            'page' => [
                'nullable',
                'integer',
                'min:1',
            ],
            'per_page' => [
                'nullable',
                'integer',
                Rule::in([
                    10,
                    25,
                    50,
                ]),
            ],
        ]);

        $query = DB::table(
            'nurselink_memberships as m'
        );

        $stageStatus =
            match (
                (string) (
                    $data[
                        'stage'
                    ]
                    ?? ''
                )
            ) {
                'initial_intake' =>
                    'submitted',
                'document_review' =>
                    'under_review',
                'applicant_follow_up' =>
                    'needs_information',
                'admin_review' =>
                    'ready_for_approval',
                'completed' =>
                    'approved',
                'closed' =>
                    'declined',
                default =>
                    null,
            };

        if (
            ! empty(
                $data['status']
            )
        ) {
            $query->where(
                'm.status',
                $data['status']
            );
        } elseif (
            $stageStatus
        ) {
            $query->where(
                'm.status',
                $stageStatus
            );
        } else {
            $query->whereIn(
                'm.status',
                self::PENDING_STATUSES
            );
        }

        if (
            ! empty(
                $data['priority']
            )
            && Schema::hasColumn(
                'nurselink_memberships',
                'review_priority'
            )
        ) {
            $query->where(
                'm.review_priority',
                $data['priority']
            );
        }

        $assignment =
            $data['assignment']
            ?? 'all';

        if (
            Schema::hasColumn(
                'nurselink_memberships',
                'assigned_reviewer_user_id'
            )
        ) {
            if (
                $assignment
                === 'assigned'
            ) {
                $query->whereNotNull(
                    'm.assigned_reviewer_user_id'
                );
            } elseif (
                $assignment
                === 'unassigned'
            ) {
                $query->whereNull(
                    'm.assigned_reviewer_user_id'
                );
            } elseif (
                $assignment
                === 'mine'
            ) {
                $query->where(
                    'm.assigned_reviewer_user_id',
                    (string)
                        $request->user()->getKey()
                );
            }
        }

        if (
            ($data['overdue'] ?? false)
            && Schema::hasColumn(
                'nurselink_memberships',
                'review_due_at'
            )
        ) {
            $query
                ->whereNotNull(
                    'm.review_due_at'
                )
                ->where(
                    'm.review_due_at',
                    '<',
                    now()
                );
        }

        $rows = $query
            ->orderByRaw(
                "CASE COALESCE(m.review_priority, 'normal')
                    WHEN 'urgent' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'normal' THEN 3
                    WHEN 'low' THEN 4
                    ELSE 5 END"
            )
            ->orderByRaw(
                "CASE m.status
                    WHEN 'ready_for_approval' THEN 1
                    WHEN 'submitted' THEN 2
                    WHEN 'under_review' THEN 3
                    WHEN 'needs_information' THEN 4
                    ELSE 5 END"
            )
            ->orderBy(
                'm.created_at'
            )
            ->orderBy(
                'm.id'
            )
            ->limit(750)
            ->get();

        $users = $this->userMap(
            $rows->pluck(
                'user_id'
            )->all()
        );

        $reviewerIds = $rows
            ->pluck(
                'assigned_reviewer_user_id'
            )
            ->filter()
            ->all();

        $reviewers = $this->userMap(
            $reviewerIds
        );

        $latestEmployment = [];

        if (
            Schema::hasTable(
                'nurselink_employment_histories'
            )
        ) {
            $employmentRows = DB::table(
                'nurselink_employment_histories'
            )
                ->whereIn(
                    'user_id',
                    $rows
                        ->pluck('user_id')
                        ->filter()
                        ->unique()
                        ->values()
                        ->all()
                )
                ->orderByDesc(
                    'is_current'
                )
                ->orderByDesc(
                    'start_date'
                )
                ->orderByDesc(
                    'id'
                )
                ->get([
                    'id',
                    'user_id',
                    'employer_name',
                    'city',
                    'country',
                    'position',
                    'is_current',
                    'start_date',
                ]);

            foreach (
                $employmentRows
                as $employment
            ) {
                $employmentUserId =
                    (string)
                        $employment
                            ->user_id;

                if (
                    isset(
                        $latestEmployment[
                            $employmentUserId
                        ]
                    )
                ) {
                    continue;
                }

                $latestEmployment[
                    $employmentUserId
                ] = [
                    'employer_name' =>
                        $employment
                            ->employer_name,
                    'city' =>
                        $employment
                            ->city,
                    'country' =>
                        $employment
                            ->country,
                    'position' =>
                        $employment
                            ->position,
                    'is_current' =>
                        (bool)
                            $employment
                                ->is_current,
                ];
            }
        }

        $search = strtolower(
            trim(
                (string)
                    ($data['search'] ?? '')
            )
        );

        $organization = strtolower(
            trim(
                (string)
                    ($data['organization'] ?? '')
            )
        );

        $presented = $rows->map(
            function ($row) use (
                $users,
                $reviewers,
                $latestEmployment,
                $request,
                $access
            ): array {
                $userId =
                    (string) $row->user_id;

                $user =
                    $users[$userId]
                    ?? [];

                $assignedId =
                    (string) (
                        $row
                            ->assigned_reviewer_user_id
                        ?? ''
                    );

                $assigned =
                    $assignedId !== ''
                        ? (
                            $reviewers[$assignedId]
                            ?? null
                        )
                        : null;

                $created =
                    $row->created_at
                    ?: $row->updated_at;

                $ageDays = $created
                    ? now()->diffInDays(
                        $created
                    )
                    : null;

                $overdue =
                    ! empty(
                        $row->review_due_at
                    )
                    && now()->greaterThan(
                        \Carbon\Carbon::parse(
                            $row->review_due_at
                        )
                    )
                    && in_array(
                        $row->status,
                        self::PENDING_STATUSES,
                        true
                    );

                return [
                    'membership_id' =>
                        (int) $row->id,
                    'user_id' =>
                        $userId,
                    'name' =>
                        $user['name']
                        ?? $userId,
                    'email' =>
                        $user['email']
                        ?? '',
                    'status' =>
                        $row->status,
                    'member_number' =>
                        $row->member_number,
                    'review_priority' =>
                        $row->review_priority
                        ?? 'normal',
                    'review_due_at' =>
                        $row->review_due_at
                        ?? null,
                    'review_started_at' =>
                        $row->review_started_at
                        ?? null,
                    'last_admin_action_at' =>
                        $row->last_admin_action_at
                        ?? null,
                    'updated_at' =>
                        $row->updated_at
                        ?? null,
                    'age_days' =>
                        $ageDays,
                    'overdue' =>
                        $overdue,
                    'assigned_reviewer_user_id' =>
                        $assignedId !== ''
                            ? $assignedId
                            : null,
                    'assigned_reviewer' =>
                        $assigned,
                    'is_assigned_to_me' =>
                        $assignedId !== ''
                        && hash_equals(
                            $assignedId,
                            (string)
                                $request
                                    ->user()
                                    ->getKey()
                        ),
                    'application_reference' =>
                        'APP-'
                        . (
                            $created
                                ? \Carbon\Carbon::parse(
                                    $created
                                )->format(
                                    'Y'
                                )
                                : now()->format(
                                    'Y'
                                )
                        )
                        . '-'
                        . str_pad(
                            (string)
                                $row->id,
                            6,
                            '0',
                            STR_PAD_LEFT
                        ),
                    'submitted_at' =>
                        $created,
                    'review_stage' =>
                        $this->reviewStage(
                            (string)
                                $row->status
                        ),
                    'latest_employment' =>
                        $latestEmployment[
                            $userId
                        ]
                        ?? null,
                    'can_assign' =>
                        $access['is_admin'],
                    'can_final_decide' =>
                        $access['is_admin'],
                ];
            }
        );

        if (
            $search !== ''
        ) {
            $presented = $presented
                ->filter(
                    function (
                        array $row
                    ) use ($search): bool {
                        $haystack =
                            strtolower(
                                ($row['name'] ?? '')
                                . ' '
                                . ($row['email'] ?? '')
                                . ' '
                                . ($row[
                                    'member_number'
                                ] ?? '')
                                . ' '
                                . ($row[
                                    'application_reference'
                                ] ?? '')
                                . ' '
                                . (
                                    $row[
                                        'latest_employment'
                                    ][
                                        'employer_name'
                                    ]
                                    ?? ''
                                )
                            );

                        return str_contains(
                            $haystack,
                            $search
                        );
                    }
                );
        }

        if (
            $organization !== ''
        ) {
            $presented = $presented
                ->filter(
                    function (
                        array $row
                    ) use ($organization): bool {
                        $employer = strtolower(
                            (string) (
                                $row[
                                    'latest_employment'
                                ][
                                    'employer_name'
                                ]
                                ?? ''
                            )
                        );

                        return $employer !== ''
                            && str_contains(
                                $employer,
                                $organization
                            );
                    }
                );
        }

        $paginationRequested =
            $request->has('page')
            || $request->has('per_page');

        $pagination = null;

        if ($paginationRequested) {
            $page = (int) (
                $data['page']
                ?? 1
            );
            $perPage = (int) (
                $data['per_page']
                ?? 25
            );
            $total = $presented->count();
            $lastPage = max(
                1,
                (int) ceil(
                    $total / $perPage
                )
            );
            $page = min(
                $page,
                $lastPage
            );

            $presented = $presented
                ->slice(
                    ($page - 1) * $perPage,
                    $perPage
                )
                ->values();

            $pagination = [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $lastPage,
                'from' => $total > 0
                    ? (($page - 1) * $perPage) + 1
                    : null,
                'to' => $total > 0
                    ? min(
                        $page * $perPage,
                        $total
                    )
                    : null,
            ];
        }

        return response()->json([
            'data' =>
                $presented->values(),
            'pagination' =>
                $pagination,
            'permissions' => [
                'role' =>
                    $access['role'],
                'can_assign_reviews' =>
                    $access['is_admin'],
                'can_final_decide' =>
                    $access['is_admin'],
            ],
        ]);
    }

    public function staff(
        Request $request
    ): JsonResponse {
        $access = $this->requireElevatedSession(
            $request
        );

        abort_unless(
            $access['is_admin'],
            403,
            'Administrator access is required to view privileged staff.'
        );

        return response()->json([
            'data' =>
                $this->staffRows(
                    $request
                ),
            'permissions' => [
                'can_manage_roles' =>
                    $access['is_super_admin'],
                'can_assign_reviews' =>
                    $access['is_admin'],
                'cannot_revoke_self' =>
                    true,
                'protect_last_super_admin' =>
                    true,
            ],
        ]);
    }

    public function savedViews(Request $request): JsonResponse
    {
        $this->requireElevatedSession($request);
        $this->requireSavedViewsTable();

        $rows = DB::table('nurselink_admin_saved_views')
            ->where('user_id', (string) $request->user()->getKey())
            ->where('view_type', 'membership_applications')
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->limit(12)
            ->get()
            ->map(fn (object $row): array => $this->presentSavedView($row))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function storeSavedView(Request $request): JsonResponse
    {
        $this->requireElevatedSession($request);
        $this->requireSavedViewsTable();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'filters' => ['required', 'array'],
            'filters.search' => ['nullable', 'string', 'max:190'],
            'filters.status' => ['nullable', Rule::in(array_merge(self::PENDING_STATUSES, ['approved', 'declined']))],
            'filters.stage' => ['nullable', Rule::in(['initial_intake', 'document_review', 'applicant_follow_up', 'admin_review', 'completed', 'closed'])],
            'filters.assignment' => ['nullable', Rule::in(['all', 'assigned', 'unassigned', 'mine'])],
            'filters.priority' => ['nullable', Rule::in(['low', 'normal', 'high', 'urgent'])],
            'filters.organization' => ['nullable', 'string', 'max:190'],
            'filters.overdue' => ['nullable', 'boolean'],
        ]);

        $userId = (string) $request->user()->getKey();
        $name = trim((string) $data['name']);
        abort_if($name === '', 422, 'Saved view name is required.');

        $existing = DB::table('nurselink_admin_saved_views')
            ->where('user_id', $userId)
            ->where('view_type', 'membership_applications')
            ->where('name', $name)
            ->first();

        $values = [
            'filters' => json_encode($data['filters'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'updated_at' => now(),
        ];

        if ($existing) {
            DB::table('nurselink_admin_saved_views')
                ->where('id', $existing->id)
                ->where('user_id', $userId)
                ->update($values);
            $id = (int) $existing->id;
        } else {
            $count = DB::table('nurselink_admin_saved_views')
                ->where('user_id', $userId)
                ->where('view_type', 'membership_applications')
                ->count();
            abort_if($count >= 12, 422, 'Delete a saved view before adding another.');

            $id = (int) DB::table('nurselink_admin_saved_views')->insertGetId([
                'user_id' => $userId,
                'view_type' => 'membership_applications',
                'name' => $name,
                'filters' => $values['filters'],
                'created_at' => now(),
                'updated_at' => $values['updated_at'],
            ]);
        }

        $row = DB::table('nurselink_admin_saved_views')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->first();

        return response()->json([
            'data' => $this->presentSavedView($row),
            'message' => 'Application view saved.',
        ], $existing ? 200 : 201);
    }

    public function deleteSavedView(Request $request, int $viewId): JsonResponse
    {
        $this->requireElevatedSession($request);
        $this->requireSavedViewsTable();

        $deleted = DB::table('nurselink_admin_saved_views')
            ->where('id', $viewId)
            ->where('user_id', (string) $request->user()->getKey())
            ->where('view_type', 'membership_applications')
            ->delete();

        abort_unless($deleted === 1, 404, 'Saved view not found.');

        return response()->json(['message' => 'Application view deleted.']);
    }

    public function slaPolicy(Request $request): JsonResponse
    {
        $access = $this->requireElevatedSession($request);
        abort_unless($access['is_admin'], 403, 'Administrator access is required to view SLA policy.');
        $this->requireSlaPolicyTable();

        return response()->json([
            'data' => $this->presentSlaPolicy(
                DB::table('nurselink_application_sla_policy')
                    ->orderByDesc('id')
                    ->first()
            ),
        ]);
    }

    public function updateSlaPolicy(Request $request): JsonResponse
    {
        $access = $this->requireElevatedSession($request);
        abort_unless($access['is_admin'], 403, 'Administrator access is required to update SLA policy.');
        $this->requireSlaPolicyTable();

        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'warning_hours' => ['required', 'integer', 'min:1', 'max:720'],
            'target_hours' => ['required', 'integer', 'min:2', 'max:2160'],
            'timezone' => [
                'required',
                'string',
                'max:64',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! in_array($value, timezone_identifiers_list(), true)) {
                        $fail('The SLA timezone must be a valid IANA timezone.');
                    }
                },
            ],
            'business_days' => ['required', 'array', 'min:1', 'max:7'],
            'business_days.*' => ['required', 'integer', 'between:1,7', 'distinct'],
            'version' => ['required', 'integer', 'min:1'],
        ]);

        abort_unless(
            (int) $data['warning_hours'] < (int) $data['target_hours'],
            422,
            'Warning hours must be less than target hours.'
        );

        $before = null;
        $after = null;

        DB::transaction(function () use ($request, $data, &$before, &$after): void {
            $row = DB::table('nurselink_application_sla_policy')
                ->lockForUpdate()
                ->orderByDesc('id')
                ->first();

            abort_unless($row, 503, 'Application SLA policy is unavailable.');
            abort_unless(
                (int) $row->version === (int) $data['version'],
                409,
                'The SLA policy changed in another session. Refresh and try again.'
            );

            $before = $this->presentSlaPolicy($row);
            $days = array_values(array_unique(array_map('intval', $data['business_days'])));
            sort($days);

            DB::table('nurselink_application_sla_policy')
                ->where('id', $row->id)
                ->update([
                    'version' => (int) $row->version + 1,
                    'enabled' => (bool) $data['enabled'],
                    'warning_hours' => (int) $data['warning_hours'],
                    'target_hours' => (int) $data['target_hours'],
                    'timezone' => (string) $data['timezone'],
                    'business_days' => json_encode($days),
                    'updated_by_user_id' => (string) $request->user()->getKey(),
                    'updated_at' => now(),
                ]);

            $after = $this->presentSlaPolicy(
                DB::table('nurselink_application_sla_policy')
                    ->where('id', $row->id)
                    ->first()
            );
        });

        $this->audit($request, 'application.sla_policy.updated', 'application_sla_policy', 'default', $before, $after);

        return response()->json([
            'data' => $after,
            'message' => 'Application SLA policy updated.',
        ]);
    }

    public function evaluateSla(
        Request $request,
        ApplicationSlaEvaluationService $service
    ): JsonResponse {
        $access = $this->requireElevatedSession($request);
        abort_unless($access['is_admin'], 403, 'Administrator access is required to evaluate SLA alerts.');

        $result = $service->evaluate();
        $this->audit(
            $request,
            'application.sla_evaluated',
            'application_sla_policy',
            (string) ($result['policy_version'] ?? 'default'),
            null,
            $result
        );

        return response()->json([
            'data' => $result,
            'message' => 'Application SLA evaluation completed.',
        ]);
    }

    public function slaAlerts(Request $request): JsonResponse
    {
        $access = $this->requireElevatedSession($request);
        abort_unless($access['is_admin'], 403, 'Administrator access is required to view SLA alerts.');
        abort_unless(Schema::hasTable('nurselink_application_sla_alerts'), 503, 'Application SLA alerts are unavailable.');

        $data = $request->validate([
            'state' => ['nullable', Rule::in(['warning', 'breached'])],
            'status' => ['nullable', Rule::in(['open', 'acknowledged', 'resolved'])],
            'limit' => ['nullable', 'integer', Rule::in([25, 50, 100])],
        ]);

        $query = DB::table('nurselink_application_sla_alerts as a')
            ->leftJoin('nurselink_memberships as m', 'm.id', '=', 'a.membership_id');

        if (! empty($data['state'])) {
            $query->where('a.alert_state', $data['state']);
        }

        match ($data['status'] ?? 'open') {
            'acknowledged' => $query->whereNotNull('a.acknowledged_at')->whereNull('a.resolved_at'),
            'resolved' => $query->whereNotNull('a.resolved_at'),
            default => $query->whereNull('a.resolved_at'),
        };

        $rows = $query
            ->orderByRaw("CASE a.alert_state WHEN 'breached' THEN 1 ELSE 2 END")
            ->orderBy('a.due_at')
            ->orderBy('a.id')
            ->limit((int) ($data['limit'] ?? 50))
            ->get([
                'a.id',
                'a.membership_id',
                'a.policy_version',
                'a.alert_state',
                'a.due_at',
                'a.notified_at',
                'a.acknowledged_at',
                'a.resolved_at',
                'a.created_at',
                'm.status as membership_status',
            ])
            ->map(fn (object $row): array => [
                'id' => (int) $row->id,
                'membership_id' => (int) $row->membership_id,
                'application_reference' => 'APP-' . str_pad((string) $row->membership_id, 6, '0', STR_PAD_LEFT),
                'policy_version' => (int) $row->policy_version,
                'alert_state' => (string) $row->alert_state,
                'due_at' => $row->due_at,
                'notified_at' => $row->notified_at,
                'acknowledged_at' => $row->acknowledged_at,
                'resolved_at' => $row->resolved_at,
                'created_at' => $row->created_at,
                'membership_status' => $row->membership_status,
            ])
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function acknowledgeSlaAlert(Request $request, int $alertId): JsonResponse
    {
        $access = $this->requireElevatedSession($request);
        abort_unless($access['is_admin'], 403, 'Administrator access is required to acknowledge SLA alerts.');
        abort_unless(Schema::hasTable('nurselink_application_sla_alerts'), 503, 'Application SLA alerts are unavailable.');

        $before = DB::table('nurselink_application_sla_alerts')->where('id', $alertId)->first();
        abort_unless($before, 404, 'SLA alert not found.');
        abort_if($before->resolved_at, 409, 'Resolved SLA alerts cannot be acknowledged.');

        DB::table('nurselink_application_sla_alerts')
            ->where('id', $alertId)
            ->whereNull('resolved_at')
            ->update([
                'acknowledged_at' => $before->acknowledged_at ?: now(),
                'acknowledged_by_user_id' => $before->acknowledged_by_user_id ?: (string) $request->user()->getKey(),
                'updated_at' => now(),
            ]);

        $after = DB::table('nurselink_application_sla_alerts')->where('id', $alertId)->first();
        $this->audit($request, 'application.sla_alert.acknowledged', 'application_sla_alert', (string) $alertId, $before, $after);

        return response()->json(['message' => 'SLA alert acknowledged.']);
    }

    public function bulkTriage(Request $request): JsonResponse
    {
        $access = $this->requireElevatedSession($request);
        abort_unless($access['is_admin'], 403, 'Administrator access is required for bulk triage.');

        $data = $request->validate([
            'mode' => ['required', Rule::in(['preview', 'apply'])],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.membership_id' => ['required', 'integer', 'distinct', 'min:1'],
            'items.*.expected_updated_at' => ['required', 'date'],
            'changes' => ['required', 'array'],
            'changes.priority' => ['sometimes', Rule::in(['low', 'normal', 'high', 'urgent'])],
            'changes.assigned_reviewer_user_id' => ['sometimes', 'nullable', 'string', 'max:191'],
            'changes.review_due_at' => ['sometimes', 'nullable', 'date'],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        $allowedChanges = array_intersect_key(
            $data['changes'],
            array_flip(['priority', 'assigned_reviewer_user_id', 'review_due_at'])
        );
        abort_if($allowedChanges === [], 422, 'Select at least one supported bulk triage change.');

        if (array_key_exists('assigned_reviewer_user_id', $allowedChanges)) {
            $reviewerId = trim((string) ($allowedChanges['assigned_reviewer_user_id'] ?? ''));
            abort_if(
                $reviewerId !== '' && ! $this->isActivePrivilegedReviewer($reviewerId),
                422,
                'The selected reviewer does not have active privileged review access.'
            );
            $allowedChanges['assigned_reviewer_user_id'] = $reviewerId !== '' ? $reviewerId : null;
        }

        $correlationId = (string) Str::uuid();
        $results = [];

        foreach ($data['items'] as $item) {
            $membershipId = (int) $item['membership_id'];
            $row = DB::table('nurselink_memberships')->where('id', $membershipId)->first();

            if (! $row) {
                $results[] = $this->bulkTriageFailure($membershipId, 'not_found', 'Membership application not found.');
                continue;
            }

            if (! in_array((string) $row->status, self::PENDING_STATUSES, true)) {
                $results[] = $this->bulkTriageFailure($membershipId, 'not_pending', 'Only pending applications can be bulk triaged.');
                continue;
            }

            $expected = \Carbon\Carbon::parse($item['expected_updated_at'])->utc()->format('Y-m-d H:i:s');
            $actual = \Carbon\Carbon::parse($row->updated_at)->utc()->format('Y-m-d H:i:s');
            if (! hash_equals($actual, $expected)) {
                $results[] = $this->bulkTriageFailure($membershipId, 'conflict', 'Application changed after selection. Refresh and preview again.');
                continue;
            }

            $updates = [];
            if (array_key_exists('priority', $allowedChanges)) {
                $updates['review_priority'] = $allowedChanges['priority'];
            }
            if (array_key_exists('assigned_reviewer_user_id', $allowedChanges)) {
                $updates['assigned_reviewer_user_id'] = $allowedChanges['assigned_reviewer_user_id'];
            }
            if (array_key_exists('review_due_at', $allowedChanges)) {
                $updates['review_due_at'] = $allowedChanges['review_due_at']
                    ? \Carbon\Carbon::parse($allowedChanges['review_due_at'])->utc()
                    : null;
            }

            $before = [
                'review_priority' => $row->review_priority ?? 'normal',
                'assigned_reviewer_user_id' => $row->assigned_reviewer_user_id ?? null,
                'review_due_at' => $row->review_due_at ?? null,
                'updated_at' => $row->updated_at,
            ];

            if ($data['mode'] === 'preview') {
                $results[] = [
                    'membership_id' => $membershipId,
                    'status' => 'ready',
                    'before' => $before,
                    'proposed' => array_merge($before, $updates),
                ];
                continue;
            }

            $updates['last_admin_action_at'] = now();
            $updates['updated_at'] = now();
            $changed = DB::table('nurselink_memberships')
                ->where('id', $membershipId)
                ->where('updated_at', $row->updated_at)
                ->whereIn('status', self::PENDING_STATUSES)
                ->update($updates);

            if ($changed !== 1) {
                $results[] = $this->bulkTriageFailure($membershipId, 'conflict', 'Application changed during bulk triage.');
                continue;
            }

            $after = DB::table('nurselink_memberships')->where('id', $membershipId)->first();
            $afterState = [
                'review_priority' => $after->review_priority ?? 'normal',
                'assigned_reviewer_user_id' => $after->assigned_reviewer_user_id ?? null,
                'review_due_at' => $after->review_due_at ?? null,
                'updated_at' => $after->updated_at,
                'correlation_id' => $correlationId,
            ];
            $this->audit(
                $request,
                'membership.bulk_triage.updated',
                'nurselink_membership',
                (string) $membershipId,
                array_merge($before, ['correlation_id' => $correlationId, 'reason' => $data['reason']]),
                $afterState
            );
            $results[] = ['membership_id' => $membershipId, 'status' => 'updated'];
        }

        $successful = count(array_filter($results, fn (array $row): bool => in_array($row['status'], ['ready', 'updated'], true)));

        return response()->json([
            'data' => [
                'mode' => $data['mode'],
                'correlation_id' => $correlationId,
                'requested' => count($data['items']),
                'successful' => $successful,
                'failed' => count($results) - $successful,
                'results' => $results,
            ],
            'message' => $data['mode'] === 'preview' ? 'Bulk triage preview completed.' : 'Bulk triage completed.',
        ]);
    }

    public function assignReview(
        Request $request,
        int $membershipId
    ): JsonResponse {
        $access = $this->requireElevatedSession(
            $request
        );

        abort_unless(
            $access['is_admin'],
            403,
            'Administrator access is required to assign membership reviews.'
        );

        $data = $request->validate([
            'reviewer_user_id' => [
                'nullable',
                'string',
                'max:191',
            ],
            'priority' => [
                'required',
                Rule::in([
                    'low',
                    'normal',
                    'high',
                    'urgent',
                ]),
            ],
            'review_due_at' => [
                'nullable',
                'date',
            ],
        ]);

        $before = DB::table(
            'nurselink_memberships'
        )
            ->where(
                'id',
                $membershipId
            )
            ->first();

        abort_unless(
            $before,
            404
        );

        abort_unless(
            in_array(
                $before->status,
                self::PENDING_STATUSES,
                true
            ),
            422,
            'Only pending membership applications can be assigned for review.'
        );

        $reviewerId =
            trim(
                (string)
                    ($data[
                        'reviewer_user_id'
                    ] ?? '')
            );

        if (
            $reviewerId !== ''
        ) {
            abort_unless(
                $this->isActivePrivilegedReviewer(
                    $reviewerId
                ),
                422,
                'Assigned reviewer must have active Reviewer, Administrator or Super Administrator access.'
            );
        }

        $updates = [
            'assigned_reviewer_user_id' =>
                $reviewerId !== ''
                    ? $reviewerId
                    : null,
            'review_priority' =>
                $data['priority'],
            'review_due_at' =>
                $data['review_due_at']
                ?? null,
            'last_admin_action_at' =>
                now(),
            'updated_at' =>
                now(),
        ];

        DB::table(
            'nurselink_memberships'
        )
            ->where(
                'id',
                $membershipId
            )
            ->update(
                $updates
            );

        $after = DB::table(
            'nurselink_memberships'
        )
            ->where(
                'id',
                $membershipId
            )
            ->first();

        $this->audit(
            $request,
            'membership.review_assignment_changed',
            'membership',
            (string) $membershipId,
            $before,
            $after
        );

        if (
            $reviewerId !== ''
        ) {
            $this->notifyAssignedReviewer(
                $reviewerId,
                $after
            );
        }

        return response()->json([
            'message' =>
                $reviewerId !== ''
                    ? 'Membership review assignment saved.'
                    : 'Membership review assignment cleared.',
            'data' => [
                'membership_id' =>
                    (int) $membershipId,
                'assigned_reviewer_user_id' =>
                    $reviewerId !== ''
                        ? $reviewerId
                        : null,
                'review_priority' =>
                    $after->review_priority
                    ?? 'normal',
                'review_due_at' =>
                    $after->review_due_at
                    ?? null,
            ],
        ]);
    }

    public function export(
        Request $request
    ) {
        $access = $this->requireElevatedSession(
            $request
        );

        abort_unless(
            $access['is_admin'],
            403,
            'Administrator access is required to export membership applications.'
        );

        $queueResponse =
            $this->queue(
                $request
            );

        $payload =
            $queueResponse
                ->getData(
                    true
                );

        $rows =
            $payload[
                'data'
            ]
            ?? [];

        $filters =
            $request->only([
                'status',
                'stage',
                'priority',
                'assignment',
                'overdue',
                'search',
                'organization',
            ]);

        $this->audit(
            $request,
            'membership.application_queue_exported',
            'membership_export',
            now()->format(
                'YmdHis'
            ),
            null,
            [
                'row_count' =>
                    count(
                        $rows
                    ),
                'filters' =>
                    $filters,
            ]
        );

        $filename =
            'nurselink-membership-applications-'
            . now()->format(
                'Ymd-His'
            )
            . '.csv';

        return response()->streamDownload(
            function () use (
                $rows
            ): void {
                $handle =
                    fopen(
                        'php://output',
                        'w'
                    );

                if (
                    $handle === false
                ) {
                    return;
                }

                fputcsv(
                    $handle,
                    [
                        'Application ID',
                        'Applicant',
                        'Email',
                        'Organization',
                        'Submitted',
                        'Status',
                        'Review Stage',
                        'Priority',
                        'Assigned Reviewer',
                        'Review Due',
                        'Age Days',
                    ]
                );

                foreach (
                    $rows
                    as $row
                ) {
                    $employment =
                        $row[
                            'latest_employment'
                        ]
                        ?? [];

                    $reviewer =
                        $row[
                            'assigned_reviewer'
                        ]
                        ?? [];

                    $stage =
                        $row[
                            'review_stage'
                        ]
                        ?? [];

                    fputcsv(
                        $handle,
                        [
                            $this->csvCell(
                                $row[
                                    'application_reference'
                                ]
                                ?? ''
                            ),
                            $this->csvCell(
                                $row[
                                    'name'
                                ]
                                ?? ''
                            ),
                            $this->csvCell(
                                $row[
                                    'email'
                                ]
                                ?? ''
                            ),
                            $this->csvCell(
                                $employment[
                                    'employer_name'
                                ]
                                ?? ''
                            ),
                            $this->csvCell(
                                $row[
                                    'submitted_at'
                                ]
                                ?? ''
                            ),
                            $this->csvCell(
                                $row[
                                    'status'
                                ]
                                ?? ''
                            ),
                            $this->csvCell(
                                $stage[
                                    'label'
                                ]
                                ?? ''
                            ),
                            $this->csvCell(
                                $row[
                                    'review_priority'
                                ]
                                ?? 'normal'
                            ),
                            $this->csvCell(
                                $reviewer[
                                    'name'
                                ]
                                ?? ''
                            ),
                            $this->csvCell(
                                $row[
                                    'review_due_at'
                                ]
                                ?? ''
                            ),
                            (int) (
                                $row[
                                    'age_days'
                                ]
                                ?? 0
                            ),
                        ]
                    );
                }

                fclose(
                    $handle
                );
            },
            $filename,
            [
                'Content-Type' =>
                    'text/csv; charset=UTF-8',
                'Cache-Control' =>
                    'no-store, private',
                'X-Content-Type-Options' =>
                    'nosniff',
            ]
        );
    }

    public function activity(
        Request $request
    ): JsonResponse {
        $access = $this->requireElevatedSession(
            $request
        );

        abort_unless(
            $access['is_admin'],
            403,
            'Administrator access is required to view administrative activity.'
        );

        if (
            ! Schema::hasTable(
                'nurselink_review_audit'
            )
        ) {
            return response()->json([
                'data' => [],
            ]);
        }

        $rows = DB::table(
            'nurselink_review_audit'
        )
            ->whereIn(
                'target_type',
                [
                    'membership',
                    'staff_access',
                ]
            )
            ->orderByDesc(
                'id'
            )
            ->limit(150)
            ->get();

        $reviewers = $this->userMap(
            $rows
                ->pluck(
                    'reviewer_user_id'
                )
                ->all()
        );

        return response()->json([
            'data' =>
                $rows->map(
                    function (
                        $row
                    ) use (
                        $reviewers
                    ): array {
                        $reviewer =
                            $reviewers[
                                (string)
                                    $row
                                        ->reviewer_user_id
                            ] ?? null;

                        return [
                            'id' =>
                                (int) $row->id,
                            'action' =>
                                $row->action,
                            'target_type' =>
                                $row->target_type,
                            'target_id' =>
                                (string)
                                    $row->target_id,
                            'reviewer_user_id' =>
                                (string)
                                    $row
                                        ->reviewer_user_id,
                            'reviewer_name' =>
                                $reviewer['name']
                                ?? null,
                            'reviewer_email' =>
                                $reviewer['email']
                                ?? null,
                            'created_at' =>
                                $row->created_at,
                        ];
                    }
                )->values(),
        ]);
    }

    private function workloadLevel(
        int $score
    ): string {
        if (
            $score <= 4
        ) {
            return 'light';
        }

        if (
            $score <= 10
        ) {
            return 'balanced';
        }

        if (
            $score <= 18
        ) {
            return 'high';
        }

        return 'heavy';
    }

    private function csvCell(
        $value
    ): string {
        $text =
            trim(
                (string) $value
            );

        if (
            $text !== ''
            && in_array(
                $text[0],
                [
                    '=',
                    '+',
                    '-',
                    '@',
                ],
                true
            )
        ) {
            return "'"
                . $text;
        }

        return $text;
    }

    private function reviewStage(
        string $status
    ): array {
        return match ($status) {
            'submitted' => [
                'key' => 'initial_intake',
                'label' => 'Initial Intake',
                'step' => 1,
                'steps_total' => 4,
            ],
            'under_review' => [
                'key' => 'document_review',
                'label' => 'Document Review',
                'step' => 2,
                'steps_total' => 4,
            ],
            'needs_information' => [
                'key' => 'applicant_follow_up',
                'label' => 'Applicant Follow-up',
                'step' => 2,
                'steps_total' => 4,
            ],
            'ready_for_approval' => [
                'key' => 'admin_review',
                'label' => 'Admin Review',
                'step' => 4,
                'steps_total' => 4,
            ],
            'approved' => [
                'key' => 'completed',
                'label' => 'Completed',
                'step' => 4,
                'steps_total' => 4,
            ],
            'declined' => [
                'key' => 'closed',
                'label' => 'Closed',
                'step' => 4,
                'steps_total' => 4,
            ],
            default => [
                'key' => 'review',
                'label' => 'Review',
                'step' => null,
                'steps_total' => 4,
            ],
        };
    }

    private function staffRows(
        Request $request
    ): array {
        $ids = collect();

        if (
            Schema::hasTable(
                'nurselink_reviewer_access'
            )
        ) {
            $ids = $ids->merge(
                DB::table(
                    'nurselink_reviewer_access'
                )
                    ->pluck(
                        'user_id'
                    )
                    ->map(
                        fn ($value): string =>
                            (string) $value
                    )
            );
        }

        if (
            Schema::hasTable(
                'nurselink_super_admin_access'
            )
        ) {
            $ids = $ids->merge(
                DB::table(
                    'nurselink_super_admin_access'
                )
                    ->pluck(
                        'user_id'
                    )
                    ->map(
                        fn ($value): string =>
                            (string) $value
                    )
            );
        }

        $ids = $ids
            ->unique()
            ->values();

        if (
            $ids->isEmpty()
        ) {
            return [];
        }

        $users =
            $this->userMap(
                $ids->all()
            );

        $reviewAccess =
            Schema::hasTable(
                'nurselink_reviewer_access'
            )
                ? DB::table(
                    'nurselink_reviewer_access'
                )
                    ->whereIn(
                        'user_id',
                        $ids->all()
                    )
                    ->get()
                    ->keyBy(
                        fn ($row): string =>
                            (string) $row->user_id
                    )
                : collect();

        $superAccess =
            Schema::hasTable(
                'nurselink_super_admin_access'
            )
                ? DB::table(
                    'nurselink_super_admin_access'
                )
                    ->whereIn(
                        'user_id',
                        $ids->all()
                    )
                    ->get()
                    ->keyBy(
                        fn ($row): string =>
                            (string) $row->user_id
                    )
                : collect();

        $workloads = [];

        if (
            Schema::hasColumn(
                'nurselink_memberships',
                'assigned_reviewer_user_id'
            )
        ) {
            $workloadColumns = [
                'assigned_reviewer_user_id',
                'status',
            ];

            if (
                Schema::hasColumn(
                    'nurselink_memberships',
                    'review_priority'
                )
            ) {
                $workloadColumns[] =
                    'review_priority';
            }

            if (
                Schema::hasColumn(
                    'nurselink_memberships',
                    'review_due_at'
                )
            ) {
                $workloadColumns[] =
                    'review_due_at';
            }

            $assignedRows = DB::table(
                'nurselink_memberships'
            )
                ->whereIn(
                    'status',
                    self::PENDING_STATUSES
                )
                ->whereNotNull(
                    'assigned_reviewer_user_id'
                )
                ->get(
                    $workloadColumns
                );

            foreach (
                $assignedRows
                as $assigned
            ) {
                $reviewerId =
                    (string)
                        $assigned
                            ->assigned_reviewer_user_id;

                if (
                    $reviewerId === ''
                ) {
                    continue;
                }

                if (
                    ! isset(
                        $workloads[
                            $reviewerId
                        ]
                    )
                ) {
                    $workloads[
                        $reviewerId
                    ] = [
                        'total' => 0,
                        'urgent' => 0,
                        'high' => 0,
                        'overdue' => 0,
                        'ready_for_approval' => 0,
                    ];
                }

                $workloads[
                    $reviewerId
                ][
                    'total'
                ]++;

                $priority = strtolower(
                    (string) (
                        $assigned
                            ->review_priority
                        ?? 'normal'
                    )
                );

                if (
                    in_array(
                        $priority,
                        [
                            'urgent',
                            'high',
                        ],
                        true
                    )
                ) {
                    $workloads[
                        $reviewerId
                    ][
                        $priority
                    ]++;
                }

                if (
                    (string) (
                        $assigned
                            ->status
                        ?? ''
                    )
                    === 'ready_for_approval'
                ) {
                    $workloads[
                        $reviewerId
                    ][
                        'ready_for_approval'
                    ]++;
                }

                $reviewDueAt =
                    $assigned
                        ->review_due_at
                    ?? null;

                if (
                    $reviewDueAt
                    && \Carbon\Carbon::parse(
                        $reviewDueAt
                    )->isPast()
                ) {
                    $workloads[
                        $reviewerId
                    ][
                        'overdue'
                    ]++;
                }
            }
        }

        return $ids->map(
            function (
                $id
            ) use (
                $users,
                $reviewAccess,
                $superAccess,
                $workloads,
                $request
            ): array {
                $key =
                    (string) $id;

                $review =
                    $reviewAccess->get(
                        $key
                    );

                $super =
                    $superAccess->get(
                        $key
                    );

                $superActive =
                    (bool) (
                        $super->active
                        ?? false
                    );

                $reviewActive =
                    (bool) (
                        $review->active
                        ?? false
                    );

                $role = $superActive
                    ? 'super_admin'
                    : (
                        $reviewActive
                            ? (
                                (string)
                                    $review->role
                            )
                            : 'revoked'
                    );

                $user =
                    $users[$key]
                    ?? [];

                return [
                    'user_id' =>
                        $key,
                    'name' =>
                        $user['name']
                        ?? $key,
                    'email' =>
                        $user['email']
                        ?? '',
                    'role' =>
                        $role,
                    'role_label' =>
                        match ($role) {
                            'super_admin' =>
                                'Super Administrator',
                            'admin' =>
                                'Administrator',
                            'reviewer' =>
                                'Reviewer',
                            default =>
                                'Revoked',
                        },
                    'active' =>
                        $superActive
                        || $reviewActive,
                    'pending_workload' =>
                        (int) (
                            $workloads[
                                $key
                            ][
                                'total'
                            ]
                            ?? 0
                        ),
                    'urgent_workload' =>
                        (int) (
                            $workloads[
                                $key
                            ][
                                'urgent'
                            ]
                            ?? 0
                        ),
                    'high_workload' =>
                        (int) (
                            $workloads[
                                $key
                            ][
                                'high'
                            ]
                            ?? 0
                        ),
                    'overdue_workload' =>
                        (int) (
                            $workloads[
                                $key
                            ][
                                'overdue'
                            ]
                            ?? 0
                        ),
                    'ready_for_approval_workload' =>
                        (int) (
                            $workloads[
                                $key
                            ][
                                'ready_for_approval'
                            ]
                            ?? 0
                        ),
                    'workload_score' =>
                        (
                            (int) (
                                $workloads[
                                    $key
                                ][
                                    'total'
                                ]
                                ?? 0
                            )
                            + (
                                3
                                * (int) (
                                    $workloads[
                                        $key
                                    ][
                                        'urgent'
                                    ]
                                    ?? 0
                                )
                            )
                            + (
                                2
                                * (int) (
                                    $workloads[
                                        $key
                                    ][
                                        'high'
                                    ]
                                    ?? 0
                                )
                            )
                            + (
                                2
                                * (int) (
                                    $workloads[
                                        $key
                                    ][
                                        'overdue'
                                    ]
                                    ?? 0
                                )
                            )
                        ),
                    'workload_level' =>
                        $this->workloadLevel(
                            (
                                (int) (
                                    $workloads[
                                        $key
                                    ][
                                        'total'
                                    ]
                                    ?? 0
                                )
                                + (
                                    3
                                    * (int) (
                                        $workloads[
                                            $key
                                        ][
                                            'urgent'
                                        ]
                                        ?? 0
                                    )
                                )
                                + (
                                    2
                                    * (int) (
                                        $workloads[
                                            $key
                                        ][
                                            'high'
                                        ]
                                        ?? 0
                                    )
                                )
                                + (
                                    2
                                    * (int) (
                                        $workloads[
                                            $key
                                        ][
                                            'overdue'
                                        ]
                                        ?? 0
                                    )
                                )
                            )
                        ),
                    'is_current_user' =>
                        hash_equals(
                            $key,
                            (string)
                                $request
                                    ->user()
                                    ->getKey()
                        ),
                ];
            }
        )
            ->sortBy(
                fn (
                    array $row
                ): string =>
                    (
                        $row['active']
                            ? '0'
                            : '1'
                    )
                    . '|'
                    . strtolower(
                        $row['email']
                    )
            )
            ->values()
            ->all();
    }

    private function isActivePrivilegedReviewer(
        string $userId
    ): bool {
        $reviewActive =
            Schema::hasTable(
                'nurselink_reviewer_access'
            )
            && DB::table(
                'nurselink_reviewer_access'
            )
                ->where(
                    'user_id',
                    $userId
                )
                ->where(
                    'active',
                    true
                )
                ->whereIn(
                    'role',
                    [
                        'reviewer',
                        'admin',
                        'super_admin',
                    ]
                )
                ->exists();

        $superActive =
            Schema::hasTable(
                'nurselink_super_admin_access'
            )
            && DB::table(
                'nurselink_super_admin_access'
            )
                ->where(
                    'user_id',
                    $userId
                )
                ->where(
                    'active',
                    true
                )
                ->exists();

        return $reviewActive
            || $superActive;
    }

    private function notifyAssignedReviewer(
        string $reviewerUserId,
        object $membership
    ): void {
        if (
            ! Schema::hasTable(
                'nurselink_notifications'
            )
        ) {
            return;
        }

        $applicant =
            $this->userMap([
                (string) $membership
                    ->user_id,
            ])[
                (string) $membership
                    ->user_id
            ] ?? null;

        DB::table(
            'nurselink_notifications'
        )->insert([
            'user_id' =>
                $reviewerUserId,
            'type' =>
                'membership.review.assigned',
            'severity' =>
                'info',
            'title' =>
                'Membership review assigned',
            'message' =>
                'A NurseLink membership review was assigned to you for '
                . (
                    $applicant['name']
                    ?? 'an applicant'
                )
                . '.',
            'action_url' =>
                '/nurselink-membership-administration.html',
            'created_at' =>
                now(),
            'updated_at' =>
                now(),
        ]);
    }

    private function requireSavedViewsTable(): void
    {
        abort_unless(
            Schema::hasTable('nurselink_admin_saved_views'),
            503,
            'Saved application views are not available until the v5.6 migration is complete.'
        );
    }

    private function bulkTriageFailure(int $membershipId, string $code, string $message): array
    {
        return [
            'membership_id' => $membershipId,
            'status' => 'failed',
            'code' => $code,
            'message' => $message,
        ];
    }

    private function requireSlaPolicyTable(): void
    {
        abort_unless(
            Schema::hasTable('nurselink_application_sla_policy'),
            503,
            'Application SLA policy is not available until the v5.6 migration is complete.'
        );
    }

    private function presentSlaPolicy(object $row): array
    {
        $businessDays = json_decode((string) $row->business_days, true);

        return [
            'id' => (int) $row->id,
            'version' => (int) $row->version,
            'enabled' => (bool) $row->enabled,
            'warning_hours' => (int) $row->warning_hours,
            'target_hours' => (int) $row->target_hours,
            'timezone' => (string) $row->timezone,
            'business_days' => is_array($businessDays)
                ? array_values(array_map('intval', $businessDays))
                : [],
            'updated_by_user_id' => $row->updated_by_user_id ?: null,
            'created_at' => $row->created_at,
            'updated_at' => $row->updated_at,
        ];
    }

    private function presentSavedView(object $row): array
    {
        $filters = json_decode((string) $row->filters, true);

        return [
            'id' => (int) $row->id,
            'name' => (string) $row->name,
            'filters' => is_array($filters) ? $filters : [],
            'created_at' => $row->created_at,
            'updated_at' => $row->updated_at,
        ];
    }

    private function requireElevatedSession(
        Request $request
    ): array {
        $user =
            $request->user();

        abort_unless(
            $user,
            401
        );

        $sessionUserId =
            (string)
                $request->session()->get(
                    'nurselink_admin_elevated_user_id',
                    ''
                );

        $elevatedAt =
            (int)
                $request->session()->get(
                    'nurselink_admin_elevated_at',
                    0
                );

        $expiresAt =
            (int)
                $request->session()->get(
                    'nurselink_admin_expires_at',
                    0
                );

        abort_unless(
            $sessionUserId !== ''
            && hash_equals(
                $sessionUserId,
                (string)
                    $user->getKey()
            )
            && $elevatedAt > 0
            && $expiresAt >= time()
            && (
                time()
                - $elevatedAt
            )
                <= self::ELEVATION_TTL_SECONDS,
            403,
            'A separate NurseLink administrator sign-in is required.'
        );

        $reviewerAccess =
            Schema::hasTable(
                'nurselink_reviewer_access'
            )
                ? DB::table(
                    'nurselink_reviewer_access'
                )
                    ->where(
                        'user_id',
                        $user->getKey()
                    )
                    ->where(
                        'active',
                        true
                    )
                    ->first()
                : null;

        $explicitSuperAdmin =
            Schema::hasTable(
                'nurselink_super_admin_access'
            )
            && DB::table(
                'nurselink_super_admin_access'
            )
                ->where(
                    'user_id',
                    $user->getKey()
                )
                ->where(
                    'active',
                    true
                )
                ->exists();

        $modelRole =
            strtolower(
                trim(
                    (string) (
                        $user->role
                        ?? $user->user_role
                        ?? $user->user_type
                        ?? ''
                    )
                )
            );

        $reviewRole =
            strtolower(
                (string) (
                    $reviewerAccess->role
                    ?? ''
                )
            );

        $isSuperAdmin =
            $explicitSuperAdmin
            || (bool) (
                $user->is_super_admin
                ?? false
            )
            || in_array(
                $modelRole,
                [
                    'super_admin',
                    'super-administrator',
                    'super_administrator',
                    'superadministrator',
                ],
                true
            )
            || $reviewRole
                === 'super_admin';

        $isAdmin =
            $isSuperAdmin
            || (bool) (
                $user->is_admin
                ?? false
            )
            || in_array(
                $modelRole,
                [
                    'admin',
                    'administrator',
                ],
                true
            )
            || in_array(
                $reviewRole,
                [
                    'admin',
                    'super_admin',
                ],
                true
            );

        $isReviewer =
            $isAdmin
            || $reviewRole
                === 'reviewer';

        abort_unless(
            $isReviewer,
            403,
            'Reviewer or Administrator access is required.'
        );

        $role = match (true) {
            $isSuperAdmin =>
                'super_admin',
            $isAdmin =>
                'admin',
            $isReviewer =>
                'reviewer',
            default =>
                'user',
        };

        return [
            'role' =>
                $role,
            'label' =>
                match ($role) {
                    'super_admin' =>
                        'Super Administrator',
                    'admin' =>
                        'Administrator',
                    'reviewer' =>
                        'Reviewer',
                    default =>
                        'User',
                },
            'is_super_admin' =>
                $isSuperAdmin,
            'is_admin' =>
                $isAdmin,
            'is_reviewer' =>
                $isReviewer,
        ];
    }

    private function userMap(
        array $ids
    ): array {
        $ids = array_values(
            array_unique(
                array_filter(
                    array_map(
                        fn ($id): string =>
                            (string) $id,
                        $ids
                    )
                )
            )
        );

        if (
            $ids === []
        ) {
            return [];
        }

        $columns = [
            'id',
        ];

        foreach ([
            'email',
            'name',
            'first_name',
            'last_name',
        ] as $column) {
            if (
                Schema::hasColumn(
                    'users',
                    $column
                )
            ) {
                $columns[] =
                    $column;
            }
        }

        $rows = DB::table(
            'users'
        )
            ->whereIn(
                'id',
                $ids
            )
            ->get(
                $columns
            );

        $map = [];

        foreach (
            $rows as $row
        ) {
            $name = trim(
                (string) (
                    $row->name
                    ?? ''
                )
            );

            if (
                $name === ''
            ) {
                $name = trim(
                    (string) (
                        $row->first_name
                        ?? ''
                    )
                    . ' '
                    . (string) (
                        $row->last_name
                        ?? ''
                    )
                );
            }

            if (
                $name === ''
            ) {
                $name =
                    (string) (
                        $row->email
                        ?? $row->id
                    );
            }

            $map[
                (string) $row->id
            ] = [
                'id' =>
                    (string) $row->id,
                'name' =>
                    $name,
                'email' =>
                    (string) (
                        $row->email
                        ?? ''
                    ),
            ];
        }

        return $map;
    }

    private function audit(
        Request $request,
        string $action,
        string $targetType,
        string $targetId,
        $before,
        $after
    ): void {
        if (
            ! Schema::hasTable(
                'nurselink_review_audit'
            )
        ) {
            return;
        }

        DB::table(
            'nurselink_review_audit'
        )->insert([
            'reviewer_user_id' =>
                (string)
                    $request
                        ->user()
                        ->getKey(),
            'action' =>
                $action,
            'target_type' =>
                $targetType,
            'target_id' =>
                $targetId,
            'before_state' =>
                $before
                    ? json_encode(
                        $before,
                        JSON_UNESCAPED_UNICODE
                    )
                    : null,
            'after_state' =>
                $after
                    ? json_encode(
                        $after,
                        JSON_UNESCAPED_UNICODE
                    )
                    : null,
            'created_at' =>
                now(),
        ]);
    }
}
