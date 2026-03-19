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
        Schema::create('provider_webhook_logs', function (Blueprint $table): void {
            $table->id();
            $table->string('provider', 64);
            $table->string('topic', 64)->nullable();
            $table->string('event_key', 191)->nullable();
            $table->string('event_hash', 64);
            $table->json('payload');
            $table->unsignedInteger('attempt_count')->default(1);
            $table->string('process_status', 24)->default('received');
            $table->string('process_message')->nullable();
            $table->timestamp('received_at');
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'event_hash'], 'provider_event_hash_unique');
            $table->index(['provider', 'topic']);
            $table->index(['provider', 'event_key']);
            $table->index(['provider', 'process_status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('provider_webhook_logs');
    }
};

