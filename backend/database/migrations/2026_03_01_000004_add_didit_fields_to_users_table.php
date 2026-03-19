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
            $table->string('didit_session_id')->nullable()->after('strowallet_customer_id');
            $table->string('didit_reference_id')->nullable()->after('didit_session_id');
            $table->string('didit_session_url')->nullable()->after('didit_reference_id');
            $table->string('didit_vendor_status')->nullable()->after('didit_session_url');
            $table->string('didit_decision')->nullable()->after('didit_vendor_status');
            $table->timestamp('didit_last_webhook_at')->nullable()->after('didit_decision');
            $table->json('didit_payload')->nullable()->after('didit_last_webhook_at');

            $table->index('didit_session_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['didit_session_id']);
            $table->dropColumn([
                'didit_session_id',
                'didit_reference_id',
                'didit_session_url',
                'didit_vendor_status',
                'didit_decision',
                'didit_last_webhook_at',
                'didit_payload',
            ]);
        });
    }
};
