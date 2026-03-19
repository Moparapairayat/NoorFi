<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProviderWebhookLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'provider',
        'topic',
        'event_key',
        'event_hash',
        'payload',
        'attempt_count',
        'process_status',
        'process_message',
        'received_at',
        'processed_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'received_at' => 'datetime',
            'processed_at' => 'datetime',
        ];
    }
}

