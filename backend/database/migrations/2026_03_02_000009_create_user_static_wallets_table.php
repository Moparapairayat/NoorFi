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
        Schema::create('user_static_wallets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('wallet_id')->constrained('wallets')->cascadeOnDelete();
            $table->string('provider', 32)->default('heleket');
            $table->string('currency', 16);
            $table->string('network', 24);
            $table->string('order_id', 100);
            $table->uuid('wallet_uuid')->nullable();
            $table->uuid('address_uuid')->nullable();
            $table->string('address', 191);
            $table->string('payment_url', 255)->nullable();
            $table->string('callback_url', 255)->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'order_id']);
            $table->unique(['user_id', 'wallet_id', 'provider', 'network'], 'user_wallet_provider_network_unique');
            $table->index(['provider', 'currency', 'network']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_static_wallets');
    }
};

