/* NURSELINK_MEMBERSHIP_CYCLE_HEALTH_V559_COMPAT_START */
Route::middleware(['auth:sanctum', 'verified', 'active.user'])->group(function () {
    Route::get('/nurselink/admin/membership-cycle-health/{id}', [\App\Http\Controllers\Api\MembershipCycleHealthController::class, 'show'])
        ->whereNumber('id')
        ->middleware(\App\Http\Middleware\EnsureNurseLinkAdminPermission::class);
    Route::post('/nurselink/admin/membership-cycle-health/{id}/reconcile', [\App\Http\Controllers\Api\MembershipCycleHealthController::class, 'reconcile'])
        ->whereNumber('id')
        ->middleware(\App\Http\Middleware\EnsureNurseLinkAdminPermission::class);
});
/* NURSELINK_MEMBERSHIP_CYCLE_HEALTH_V559_COMPAT_END */
