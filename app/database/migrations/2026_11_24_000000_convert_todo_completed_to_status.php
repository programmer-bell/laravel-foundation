<?php

use App\Enums\TodoStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Convert the old boolean `completed` column to the `status` enum column.
     * Skipped on fresh installs, where the create migration already has `status`.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('todos', 'completed')) {
            return;
        }

        Schema::table('todos', function (Blueprint $table) {
            if (! Schema::hasColumn('todos', 'status')) {
                $table->string('status')->default(TodoStatus::Pending->value)->index();
            }
        });

        DB::table('todos')
            ->where('completed', true)
            ->update(['status' => TodoStatus::Completed->value]);

        Schema::table('todos', function (Blueprint $table) {
            $table->dropColumn('completed');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('todos', 'status')) {
            return;
        }

        Schema::table('todos', function (Blueprint $table) {
            if (! Schema::hasColumn('todos', 'completed')) {
                $table->boolean('completed')->default(false);
            }
        });

        DB::table('todos')
            ->where('status', TodoStatus::Completed->value)
            ->update(['completed' => true]);

        Schema::table('todos', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};
