<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (!Schema::hasTable('nurselink_membership_status_history')) {
            Schema::create('nurselink_membership_status_history', function (Blueprint $table): void {
                $table->id(); $table->unsignedBigInteger('membership_id'); $table->string('user_id',191);
                $table->string('from_status',40)->nullable(); $table->string('to_status',40);
                $table->string('actor_user_id',191)->nullable(); $table->string('actor_type',32)->default('system');
                $table->text('reason')->nullable(); $table->json('metadata_json')->nullable(); $table->timestamps();
                $table->index(['membership_id','created_at'],'nl_mh_member_created_idx');
                $table->index(['user_id','created_at'],'nl_mh_user_created_idx');
            });
        }
        if (!Schema::hasTable('nurselink_membership_notification_log')) {
            Schema::create('nurselink_membership_notification_log', function (Blueprint $table): void {
                $table->id(); $table->unsignedBigInteger('membership_id')->nullable(); $table->string('user_id',191);
                $table->string('event',80); $table->string('channel',24)->default('email'); $table->string('status',24)->default('pending');
                $table->text('recipient')->nullable(); $table->text('last_error')->nullable(); $table->unsignedInteger('attempts')->default(0);
                $table->timestamp('sent_at')->nullable(); $table->timestamps();
                $table->index(['user_id','created_at'],'nl_mn_user_created_idx');
                $table->index(['status','created_at'],'nl_mn_status_created_idx');
            });
        }
    }
    public function down(): void { Schema::dropIfExists('nurselink_membership_notification_log'); Schema::dropIfExists('nurselink_membership_status_history'); }
};
