<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Exchange extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'from_wallet_id',
        'to_wallet_id',
        'amount_from',
        'amount_to',
        'rate',
        'fee',
        'status',
        'quote_id',
        'reference',
        'note',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'amount_from' => 'decimal:8',
            'amount_to' => 'decimal:8',
            'rate' => 'decimal:8',
            'fee' => 'decimal:8',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function fromWallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class, 'from_wallet_id');
    }

    public function toWallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class, 'to_wallet_id');
    }
}
