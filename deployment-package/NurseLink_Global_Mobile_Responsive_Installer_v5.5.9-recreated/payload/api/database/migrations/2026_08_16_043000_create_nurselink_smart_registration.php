<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (!Schema::hasTable('nurselink_smart_registration_profiles')) {
            Schema::create('nurselink_smart_registration_profiles', function (Blueprint $table): void {
                $table->id();
                $table->string('user_id',191)->unique();
                $table->json('profile_json')->nullable();
                $table->json('provenance_json')->nullable();
                $table->json('missing_fields_json')->nullable();
                $table->string('status',32)->default('draft');
                $table->unsignedInteger('revision')->default(1);
                $table->timestamp('submitted_at')->nullable();
                $table->timestamp('resubmitted_at')->nullable();
                $table->timestamps();
                $table->index(['status','updated_at'],'nl_sr_profile_status_updated_idx');
            });
        }
        if (!Schema::hasTable('nurselink_smart_registration_documents')) {
            Schema::create('nurselink_smart_registration_documents', function (Blueprint $table): void {
                $table->id();
                $table->string('user_id',191);
                $table->string('document_type',80)->default('supporting_document');
                $table->string('original_name',255);
                $table->string('storage_path',512);
                $table->string('mime_type',120)->nullable();
                $table->unsignedBigInteger('size_bytes')->default(0);
                $table->string('sha256',64);
                $table->longText('extracted_text')->nullable();
                $table->json('extracted_json')->nullable();
                $table->json('confidence_json')->nullable();
                $table->unsignedInteger('version')->default(1);
                $table->boolean('active')->default(true);
                $table->timestamps();
                $table->index(['user_id','created_at'],'nl_sr_docs_user_created_idx');
                $table->index(['user_id','document_type'],'nl_sr_docs_user_type_idx');
                $table->index('sha256','nl_sr_docs_sha_idx');
            });
        }
        if (Schema::hasTable('nurselink_memberships')) {
            try { DB::statement("ALTER TABLE nurselink_memberships ALTER status SET DEFAULT 'draft'"); }
            catch (Throwable $e) { try { DB::statement("ALTER TABLE nurselink_memberships MODIFY status VARCHAR(40) NOT NULL DEFAULT 'draft'"); } catch (Throwable $ignored) {} }
        }
    }
    public function down(): void {
        Schema::dropIfExists('nurselink_smart_registration_documents');
        Schema::dropIfExists('nurselink_smart_registration_profiles');
    }
};
