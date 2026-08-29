<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('nurselink_application_sla_policy')) {
            Schema::create(
                'nurselink_application_sla_policy',
                function (Blueprint $table): void {
                    $table->id();
                    $table->unsignedInteger('version')->default(1);
                    $table->boolean('enabled')->default(true);
                    $table->unsignedInteger('warning_hours')->default(24);
                    $table->unsignedInteger('target_hours')->default(72);
                    $table->string('timezone', 64)->default('Asia/Manila');
                    $table->json('business_days');
                    $table->string('updated_by_user_id', 191)->nullable();
                    $table->timestamps();
                }
            );
        }

        if (DB::table('nurselink_application_sla_policy')->doesntExist()) {
            DB::table('nurselink_application_sla_policy')->insert([
                'version' => 1,
                'enabled' => true,
                'warning_hours' => 24,
                'target_hours' => 72,
                'timezone' => 'Asia/Manila',
                'business_days' => json_encode([1, 2, 3, 4, 5]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('nurselink_application_sla_policy');
    }
};
