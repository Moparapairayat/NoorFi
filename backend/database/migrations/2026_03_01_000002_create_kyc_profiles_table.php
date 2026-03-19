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
        Schema::create('kyc_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('full_name', 120);
            $table->date('date_of_birth');
            $table->string('nationality', 60);
            $table->string('occupation', 100);
            $table->string('document_type', 32);
            $table->string('document_number', 80);
            $table->string('issuing_country', 80);
            $table->date('document_expiry_date');
            $table->string('address_line', 255);
            $table->string('city', 80);
            $table->string('postal_code', 30);
            $table->string('country', 80);
            $table->string('address_proof_type', 40);
            $table->string('phone_number', 24);
            $table->string('id_type', 40)->nullable();
            $table->string('id_image_url')->nullable();
            $table->string('selfie_image_url')->nullable();
            $table->string('address_proof_url')->nullable();
            $table->string('status', 24)->default('draft');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->string('review_note')->nullable();
            $table->timestamps();

            $table->unique('user_id');
            $table->index(['status', 'submitted_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kyc_profiles');
    }
};

