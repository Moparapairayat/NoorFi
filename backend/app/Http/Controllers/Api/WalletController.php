<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Wallet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WalletController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $wallets = $request->user()
            ->wallets()
            ->orderByRaw("FIELD(currency, 'usd', 'usdt', 'sol')")
            ->get();

        $totalUsd = $wallets->sum(function (Wallet $wallet) {
            return $this->toUsd($wallet->currency, (float) $wallet->balance);
        });

        return response()->json([
            'summary' => [
                'total_usd_value' => round($totalUsd, 2),
                'wallet_count' => $wallets->count(),
            ],
            'wallets' => $wallets->map(function (Wallet $wallet) {
                return [
                    'id' => $wallet->id,
                    'currency' => strtoupper($wallet->currency),
                    'balance' => (float) $wallet->balance,
                    'locked_balance' => (float) $wallet->locked_balance,
                    'is_active' => $wallet->is_active,
                    'usd_value' => round($this->toUsd($wallet->currency, (float) $wallet->balance), 2),
                    'updated_at' => $wallet->updated_at?->toIso8601String(),
                ];
            }),
        ]);
    }

    public function show(Request $request, Wallet $wallet): JsonResponse
    {
        abort_unless($wallet->user_id === $request->user()->id, 404);

        return response()->json([
            'wallet' => [
                'id' => $wallet->id,
                'currency' => strtoupper($wallet->currency),
                'balance' => (float) $wallet->balance,
                'locked_balance' => (float) $wallet->locked_balance,
                'is_active' => $wallet->is_active,
                'usd_value' => round($this->toUsd($wallet->currency, (float) $wallet->balance), 2),
                'updated_at' => $wallet->updated_at?->toIso8601String(),
            ],
        ]);
    }

    private function toUsd(string $currency, float $amount): float
    {
        return match (strtolower($currency)) {
            'usd', 'usdt' => $amount,
            'sol' => $amount * 170,
            default => $amount,
        };
    }
}
