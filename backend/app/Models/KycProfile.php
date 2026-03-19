<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KycProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'full_name',
        'date_of_birth',
        'nationality',
        'occupation',
        'document_type',
        'document_number',
        'issuing_country',
        'document_expiry_date',
        'address_line',
        'city',
        'postal_code',
        'country',
        'address_proof_type',
        'phone_number',
        'id_type',
        'id_image_url',
        'selfie_image_url',
        'address_proof_url',
        'status',
        'submitted_at',
        'approved_at',
        'rejected_at',
        'review_note',
        'didit_session_id',
        'didit_reference_id',
        'didit_session_url',
        'didit_vendor_status',
        'didit_decision',
        'didit_last_webhook_at',
        'didit_payload',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'document_expiry_date' => 'date',
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'didit_last_webhook_at' => 'datetime',
            'didit_payload' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
