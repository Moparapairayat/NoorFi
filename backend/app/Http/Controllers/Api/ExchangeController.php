<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Exchange;
use App\Models\Wallet;
use App\Services\WalletLedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class ExchangeController extends Controller
{
    public function rates(): JsonResponse
    {
        return response()->json([
            'base_pairs' => [
                'USD_USDT' => 1.0,
                'USDT_USD' => 1.0,
                'USD_SOL' => round(1 / 170, 8),
                'USDT_SOL' => round(1 / 170, 8),
                'SOL_USD' => 170.0,
                'SOL_USDT' => 170.0,
            ],
            'fee_percent' => 0.3,
            'updated_at' => now()->toIso8601String(),
        ]);
    }

    public function quote(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from_currency' => ['required', 'in:usd,usdt,sol'],
            'to_currency' => ['required', 'in:usd,usdt,sol'],
            'amount_from' => ['required', 'numeric', 'min:0.00000001', 'max:10000000'],
        ]);

        $fromCurrency = strtolower($data['from_currency']);
        $toCurrency = strtolower($data['to_currency']);

        if ($fromCurrency === $toCurrency) {
            throw ValidationException::withMessages([
                'to_currency' => 'Source and destination currencies must be different.',
            ]);
        }

        $amountFrom = round((float) $data['amount_from'], 8);
        $rate = $this->rateFor($fromCurrency, $toCurrency);
        $fee = $this->calculateFee($fromCurrency, $amountFrom);
        $amountTo = round($amountFrom * $rate, 8);

        return response()->json([
            'quote_id' => 'QTE-' . strtoupper(substr(sha1((string) microtime()), 0, 10)),
            'from_currency' => strtoupper($fromCurrency),
            'to_currency' => strtoupper($toCurrency),
            'amount_from' => $amountFrom,
            'rate' => $rate,
            'fee' => $fee,
            'total_debit' => round($amountFrom + $fee, 8),
            'amount_to' => $amountTo,
            'expires_at' => now()->addMinutes(2)->toIso8601String(),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $exchanges = Exchange::query()
            ->where('user_id', $request->user()->id)
            ->with([
                'fromWallet:id,currency',
                'toWallet:id,currency',
            ])
            ->latest('id')
            ->paginate((int) min(max((int) $request->integer('per_page', 20), 1), 100));

        return response()->json([
            'data' => $exchanges->getCollection()->map(fn (Exchange $exchange): array => $this->transform($exchange)),
            'meta' => [
                'current_page' => $exchanges->currentPage(),
                'last_page' => $exchanges->lastPage(),
                'per_page' => $exchanges->perPage(),
                'total' => $exchanges->total(),
            ],
        ]);
    }

    public function show(Request $request, Exchange $exchange): JsonResponse
    {
        abort_unless($exchange->user_id === $request->user()->id, 404);

        $exchange->loadMissing([
            'fromWallet:id,currency',
            'toWallet:id,currency',
        ]);

        return response()->json([
            'exchange' => $this->transform($exchange, true),
        ]);
    }

    public function store(Request $request, WalletLedgerService $ledger): JsonResponse
    {
        $data = $request->validate([
            'from_wallet_id' => ['required', 'integer'],
            'to_currency' => ['required', 'in:usd,usdt,sol'],
            'amount_from' => ['required', 'numeric', 'min:0.00000001', 'max:10000000'],
            'quote_id' => ['nullable', 'string', 'max:40'],
            'note' => ['nullable', 'string', 'max:255'],
            'pin' => ['required', 'digits_between:4,6'],
        ]);

        $user = $request->user();

        if (! $user->transaction_pin) {
            throw ValidationException::withMessages([
                'pin' => 'Please set your transaction PIN first.',
            ]);
        }

        if (! Hash::check($data['pin'], $user->transaction_pin)) {
            throw ValidationException::withMessages([
                'pin' => 'Invalid transaction PIN.',
            ]);
        }

        $fromWallet = Wallet::query()
            ->where('id', $data['from_wallet_id'])
            ->where('user_id', $user->id)
            ->first();

        if (! $fromWallet) {
            throw ValidationException::withMessages([
                'from_wallet_id' => 'Source wallet not found.',
            ]);
        }

        if (! $fromWallet->is_active) {
            throw ValidationException::withMessages([
                'from_wallet_id' => 'Source wallet is inactive.',
            ]);
        }

        $toCurrency = strtolower($data['to_currency']);
        $fromCurrency = strtolower($fromWallet->currency);

        if ($fromCurrency === $toCurrency) {
            throw ValidationException::withMessages([
                'to_currency' => 'Source and destination currencies must be different.',
            ]);
        }

        $amountFrom = round((float) $data['amount_from'], 8);
        $rate = $this->rateFor($fromCurrency, $toCurrency);
        $amountTo = round($amountFrom * $rate, 8);
        $fee = $this->calculateFee($fromCurrency, $amountFrom);
        $reference = $ledger->makeReference('EXC');

        $exchange = DB::transaction(function () use (
            $user,
            $fromWallet,
            $toCurrency,
            $amountFrom,
            $amountTo,
            $rate,
            $fee,
            $data,
            $reference,
            $ledger
        ) {
            $toWallet = Wallet::query()->firstOrCreate(
                [
                    'user_id' => $user->id,
                    'currency' => $toCurrency,
                ],
                [
                    'balance' => 0,
                    'locked_balance' => 0,
                    'is_active' => true,
                ],
            );

            $exchange = Exchange::query()->create([
                'user_id' => $user->id,
                'from_wallet_id' => $fromWallet->id,
                'to_wallet_id' => $toWallet->id,
                'amount_from' => $amountFrom,
                'amount_to' => $amountTo,
                'rate' => $rate,
                'fee' => $fee,
                'status' => 'completed',
                'quote_id' => $data['quote_id'] ?? null,
                'reference' => $reference,
                'note' => $data['note'] ?? null,
                'completed_at' => now(),
            ]);

            $ledger->debit(
                wallet: $fromWallet,
                type: 'exchange',
                amount: $amountFrom,
                fee: $fee,
                context: [
                    'related' => $exchange,
                    'reference' => "{$reference}-D",
                    'description' => "Exchange {$fromWallet->currency} to {$toCurrency}",
                    'meta' => [
                        'to_currency' => strtoupper($toCurrency),
                        'rate' => $rate,
                    ],
                ],
            );

            $ledger->credit(
                wallet: $toWallet,
                type: 'exchange',
                amount: $amountTo,
                fee: 0,
                context: [
                    'related' => $exchange,
                    'reference' => "{$reference}-C",
                    'description' => "Exchange received {$toCurrency}",
                    'meta' => [
                        'from_currency' => strtoupper($fromWallet->currency),
                        'rate' => $rate,
                    ],
                ],
            );

            return $exchange;
        });

        $exchange->loadMissing([
            'fromWallet:id,currency',
            'toWallet:id,currency',
        ]);

        return response()->json([
            'message' => 'Exchange completed successfully.',
            'exchange' => $this->transform($exchange, true),
        ], 201);
    }

    private function rateFor(string $fromCurrency, string $toCurrency): float
    {
        $matrix = [
            'usd:usdt' => 1.0,
            'usdt:usd' => 1.0,
            'usd:sol' => round(1 / 170, 8),
            'usdt:sol' => round(1 / 170, 8),
            'sol:usd' => 170.0,
            'sol:usdt' => 170.0,
        ];

        $key = "{$fromCurrency}:{$toCurrency}";

        if (! isset($matrix[$key])) {
            throw ValidationException::withMessages([
                'to_currency' => 'Exchange pair is not available at the moment.',
            ]);
        }

        return $matrix[$key];
    }

    private function calculateFee(string $currency, float $amount): float
    {
        return match (strtolower($currency)) {
            'usd', 'usdt' => round(max($amount * 0.003, 0.10), 8),
            'sol' => round(max($amount * 0.003, 0.0003), 8),
            default => round(max($amount * 0.0035, 0.10), 8),
        };
    }

    private function transform(Exchange $exchange, bool $verbose = false): array
    {
        $payload = [
            'id' => $exchange->id,
            'from_wallet_id' => $exchange->from_wallet_id,
            'to_wallet_id' => $exchange->to_wallet_id,
            'from_currency' => strtoupper((string) optional($exchange->fromWallet)->currency),
            'to_currency' => strtoupper((string) optional($exchange->toWallet)->currency),
            'amount_from' => (float) $exchange->amount_from,
            'amount_to' => (float) $exchange->amount_to,
            'rate' => (float) $exchange->rate,
            'fee' => (float) $exchange->fee,
            'total_debit' => round((float) $exchange->amount_from + (float) $exchange->fee, 8),
            'status' => $exchange->status,
            'quote_id' => $exchange->quote_id,
            'reference' => $exchange->reference,
            'completed_at' => $exchange->completed_at?->toIso8601String(),
            'created_at' => $exchange->created_at?->toIso8601String(),
        ];

        if ($verbose) {
            $payload['note'] = $exchange->note;
        }

        return $payload;
    }
}
