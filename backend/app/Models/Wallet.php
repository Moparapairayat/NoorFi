<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Wallet extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'currency',
        'balance',
        'locked_balance',
        'is_active',
        'last_activity_at',
    ];

    protected function casts(): array
    {
        return [
            'balance' => 'decimal:8',
            'locked_balance' => 'decimal:8',
            'is_active' => 'boolean',
            'last_activity_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function deposits(): HasMany
    {
        return $this->hasMany(Deposit::class);
    }

    public function transfers(): HasMany
    {
        return $this->hasMany(Transfer::class);
    }

    public function withdrawals(): HasMany
    {
        return $this->hasMany(Withdrawal::class);
    }

    public function fromExchanges(): HasMany
    {
        return $this->hasMany(Exchange::class, 'from_wallet_id');
    }

    public function toExchanges(): HasMany
    {
        return $this->hasMany(Exchange::class, 'to_wallet_id');
    }

    public function staticWallets(): HasMany
    {
        return $this->hasMany(UserStaticWallet::class);
    }
}
