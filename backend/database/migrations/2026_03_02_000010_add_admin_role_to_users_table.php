<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('admin_role', 32)->nullable()->after('is_admin');
            $table->index(['is_admin', 'admin_role']);
        });

        DB::table('users')
            ->where('is_admin', true)
            ->whereNull('admin_role')
            ->update([
                'admin_role' => User::ADMIN_ROLE_SUPER_ADMIN,
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex(['is_admin', 'admin_role']);
            $table->dropColumn('admin_role');
        });
    }
};

