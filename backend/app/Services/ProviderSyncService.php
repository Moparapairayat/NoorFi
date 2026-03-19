<?php

namespace App\Services;

use App\Models\Deposit;
use App\Models\Withdrawal;
use Illuminate\Support\Facades\DB;
use Throwable;

class ProviderSyncService
{
    public function __construct(
        private readonly BinancePayService $binancePay,
        private readonly HeleketService $heleket,
        private readonly WalletLedgerService $ledger
    ) {
    }

    /**
     * @return array<string, array<string, int>>
     */
    public function syncPending(int $depositLimit = 100, int $withdrawalLimit = 100): array
    {
        return [
            'deposits' => $this->syncPendingDeposits($depositLimit),
            'withdrawals' => $this->syncPendingWithdrawals($withdrawalLimit),
        ];
    }

    /**
     * @return array<string, int>
     */
    private function syncPendingDeposits(int $limit): array
    {
        $stats = [
            'scanned' => 0,
            'completed' => 0,
            'updated' => 0,
            'failed' => 0,
            'errors' => 0,
        ];

        $pending = Deposit::query()
            ->whereIn('method', ['binance_pay', 'heleket'])
            ->whereIn('status', ['pending', 'processing'])
            ->orderBy('id')
            ->limit(max($limit, 1))
            ->get(['id', 'method', 'reference']);

        foreach ($pending as $deposit) {
            $stats['scanned']++;

            try {
                if ($deposit->method === 'binance_pay') {
                    $providerPayload = $this->binancePay->queryOrderByMerchantTradeNo($deposit->reference);
                    $providerStatus = strtoupper(trim((string) data_get($providerPayload, 'status', 'INITIAL')));
                    $mappedStatus = $this->mapBinancePayStatus($providerStatus);
                    $result = $this->applyDepositStatusFromProvider(
                        depositId: (int) $deposit->id,
                        providerName: 'binance_pay',
                        providerStatus: $providerStatus,
                        mappedStatus: $mappedStatus,
                        providerPayload: $providerPayload,
                    );
                } else {
                    $providerPayload = $this->heleket->paymentInfoByOrderId($deposit->reference);
                    $providerStatus = strtolower(trim((string) data_get($providerPayload, 'status', 'check')));
                    $mappedStatus = $this->mapHeleketPaymentStatus($providerStatus);
                    $result = $this->applyDepositStatusFromProvider(
                        depositId: (int) $deposit->id,
                        providerName: 'heleket',
                        providerStatus: $providerStatus,
                        mappedStatus: $mappedStatus,
                        providerPayload: $providerPayload,
                    );
                }

                if ($result === 'completed') {
                    $stats['completed']++;
                    continue;
                }

                if ($result === 'failed') {
                    $stats['failed']++;
                    continue;
                }

                if ($result === 'updated') {
                    $stats['updated']++;
                }
            } catch (Throwable) {
                $stats['errors']++;
            }
        }

        return $stats;
    }

