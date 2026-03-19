<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transfer;
use App\Models\User;
use App\Models\Wallet;
use App\Services\WalletLedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class TransferController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $transfers = Transfer::query()
            ->where('user_id', $request->user()->id)
            ->with('wallet:id,currency')
            ->latest('id')
            ->paginate((int) min(max((int) $request->integer('per_page', 20), 1), 100));

        return response()->json([
            'data' => $transfers->getCollection()->map(fn (Transfer $transfer): array => $this->transformTransfer($transfer)),
            'meta' => [
                'current_page' => $transfers->currentPage(),
                'last_page' => $transfers->lastPage(),
                'per_page' => $transfers->perPage(),
                'total' => $transfers->total(),
            ],
        ]);
    }

    public function show(Request $request, Transfer $transfer): JsonResponse
    {
        abort_unless($transfer->user_id === $request->user()->id, 404);

        $transfer->loadMissing('wallet:id,currency');

        return response()->json([
            'transfer' => $this->transformTransfer($transfer, true),
        ]);
    }

    public function store(Request $request, WalletLedgerService $ledger): JsonResponse
    {
        $data = $request->validate([
            'wallet_id' => ['required', 'integer'],
            'recipient_email' => ['required', 'email:rfc,dns'],
            'amount' => ['required', 'numeric', 'min:0.00000001', 'max:10000000'],
            'note' => ['nullable', 'string', 'max:255'],
            'pin' => ['required', 'digits_between:4,6'],
        ]);

        $sender = $request->user();

        if (! $sender->transaction_pin) {
            throw ValidationException::withMessages([
                'pin' => 'Please set your transaction PIN first.',
            ]);
        }

        if (! Hash::check($data['pin'], $sender->transaction_pin)) {
            throw ValidationException::withMessages([
                'pin' => 'Invalid transaction PIN.',
            ]);
        }

        $wallet = Wallet::query()
            ->where('id', $data['wallet_id'])
            ->where('user_id', $sender->id)
            ->first();

        if (! $wallet) {
            throw ValidationException::withMessages([
                'wallet_id' => 'Source wallet not found.',
            ]);
        }

        if (! $wallet->is_active) {
            throw ValidationException::withMessages([
                'wallet_id' => 'Source wallet is inactive.',
            ]);
        }

        $recipientEmail = strtolower(trim($data['recipient_email']));
        $recipient = User::query()->where('email', $recipientEmail)->first();

        if (! $recipient) {
            throw ValidationException::withMessages([
                'recipient_email' => 'Recipient account not found.',
            ]);
        }

        if ($recipient->id === $sender->id) {
            throw ValidationException::withMessages([
                'recipient_email' => 'You cannot send funds to your own account.',
            ]);
        }

        $amount = round((float) $data['amount'], 8);
        $fee = $this->calculateFee($wallet->currency, $amount);
        $totalDebit = round($amount + $fee, 8);

        $transfer = DB::transaction(function () use (
            $sender,
            $recipient,
            $wallet,
            $amount,
            $fee,
            $data,
            $totalDebit,
            $ledger
        ) {
            $recipientWallet = Wallet::query()->firstOrCreate(
                [
                    'user_id' => $recipient->id,
                    'currency' => strtolower($wallet->currency),
                ],
                [
                    'balance' => 0,
                    'locked_balance' => 0,
                    'is_active' => true,
                ],
            );

            $reference = $ledger->makeReference('TRN');
            $transfer = Transfer::query()->create([
                'user_id' => $sender->id,
                'wallet_id' => $wallet->id,
                'method' => 'noorfi_user',
                'recipient_label' => $recipient->full_name ?: $recipient->name,
                'destination' => $recipient->email,
                'amount' => $amount,
                'fee' => $fee,
                'net_amount' => $amount,
                'status' => 'completed',
                'reference' => $reference,
                'note' => $data['note'] ?? null,
                'completed_at' => now(),
            ]);

            $ledger->debit(
                wallet: $wallet,
                type: 'send',
                amount: $amount,
                fee: $fee,
                context: [
                    'related' => $transfer,
                    'reference' => "{$reference}-D",
                    'description' => "Sent to {$recipient->email}",
                    'meta' => [
                        'recipient_user_id' => $recipient->id,
                        'recipient_email' => $recipient->email,
                        'total_debit' => $totalDebit,
                    ],
                ],
            );

            $ledger->credit(
                wallet: $recipientWallet,
                type: 'receive',
                amount: $amount,
                fee: 0,
                context: [
                    'related' => $transfer,
                    'reference' => "{$reference}-C",
                    'description' => "Received from {$sender->email}",
                    'meta' => [
                        'sender_user_id' => $sender->id,
                        'sender_email' => $sender->email,
                    ],
                ],
            );

            return $transfer;
        });

        $transfer->loadMissing('wallet:id,currency');

        return response()->json([
            'message' => 'Transfer completed successfully.',
            'transfer' => $this->transformTransfer($transfer, true),
        ], 201);
    }

    private function calculateFee(string $currency, float $amount): float
    {
        return match (strtolower($currency)) {
            'usd' => round(max($amount * 0.002, 0.15), 8),
            'usdt' => round(max($amount * 0.0015, 0.20), 8),
            'sol' => round(max($amount * 0.001, 0.0005), 8),
            default => round(max($amount * 0.0025, 0.25), 8),
        };
    }

    private function transformTransfer(Transfer $transfer, bool $verbose = false): array
    {
        $payload = [
            'id' => $transfer->id,
            'wallet_id' => $transfer->wallet_id,
            'currency' => strtoupper((string) optional($transfer->wallet)->currency),
            'method' => $transfer->method,
            'recipient_label' => $transfer->recipient_label,
            'destination' => $transfer->destination,
            'amount' => (float) $transfer->amount,
            'fee' => (float) $transfer->fee,
            'total_debit' => round((float) $transfer->amount + (float) $transfer->fee, 8),
            'net_amount' => (float) $transfer->net_amount,
            'status' => $transfer->status,
            'reference' => $transfer->reference,
            'completed_at' => $transfer->completed_at?->toIso8601String(),
            'created_at' => $transfer->created_at?->toIso8601String(),
        ];

        if ($verbose) {
            $payload['note'] = $transfer->note;
        }

        return $payload;
    }
}
