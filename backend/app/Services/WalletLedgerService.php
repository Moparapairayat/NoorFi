<?php

namespace App\Services;

use App\Models\Transaction;
use App\Models\Wallet;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class WalletLedgerService
{
    public function credit(
        Wallet $wallet,
        string $type,
        float $amount,
        float $fee = 0,
        array $context = []
    ): Transaction {
        $grossAmount = $this->normalize($amount);
        $feeAmount = $this->normalize($fee);
        $netAmount = max($grossAmount - $feeAmount, 0);

        $lockedWallet = Wallet::query()->lockForUpdate()->findOrFail($wallet->id);
        $lockedWallet->balance = $this->normalize(((float) $lockedWallet->balance) + $netAmount);
        $lockedWallet->last_activity_at = now();
        $lockedWallet->save();

        return $this->createTransaction(
            wallet: $lockedWallet,
            type: $type,
            direction: 'credit',
            amount: $grossAmount,
            fee: $feeAmount,
            netAmount: $netAmount,
            context: $context,
        );
    }

    public function debit(
        Wallet $wallet,
        string $type,
        float $amount,
        float $fee = 0,
        array $context = []
    ): Transaction {
        $grossAmount = $this->normalize($amount);
        $feeAmount = $this->normalize($fee);
        $totalDebit = $this->normalize($grossAmount + $feeAmount);

        $lockedWallet = Wallet::query()->lockForUpdate()->findOrFail($wallet->id);

        if (! $lockedWallet->is_active) {
            throw ValidationException::withMessages([
                'wallet_id' => 'This wallet is currently inactive.',
            ]);
        }

        if ((float) $lockedWallet->balance < $totalDebit) {
            throw ValidationException::withMessages([
                'amount' => 'Insufficient wallet balance.',
            ]);
        }

        $lockedWallet->balance = $this->normalize(((float) $lockedWallet->balance) - $totalDebit);
        $lockedWallet->last_activity_at = now();
        $lockedWallet->save();

        return $this->createTransaction(
            wallet: $lockedWallet,
            type: $type,
            direction: 'debit',
            amount: $grossAmount,
            fee: $feeAmount,
            netAmount: $totalDebit,
            context: $context,
        );
    }

    public function makeReference(string $prefix): string
    {
        return strtoupper($prefix) . '-' . strtoupper(Str::random(10));
    }

    private function createTransaction(
        Wallet $wallet,
        string $type,
        string $direction,
        float $amount,
        float $fee,
        float $netAmount,
        array $context = []
    ): Transaction {
        $related = $context['related'] ?? null;

        $payload = [
            'user_id' => $wallet->user_id,
            'wallet_id' => $wallet->id,
            'type' => $type,
            'direction' => $direction,
            'amount' => $amount,
            'fee' => $fee,
            'net_amount' => $netAmount,
            'status' => $context['status'] ?? 'completed',
            'reference' => $context['reference'] ?? $this->makeReference($type),
            'description' => $context['description'] ?? null,
            'meta' => $context['meta'] ?? null,
            'occurred_at' => $context['occurred_at'] ?? now(),
        ];

        if ($related) {
            $payload['related_type'] = get_class($related);
            $payload['related_id'] = $related->id;
        }

        return Transaction::create($payload);
    }

    private function normalize(float $value): float
    {
        return round($value, 8);
    }
}