    /**
     * @param  array<string, mixed>  $providerPayload
     */
    private function applyDepositStatusFromProvider(
        int $depositId,
        string $providerName,
        string $providerStatus,
        string $mappedStatus,
        array $providerPayload
    ): string {
        return DB::transaction(function () use (
            $depositId,
            $providerName,
            $providerStatus,
            $mappedStatus,
            $providerPayload
        ): string {
            $deposit = Deposit::query()
                ->with('wallet:id,user_id,currency,is_active')
                ->lockForUpdate()
                ->findOrFail($depositId);

            $instructions = is_array($deposit->instructions) ? $deposit->instructions : [];
            $provider = is_array($instructions['provider'] ?? null) ? $instructions['provider'] : [];
            $provider['last_sync_at'] = now()->toIso8601String();
            $provider['last_sync_status'] = $providerStatus;
            $provider['last_sync_payload'] = $providerPayload;
            if ($providerName === 'binance_pay') {
                $provider['order_status'] = $providerStatus;
            } else {
                $provider['status'] = $providerStatus;
            }
            $instructions['provider'] = $provider;

            if ($deposit->status === 'completed' && $deposit->credited_at !== null) {
                $deposit->forceFill([
                    'instructions' => $instructions,
                ])->save();

                return 'noop';
            }

            if ($mappedStatus === 'completed') {
                $wallet = $deposit->wallet;
                if (! $wallet || $wallet->user_id !== $deposit->user_id || ! $wallet->is_active) {
                    throw new \RuntimeException('Deposit wallet invalid during provider sync.');
                }

                $this->ledger->credit(
                    wallet: $wallet,
                    type: 'deposit',
                    amount: (float) $deposit->amount,
                    fee: (float) $deposit->fee,
                    context: [
                        'related' => $deposit,
                        'reference' => "{$deposit->reference}-C",
                        'description' => "Deposit confirmed by {$providerName} periodic sync",
                        'meta' => [
                            'provider' => $providerName,
                            'provider_status' => $providerStatus,
                            'provider_payload' => $providerPayload,
                        ],
                    ],
                );

                $deposit->forceFill([
                    'status' => 'completed',
                    'credited_at' => now(),
                    'instructions' => $instructions,
                ])->save();

                return 'completed';
            }

            $nextStatus = $mappedStatus === 'failed' ? 'failed' : 'processing';
            $deposit->forceFill([
                'status' => $nextStatus,
                'instructions' => $instructions,
            ])->save();

            return $nextStatus === 'failed' ? 'failed' : 'updated';
        });
    }

    /**
     * @return array<string, int>
     */
    private function syncPendingWithdrawals(int $limit): array
    {
        $stats = [
            'scanned' => 0,
            'completed' => 0,
            'updated' => 0,
            'failed' => 0,
            'errors' => 0,
        ];

        $pending = Withdrawal::query()
            ->where('method', 'heleket')
            ->whereIn('status', ['pending', 'processing'])
            ->orderBy('id')
            ->limit(max($limit, 1))
            ->get(['id', 'reference']);

        foreach ($pending as $withdrawal) {
            $stats['scanned']++;

            try {
                $providerPayload = $this->heleket->payoutInfoByOrderId($withdrawal->reference);
                $providerStatus = strtolower(trim((string) data_get($providerPayload, 'status', 'process')));
                $mappedStatus = $this->mapHeleketPayoutStatus($providerStatus);
                $result = $this->applyWithdrawalStatusFromProvider(
                    withdrawalId: (int) $withdrawal->id,
                    providerStatus: $providerStatus,
                    mappedStatus: $mappedStatus,
                    providerPayload: $providerPayload,
                );

                if ($result === 'completed') {
                    $stats['completed']++;
                    continue;
                }

                if ($result === 'failed') {
                    $stats['failed']++;
                    continue;
                }

                if ($result === 'updated') {
                    $stats['updated']++;
                }
            } catch (Throwable) {
                $stats['errors']++;
            }
        }

        return $stats;
    }

    /**
     * @param  array<string, mixed>  $providerPayload
     */
    private function applyWithdrawalStatusFromProvider(
        int $withdrawalId,
        string $providerStatus,
        string $mappedStatus,
        array $providerPayload
    ): string {
        return DB::transaction(function () use (
            $withdrawalId,
            $providerStatus,
            $mappedStatus,
            $providerPayload
        ): string {
            $withdrawal = Withdrawal::query()
                ->with('wallet:id,user_id,currency,is_active')
                ->lockForUpdate()
                ->findOrFail($withdrawalId);

            $instructions = is_array($withdrawal->instructions) ? $withdrawal->instructions : [];
            $provider = is_array($instructions['provider'] ?? null) ? $instructions['provider'] : [];
            $provider['last_sync_at'] = now()->toIso8601String();
            $provider['last_sync_status'] = $providerStatus;
            $provider['last_sync_payload'] = $providerPayload;
            $instructions['provider'] = $provider;

            if ($mappedStatus === 'completed' && in_array($withdrawal->status, ['pending', 'processing'], true)) {
                $withdrawal->forceFill([
                    'status' => 'completed',
                    'completed_at' => now(),
                    'instructions' => $instructions,
                ])->save();

                return 'completed';
            }

            if ($mappedStatus === 'failed' && $withdrawal->status !== 'completed') {
                $this->refundFailedWithdrawal($withdrawal, $instructions, $providerPayload);

                return 'failed';
            }

            if (in_array($withdrawal->status, ['pending', 'processing'], true)) {
                $withdrawal->forceFill([
                    'status' => 'processing',
                    'instructions' => $instructions,
                ])->save();

                return 'updated';
            }

            $withdrawal->forceFill([
                'instructions' => $instructions,
            ])->save();

            return 'noop';
        });
    }

