<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('full_name')->nullable()->after('name');
            $table->string('transaction_pin')->nullable()->after('password');
            $table->string('kyc_status', 24)->default('pending')->after('transaction_pin');
            $table->string('account_status', 24)->default('active')->after('kyc_status');
            $table->boolean('is_admin')->default(false)->after('account_status');
            $table->timestamp('last_login_at')->nullable()->after('is_admin');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'full_name',
                'transaction_pin',
                'kyc_status',
                'account_status',
                'is_admin',
                'last_login_at',
            ]);
        });
    }
};
