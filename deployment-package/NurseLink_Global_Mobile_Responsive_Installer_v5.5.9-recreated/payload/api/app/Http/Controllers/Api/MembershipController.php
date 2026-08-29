<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class MembershipController extends Controller
{
    private const FRONTEND_URL = 'https://app.amsertech.com';
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $row = $this->ensureMembership($user);

        return response()->json([
            'data' => $this->present($row, $user),
        ]);
    }

    public function verify(string $code): JsonResponse
    {
        $membership = DB::table('nurselink_memberships')
            ->where('verification_code', $code)
            ->where('status', 'approved')
            ->first();

        abort_unless($membership, 404);

        $user = DB::table('users')
            ->where('id', $membership->user_id)
            ->first();

        $standing = $this->normalizedStanding($membership);

        return response()->json([
            'data' => [
                'valid' => true,
                'member_number' => $membership->member_number,
                'status' => 'approved',
                'standing' => $standing,
                'standing_label' => ucfirst($standing),
                'active_access' => $standing === 'active',
                'member_name' => $this->displayName($user),
                'approved_at' => $membership->approved_at,
            ],
        ]);
    }

    private function ensureMembership(object $user): object
    {
        $userId = $user->getKey();

        $existing = DB::table('nurselink_memberships')
            ->where('user_id', $userId)
            ->first();

        if ($existing) {
            if ($existing->status !== 'approved') {
                $coreMemberNumber = $this->coreMemberNumber($user);

                if ($coreMemberNumber) {
                    DB::table('nurselink_memberships')
                        ->where('id', $existing->id)
                        ->update([
                            'status' => 'approved',
                            'member_number' => $coreMemberNumber,
                            'verification_code' => $existing->verification_code ?: Str::lower(Str::random(40)),
                            'approved_at' => $existing->approved_at ?: now(),
                            'standing' => 'active',
                            'standing_changed_at' =>
                                $existing->standing_changed_at ?: now(),
                            'updated_at' => now(),
                        ]);

                    $existing = DB::table('nurselink_memberships')
                        ->where('id', $existing->id)
                        ->first();
                }
            }

            return $existing;
        }

        $coreMemberNumber = $this->coreMemberNumber($user);
        $approved = (bool) $coreMemberNumber;

        $id = DB::table('nurselink_memberships')->insertGetId([
            'user_id' => $userId,
            'status' => $approved ? 'approved' : 'draft',
            'member_number' => $coreMemberNumber,
            'verification_code' => $approved ? Str::lower(Str::random(40)) : null,
            'approved_at' => $approved ? now() : null,
            'standing' => $approved ? 'active' : null,
            'standing_changed_at' => $approved ? now() : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return DB::table('nurselink_memberships')->where('id', $id)->first();
    }

    private function coreMemberNumber(object $user): ?string
    {
        if (Schema::hasColumn('users', 'member_number')) {
            $value = trim((string) ($user->member_number ?? ''));

            if ($value !== '') return $value;
        }

        return null;
    }

    private function present(object $row, object $user): array
    {
        return [
            'id' => (int) $row->id,
            'status' => $row->status,
            'member_number' => $row->member_number,
            'verification_code' => $row->verification_code,
            'verification_url' => $row->verification_code
                ? self::FRONTEND_URL
                    . '/nurselink-member-verify.html?code='
                    . rawurlencode($row->verification_code)
                : null,
            'reviewer_notes' => $row->reviewer_notes,
            'reviewed_at' => $row->reviewed_at,
            'approved_at' => $row->approved_at,
            'declined_at' => $row->declined_at,
            'standing' => $row->status === 'approved'
                ? $this->normalizedStanding($row)
                : null,
            'standing_label' => $row->status === 'approved'
                ? ucfirst($this->normalizedStanding($row))
                : null,
            'active_access' => $row->status === 'approved'
                && $this->normalizedStanding($row) === 'active',
            'standing_reason' => $row->standing_reason ?? null,
            'standing_changed_at' =>
                $row->standing_changed_at ?? null,
            'member_name' => $this->displayName($user),
        ];
    }

    private function normalizedStanding(object $membership): string
    {
        $standing = strtolower(trim((string) (
            $membership->standing ?? ''
        )));

        return in_array(
            $standing,
            ['active', 'suspended', 'inactive'],
            true
        ) ? $standing : 'active';
    }

    private function displayName(?object $user): string
    {
        if (! $user) return '';

        $name = trim((string) ($user->name ?? ''));

        if ($name !== '') return $name;

        return trim(
            (string) ($user->first_name ?? '')
            . ' '
            . (string) ($user->last_name ?? '')
        );
    }
}