    /**
     * @param  array<string, mixed>  $instructions
     * @param  array<string, mixed>  $providerPayload
     */
    private function refundFailedWithdrawal(
        Withdrawal $withdrawal,
        array $instructions,
        array $providerPayload
    ): void {
        $refund = is_array($instructions['refund'] ?? null) ? $instructions['refund'] : [];
        $alreadyRefunded = (bool) ($refund['applied'] ?? false);

        if (! $alreadyRefunded) {
            $wallet = $withdrawal->wallet;
            if ($wallet && $wallet->user_id === $withdrawal->user_id) {
                $refundAmount = round((float) $withdrawal->amount + (float) $withdrawal->fee, 8);
                $refundReference = "{$withdrawal->reference}-RF";

                if ($refundAmount > 0) {
                    $this->ledger->credit(
                        wallet: $wallet,
                        type: 'withdraw_refund',
                        amount: $refundAmount,
                        fee: 0.0,
                        context: [
                            'related' => $withdrawal,
                            'reference' => $refundReference,
                            'description' => 'Withdrawal refunded after provider sync failure',
                            'meta' => [
                                'provider' => 'heleket',
                                'provider_status' => 'failed',
                                'source_reference' => $withdrawal->reference,
                            ],
                        ],
                    );
                }

                $instructions['refund'] = [
                    'applied' => true,
                    'amount' => $refundAmount,
                    'reference' => $refundReference,
                    'at' => now()->toIso8601String(),
                    'reason' => 'Provider sync marked withdrawal as failed.',
                ];
            }
        }

        $provider = is_array($instructions['provider'] ?? null) ? $instructions['provider'] : [];
        $provider['last_sync_payload'] = $providerPayload;
        $provider['last_sync_status'] = 'failed';
        $instructions['provider'] = $provider;

        $withdrawal->forceFill([
            'status' => 'failed',
            'completed_at' => now(),
            'instructions' => $instructions,
        ])->save();
    }

    private function mapBinancePayStatus(string $providerStatus): string
    {
        $status = strtoupper(trim($providerStatus));

        if (in_array($status, ['PAID', 'COMPLETED'], true)) {
            return 'completed';
        }

        if (in_array($status, ['CANCELED', 'CANCELLED', 'EXPIRED', 'ERROR', 'FAIL'], true)) {
            return 'failed';
        }

        return 'processing';
    }

    private function mapHeleketPaymentStatus(string $providerStatus): string
    {
        $status = strtolower(trim($providerStatus));

        if (in_array($status, ['paid', 'paid_over'], true)) {
            return 'completed';
        }

        if (in_array($status, ['fail', 'wrong_amount', 'system_fail', 'cancelled', 'canceled'], true)) {
            return 'failed';
        }

        return 'processing';
    }

    private function mapHeleketPayoutStatus(string $providerStatus): string
    {
        $status = strtolower(trim($providerStatus));

        if (in_array($status, ['success', 'paid'], true)) {
            return 'completed';
        }

        if (in_array($status, ['fail', 'failed', 'cancel', 'canceled', 'system_fail', 'error', 'expired', 'rejected'], true)) {
            return 'failed';
        }

        return 'processing';
    }
}

