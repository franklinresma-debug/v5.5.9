<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('nurselink_admin_saved_views')) {
            return;
        }

        Schema::create(
            'nurselink_admin_saved_views',
            function (Blueprint $table): void {
                $table->id();
                $this->userIdDefinition($table);
                $table->string('view_type', 40);
                $table->string('name', 80);
                $table->json('filters');
                $table->timestamps();

                $table->unique(
                    ['user_id', 'view_type', 'name'],
                    'nl_admin_view_owner_name_unique'
                );
                $table->index(
                    ['user_id', 'view_type', 'updated_at'],
                    'nl_admin_view_owner_lookup'
                );
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('nurselink_admin_saved_views');
    }

    private function userIdDefinition(Blueprint $table): void
    {
        $column = DB::selectOne(
            "SELECT DATA_TYPE, COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'users'
               AND COLUMN_NAME = 'id'
             LIMIT 1"
        );

        if (! $column) {
            throw new RuntimeException('Unable to inspect users.id.');
        }

        $type = strtolower((string) $column->DATA_TYPE);
        $unsigned = str_contains(
            strtolower((string) $column->COLUMN_TYPE),
            'unsigned'
        );

        if (in_array($type, ['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint'], true)) {
            $definition = match ($type) {
                'tinyint' => $table->tinyInteger('user_id'),
                'smallint' => $table->smallInteger('user_id'),
                'mediumint' => $table->mediumInteger('user_id'),
                'int', 'integer' => $table->integer('user_id'),
                default => $table->bigInteger('user_id'),
            };

            if ($unsigned) {
                $definition->unsigned();
            }
        } elseif ($type === 'char') {
            $table->char(
                'user_id',
                max(1, min((int) ($column->CHARACTER_MAXIMUM_LENGTH ?: 36), 255))
            );
        } elseif ($type === 'varchar') {
            $table->string(
                'user_id',
                max(1, min((int) ($column->CHARACTER_MAXIMUM_LENGTH ?: 191), 512))
            );
        } else {
            throw new RuntimeException(
                'Unsupported users.id data type for NurseLink: ' . $type
            );
        }

        $table->index('user_id');
    }
};
