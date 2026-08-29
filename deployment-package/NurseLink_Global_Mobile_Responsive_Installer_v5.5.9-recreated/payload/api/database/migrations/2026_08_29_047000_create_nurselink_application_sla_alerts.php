<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('nurselink_application_sla_alerts')) {
            return;
        }

        Schema::create('nurselink_application_sla_alerts', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('membership_id');
            $table->unsignedInteger('policy_version');
            $table->string('alert_state', 20);
            $table->timestamp('due_at');
            $table->string('notified_user_id', 191)->nullable();
            $table->timestamp('notified_at')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->string('acknowledged_by_user_id', 191)->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->unique(
                ['membership_id', 'policy_version', 'alert_state'],
                'nl_app_sla_alert_dedupe'
            );
            $table->index(
                ['alert_state', 'resolved_at', 'created_at'],
                'nl_app_sla_alert_state'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nurselink_application_sla_alerts');
    }
};
