<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Wallet;
use App\Models\Withdrawal;
use App\Services\HeleketService;
use App\Services\ProviderWebhookReliabilityService;
use App\Services\WalletLedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class WithdrawController extends Controller
{
    public function options(Request $request, HeleketService $heleket): JsonResponse
    {
        $wallets = $request->user()
            ->wallets()
            ->orderByRaw("FIELD(currency, 'usd', 'usdt', 'sol')")
            ->get(['id', 'currency', 'balance', 'is_active']);

        $heleketOption = $this->buildHeleketPayoutMethodOption($heleket);

        return response()->json([
            'methods' => [
                $heleketOption,
                [
                    'key' => 'crypto_wallet',
                    'label' => 'Manual crypto withdrawal',
                    'description' => 'Withdraw to an external blockchain wallet address.',
                    'supported_currencies' => ['USD', 'USDT', 'SOL'],
                    'networks' => [
                        'USD' => ['TRC20', 'SOL'],
                        'USDT' => ['TRC20', 'SOL'],
                        'SOL' => ['SOL'],
                    ],
                ],
            ],
            'wallets' => $wallets->map(fn (Wallet $wallet): array => [
                'id' => $wallet->id,
                'currency' => strtoupper($wallet->currency),
                'balance' => (float) $wallet->balance,
                'is_active' => $wallet->is_active,
            ]),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $withdrawals = Withdrawal::query()
            ->where('user_id', $request->user()->id)
            ->with('wallet:id,currency')
            ->latest('id')
            ->paginate((int) min(max((int) $request->integer('per_page', 20), 1), 100));

        return response()->json([
            'data' => $withdrawals->getCollection()->map(fn (Withdrawal $withdrawal): array => $this->transform($withdrawal)),
            'meta' => [
                'current_page' => $withdrawals->currentPage(),
                'last_page' => $withdrawals->lastPage(),
                'per_page' => $withdrawals->perPage(),
                'total' => $withdrawals->total(),
            ],
        ]);
    }

    public function show(Request $request, Withdrawal $withdrawal): JsonResponse
    {
        abort_unless($withdrawal->user_id === $request->user()->id, 404);

        $withdrawal->loadMissing('wallet:id,currency');

        return response()->json([
            'withdrawal' => $this->transform($withdrawal, true),
        ]);
    }

    public function store(
        Request $request,
        WalletLedgerService $ledger,
        HeleketService $heleket
    ): JsonResponse {
        $data = $request->validate([
            'wallet_id' => ['required', 'integer'],
            'method' => ['required', 'in:crypto_wallet,heleket'],
            'network' => ['required', 'string', 'max:20'],
            'destination_address' => ['required', 'string', 'min:12', 'max:180'],
            'recipient_name' => ['nullable', 'string', 'max:120'],
            'amount' => ['required', 'numeric', 'min:0.00000001', 'max:10000000'],
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

        $wallet = Wallet::query()
            ->where('id', $data['wallet_id'])
            ->where('user_id', $user->id)
            ->first();

        if (! $wallet) {
            throw ValidationException::withMessages([
                'wallet_id' => 'Wallet not found.',
            ]);
        }

        if (! $wallet->is_active) {
            throw ValidationException::withMessages([
                'wallet_id' => 'Wallet is inactive.',
            ]);
        }

        if (! $this->supportsMethod($wallet->currency, $data['method'])) {
            throw ValidationException::withMessages([
                'method' => 'Selected withdrawal method does not support this wallet currency.',
            ]);
        }

        $network = strtoupper(trim((string) $data['network']));
        $allowedNetworks = $this->allowedNetworks($wallet->currency);
        if (! in_array($network, $allowedNetworks, true)) {
            throw ValidationException::withMessages([
                'network' => 'Selected network is not available for this wallet.',
            ]);
        }

        $amount = round((float) $data['amount'], 8);
        $reference = $ledger->makeReference('WDR');

        $fee = $this->calculateFee($wallet->currency, $amount);
        $instructions = null;

        if ($data['method'] === 'heleket') {
            try {
                [$fee, $instructions] = $this->buildHeleketQuoteInstructions(
                    heleket: $heleket,
                    walletCurrency: $wallet->currency,
                    amount: $amount,
                    network: $network,
                    destinationAddress: trim((string) $data['destination_address']),
                    reference: $reference,
                );
            } catch (RuntimeException $exception) {
                throw ValidationException::withMessages([
                    'method' => $exception->getMessage(),
                ]);
            }
        }

        $fee = round($fee, 8);
        $netAmount = $amount;
        $totalDebit = round($amount + $fee, 8);

        if ($totalDebit <= 0) {
            throw ValidationException::withMessages([
                'amount' => 'Amount is too low after fee deduction.',
            ]);
        }

        $withdrawal = DB::transaction(function () use (
            $wallet,
            $user,
            $data,
            $amount,
            $fee,
            $netAmount,
            $totalDebit,
            $reference,
            $network,
            $instructions,
            $ledger
        ) {
            $withdrawal = Withdrawal::query()->create([
                'user_id' => $user->id,
                'wallet_id' => $wallet->id,
                'method' => $data['method'],
                'destination_label' => $network,
                'destination_value' => trim((string) $data['destination_address']),
                'recipient_name' => $data['recipient_name'] ?? ($user->full_name ?: $user->name),
                'amount' => $amount,
                'fee' => $fee,
                'net_amount' => $netAmount,
                'status' => 'processing',
                'reference' => $reference,
                'note' => $data['note'] ?? null,
                'instructions' => $instructions,
            ]);

            $ledger->debit(
                wallet: $wallet,
                type: 'withdraw',
                amount: $amount,
                fee: $fee,
                context: [
                    'related' => $withdrawal,
                    'reference' => $reference,
                    'description' => "Withdrawal to {$network} address",
                    'meta' => [
                        'network' => $network,
                        'method' => $data['method'],
                        'destination' => trim((string) $data['destination_address']),
                        'total_debit' => $totalDebit,
                    ],
                ],
            );

            return $withdrawal;
        });

        if ($withdrawal->method === 'heleket') {
            $this->dispatchHeleketPayout(
                withdrawalId: (int) $withdrawal->id,
                ledger: $ledger,
                heleket: $heleket,
            );
        }

        $withdrawal = Withdrawal::query()
            ->with('wallet:id,currency')
            ->findOrFail($withdrawal->id);

        return response()->json([
            'message' => $withdrawal->status === 'failed'
                ? 'Withdrawal failed and amount refunded to wallet.'
                : 'Withdrawal request submitted successfully.',
            'withdrawal' => $this->transform($withdrawal, true),
        ], 201);
    }

    public function heleketWebhook(
        Request $request,
        WalletLedgerService $ledger,
        HeleketService $heleket,
        ProviderWebhookReliabilityService $webhookReliability
    ): JsonResponse {
        $payload = $request->json()->all();
        if (! is_array($payload)) {
            return response()->json([
                'message' => 'Invalid Heleket payout webhook payload.',
            ], 422);
        }

        if (! $heleket->verifyPayoutWebhookSignature($payload)) {
            return response()->json([
                'message' => 'Invalid Heleket payout signature.',
            ], 401);
        }

        $orderId = trim((string) ($payload['order_id'] ?? ''));
        $payoutUuid = trim((string) ($payload['uuid'] ?? ''));

        if ($orderId === '' && $payoutUuid === '') {
            return response()->json([
                'message' => 'Webhook accepted. Missing payout identifiers.',
            ], 202);
        }

        [$webhookLog, $duplicate] = $webhookReliability->registerIncoming(
            provider: 'heleket',
            payload: $payload,
            eventKey: $orderId !== '' ? $orderId : $payoutUuid,
            topic: 'withdrawal',
        );

        if ($duplicate && in_array($webhookLog->process_status, ['processed', 'ignored'], true)) {
            return response()->json([
                'message' => 'Duplicate Heleket payout webhook ignored.',
            ], 202);
        }

        $webhookReliability->markProcessing($webhookLog);

        try {
            $updatedWithdrawal = DB::transaction(function () use (
                $orderId,
                $payoutUuid,
                $payload,
                $ledger
            ): ?Withdrawal {
                $query = Withdrawal::query()
                    ->with('wallet:id,user_id,currency,is_active')
                    ->lockForUpdate()
                    ->where('method', 'heleket');

                if ($orderId !== '') {
                    $query->where('reference', $orderId);
                } else {
                    $query->where('instructions->provider->payout_uuid', $payoutUuid);
                }

                $withdrawal = $query->latest('id')->first();
                if (! $withdrawal instanceof Withdrawal) {
                    return null;
                }

                $instructions = is_array($withdrawal->instructions) ? $withdrawal->instructions : [];
                $events = $instructions['provider_webhook_events'] ?? [];
                if (! is_array($events)) {
                    $events = [];
                }
                $events[] = [
                    'received_at' => now()->toIso8601String(),
                    'status' => strtolower(trim((string) ($payload['status'] ?? ''))),
                    'payload' => $payload,
                ];
                $instructions['provider_webhook_events'] = $events;

                $provider = is_array($instructions['provider'] ?? null) ? $instructions['provider'] : [];
                $provider['last_webhook_status'] = strtolower(trim((string) ($payload['status'] ?? '')));
                $provider['last_webhook_payload'] = $payload;
                if ($payoutUuid !== '') {
                    $provider['payout_uuid'] = $payoutUuid;
                }
                if ($orderId !== '') {
                    $provider['order_id'] = $orderId;
                }
                $instructions['provider'] = $provider;

                $mappedStatus = $this->mapHeleketPayoutStatus((string) ($payload['status'] ?? ''));

                if ($mappedStatus === 'failed' && $withdrawal->status !== 'completed') {
                    $this->markWithdrawalFailedAndRefund(
                        withdrawal: $withdrawal,
                        ledger: $ledger,
                        reason: 'Heleket payout marked as failed.',
                        providerPayload: $payload,
                        instructions: $instructions,
                    );

                    return $withdrawal;
                }

                if ($mappedStatus === 'completed' && in_array($withdrawal->status, ['processing', 'pending'], true)) {
                    $withdrawal->forceFill([
                        'status' => 'completed',
                        'completed_at' => now(),
                        'instructions' => $instructions,
                    ])->save();

                    return $withdrawal;
                }

                if ($mappedStatus === 'processing' && in_array($withdrawal->status, ['pending', 'processing'], true)) {
                    $withdrawal->forceFill([
                        'status' => 'processing',
                        'instructions' => $instructions,
                    ])->save();

                    return $withdrawal;
                }

                $withdrawal->forceFill([
                    'instructions' => $instructions,
                ])->save();

                return $withdrawal;
            });

            if (! $updatedWithdrawal instanceof Withdrawal) {
                $webhookReliability->markProcessed($webhookLog, 'ignored', 'No matching Heleket payout withdrawal found.');

                return response()->json([
                    'message' => 'Webhook accepted. No matching Heleket payout withdrawal found.',
                ], 202);
            }

            $updatedWithdrawal->loadMissing('wallet:id,currency');
            $webhookReliability->markProcessed($webhookLog, 'processed', 'Heleket payout webhook synchronized.');

            return response()->json([
                'message' => 'Heleket payout webhook synchronized.',
                'withdrawal' => $this->transform($updatedWithdrawal, true),
            ]);
        } catch (Throwable $exception) {
            $webhookReliability->markFailed($webhookLog, $exception->getMessage());

            throw $exception;
        }
    }

    private function dispatchHeleketPayout(
        int $withdrawalId,
        WalletLedgerService $ledger,
        HeleketService $heleket
    ): void {
        $withdrawal = Withdrawal::query()
            ->with('wallet:id,user_id,currency,is_active')
            ->findOrFail($withdrawalId);

        $walletCurrency = strtolower((string) optional($withdrawal->wallet)->currency);
        $network = strtoupper((string) $withdrawal->destination_label);
        [$providerCurrency, $providerToCurrency, $providerNetwork] = $this->resolveHeleketProviderParams(
            walletCurrency: $walletCurrency,
            network: $network,
        );

        try {
            $payout = $heleket->createPayout(
                amount: (float) $withdrawal->amount,
                currency: $providerCurrency,
                orderId: $withdrawal->reference,
                address: $withdrawal->destination_value,
                network: $providerNetwork,
                options: [
                    'is_subtract' => true,
                    'to_currency' => $providerToCurrency,
                    'memo' => 'NoorFi withdrawal ' . $withdrawal->reference,
                ],
            );
        } catch (RuntimeException $exception) {
            DB::transaction(function () use ($withdrawalId, $ledger, $exception): void {
                $lockedWithdrawal = Withdrawal::query()
                    ->with('wallet:id,user_id,currency,is_active')
                    ->lockForUpdate()
                    ->findOrFail($withdrawalId);

                $this->markWithdrawalFailedAndRefund(
                    withdrawal: $lockedWithdrawal,
                    ledger: $ledger,
                    reason: $exception->getMessage(),
                    providerPayload: [
                        'provider' => 'heleket',
                        'error' => $exception->getMessage(),
                    ],
                );
            });

            return;
        }

        DB::transaction(function () use ($withdrawalId, $payout, $ledger): void {
            $lockedWithdrawal = Withdrawal::query()
                ->with('wallet:id,user_id,currency,is_active')
                ->lockForUpdate()
                ->findOrFail($withdrawalId);

            $instructions = is_array($lockedWithdrawal->instructions) ? $lockedWithdrawal->instructions : [];
            $provider = is_array($instructions['provider'] ?? null) ? $instructions['provider'] : [];
            $provider['provider'] = 'heleket';
            $provider['order_id'] = (string) (data_get($payout, 'order_id') ?: $lockedWithdrawal->reference);
            $provider['payout_uuid'] = (string) data_get($payout, 'uuid', '');
            $provider['status'] = strtolower(trim((string) data_get($payout, 'status', 'process')));
            $provider['currency'] = (string) data_get($payout, 'currency', '');
            $provider['network'] = (string) data_get($payout, 'network', '');
            $provider['amount'] = (float) data_get($payout, 'amount', (float) $lockedWithdrawal->amount);
            $provider['payer_amount'] = (float) data_get($payout, 'payer_amount', (float) $lockedWithdrawal->amount);
            $provider['merchant_amount'] = (float) data_get($payout, 'merchant_amount', (float) $lockedWithdrawal->amount + (float) $lockedWithdrawal->fee);
            $provider['commission'] = (float) data_get($payout, 'commission', (float) $lockedWithdrawal->fee);
            $provider['raw'] = $payout;
            $instructions['provider'] = $provider;

            $events = $instructions['provider_events'] ?? [];
            if (! is_array($events)) {
                $events = [];
            }
            $events[] = [
                'created_at' => now()->toIso8601String(),
                'event' => 'payout_created',
                'payload' => $payout,
            ];
            $instructions['provider_events'] = $events;

            $mappedStatus = $this->mapHeleketPayoutStatus((string) data_get($payout, 'status', 'process'));
            if ($mappedStatus === 'failed') {
                $this->markWithdrawalFailedAndRefund(
                    withdrawal: $lockedWithdrawal,
                    ledger: $ledger,
                    reason: 'Heleket payout rejected by provider.',
                    providerPayload: $payout,
                    instructions: $instructions,
                );

                return;
            }

            $lockedWithdrawal->forceFill([
                'status' => $mappedStatus,
                'completed_at' => $mappedStatus === 'completed' ? now() : null,
                'instructions' => $instructions,
            ])->save();
        });
    }

    private function markWithdrawalFailedAndRefund(
        Withdrawal $withdrawal,
        WalletLedgerService $ledger,
        string $reason,
        array $providerPayload = [],
        ?array $instructions = null
    ): void {
        $nextInstructions = is_array($instructions) ? $instructions : (is_array($withdrawal->instructions) ? $withdrawal->instructions : []);

        $failures = $nextInstructions['provider_failures'] ?? [];
        if (! is_array($failures)) {
            $failures = [];
        }
        $failures[] = [
            'at' => now()->toIso8601String(),
            'reason' => $reason,
            'payload' => $providerPayload,
        ];
        $nextInstructions['provider_failures'] = $failures;

        $refund = is_array($nextInstructions['refund'] ?? null) ? $nextInstructions['refund'] : [];
        $refundApplied = (bool) ($refund['applied'] ?? false);

        if (! $refundApplied) {
            $wallet = $withdrawal->wallet;
            if ($wallet && $wallet->user_id === $withdrawal->user_id) {
                $refundAmount = round((float) $withdrawal->amount + (float) $withdrawal->fee, 8);
                $refundReference = "{$withdrawal->reference}-RF";

                if ($refundAmount > 0) {
                    $ledger->credit(
                        wallet: $wallet,
                        type: 'withdraw_refund',
                        amount: $refundAmount,
                        fee: 0.0,
                        context: [
                            'related' => $withdrawal,
                            'reference' => $refundReference,
                            'description' => 'Withdrawal refunded after provider failure',
                            'meta' => [
                                'provider' => 'heleket',
                                'reason' => $reason,
                                'source_reference' => $withdrawal->reference,
                            ],
                        ],
                    );
                }

                $nextInstructions['refund'] = [
                    'applied' => true,
                    'amount' => $refundAmount,
                    'reference' => $refundReference,
                    'at' => now()->toIso8601String(),
                    'reason' => $reason,
                ];
            } else {
                $nextInstructions['refund'] = [
                    'applied' => false,
                    'reason' => 'Wallet not found for refund.',
                    'at' => now()->toIso8601String(),
                ];
            }
        }

        $withdrawal->forceFill([
            'status' => 'failed',
            'completed_at' => now(),
            'instructions' => $nextInstructions,
        ])->save();
    }

    /**
     * @return array{0: float, 1: array<string, mixed>}
     */
    private function buildHeleketQuoteInstructions(
        HeleketService $heleket,
        string $walletCurrency,
        float $amount,
        string $network,
        string $destinationAddress,
        string $reference
    ): array {
        [$providerCurrency, $providerToCurrency, $providerNetwork] = $this->resolveHeleketProviderParams(
            walletCurrency: strtolower($walletCurrency),
            network: $network,
        );

        $quote = $heleket->calculatePayout(
            amount: $amount,
            currency: $providerCurrency,
            address: $destinationAddress,
            network: $providerNetwork,
            options: [
                'is_subtract' => true,
                'to_currency' => $providerToCurrency,
            ],
        );

        $merchantAmount = round((float) data_get($quote, 'merchant_amount', 0), 8);
        $commission = round((float) data_get($quote, 'commission', 0), 8);
        $fee = $merchantAmount > 0
            ? round(max($merchantAmount - $amount, 0.0), 8)
            : max($commission, 0.0);

        $instructions = [
            'provider' => [
                'provider' => 'heleket',
                'status' => 'quote_created',
                'order_id' => $reference,
                'network' => $providerNetwork,
                'currency' => $providerCurrency,
                'to_currency' => $providerToCurrency,
                'quote' => [
                    'merchant_amount' => $merchantAmount,
                    'commission' => $commission,
                    'payer_amount' => (float) data_get($quote, 'payer_amount', $amount),
                    'raw' => $quote,
                ],
            ],
        ];

        return [$fee, $instructions];
    }

    /**
     * @return array{0: string, 1: ?string, 2: string}
     */
    private function resolveHeleketProviderParams(string $walletCurrency, string $network): array
    {
        $normalizedCurrency = strtolower(trim($walletCurrency));
        $normalizedNetwork = strtoupper(trim($network));

        $providerNetwork = match ($normalizedNetwork) {
            'TRC20' => 'TRON',
            default => $normalizedNetwork,
        };

        if ($normalizedCurrency === 'usd') {
            return match ($providerNetwork) {
                'TRON' => ['USD', 'USDT', 'TRON'],
                'SOL' => ['USD', 'SOL', 'SOL'],
                default => ['USD', null, $providerNetwork],
            };
        }

        if ($normalizedCurrency === 'usdt') {
            return ['USDT', null, $providerNetwork];
        }

        if ($normalizedCurrency === 'sol') {
            return ['SOL', null, 'SOL'];
        }

        return [strtoupper($normalizedCurrency), null, $providerNetwork];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildHeleketPayoutMethodOption(HeleketService $heleket): array
    {
        $fallback = [
            'key' => 'heleket',
            'label' => 'Instant payout',
            'description' => 'Heleket payout gateway with provider-level tracking.',
            'supported_currencies' => ['USD', 'USDT', 'SOL'],
            'networks' => [
                'USD' => ['TRC20', 'SOL'],
                'USDT' => ['TRC20', 'SOL'],
                'SOL' => ['SOL'],
            ],
            'provider_source' => 'fallback',
            'provider_services' => [],
            'limits' => [],
        ];

        try {
            $services = $heleket->payoutServices();
        } catch (RuntimeException) {
            return $fallback;
        }

        $normalized = $this->normalizeHeleketPayoutServiceList($services);
        if ($normalized === []) {
            return $fallback;
        }

        $supported = [];
        $networks = [];
        $limits = [];

        foreach ($normalized as $service) {
            if (! $service['is_available']) {
                continue;
            }

            $currency = $service['currency'];
            $network = $service['network'];
            $supported[$currency] = true;
            $networks[$currency] ??= [];
            if (! in_array($network, $networks[$currency], true)) {
                $networks[$currency][] = $network;
            }

            $limits[$currency] ??= [
                'min_amount' => $service['min_amount'],
                'max_amount' => $service['max_amount'],
                'fee_amount' => $service['fee_amount'],
                'fee_percent' => $service['fee_percent'],
            ];

            $limits[$currency]['min_amount'] = min($limits[$currency]['min_amount'], $service['min_amount']);
            $limits[$currency]['max_amount'] = max($limits[$currency]['max_amount'], $service['max_amount']);
            $limits[$currency]['fee_amount'] = min($limits[$currency]['fee_amount'], $service['fee_amount']);
            $limits[$currency]['fee_percent'] = min($limits[$currency]['fee_percent'], $service['fee_percent']);
        }

        if ($supported === []) {
            return $fallback;
        }

        $supportedCurrencies = array_keys($supported);
        sort($supportedCurrencies);
        foreach ($networks as &$networkList) {
            sort($networkList);
        }

        return [
            'key' => 'heleket',
            'label' => 'Instant payout',
            'description' => 'Live provider routes with dynamic network, limits and commission.',
            'supported_currencies' => $supportedCurrencies,
            'networks' => $networks,
            'provider_source' => 'live',
            'provider_services' => $normalized,
            'limits' => $limits,
            'updated_at' => now()->toIso8601String(),
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $services
     * @return array<int, array<string, mixed>>
     */
    private function normalizeHeleketPayoutServiceList(array $services): array
    {
        $allowedCurrencies = ['USD', 'USDT', 'SOL'];
        $normalized = [];

        foreach ($services as $service) {
            $currency = strtoupper(trim((string) ($service['currency'] ?? '')));
            if (! in_array($currency, $allowedCurrencies, true)) {
                continue;
            }

            $networkRaw = strtoupper(trim((string) ($service['network'] ?? '')));
            $network = $this->mapHeleketNetworkCode($networkRaw);
            $limit = is_array($service['limit'] ?? null) ? $service['limit'] : [];
            $commission = is_array($service['commission'] ?? null) ? $service['commission'] : [];

            $normalized[] = [
                'currency' => $currency,
                'network' => $network,
                'network_raw' => $networkRaw !== '' ? $networkRaw : $network,
                'is_available' => filter_var($service['is_available'] ?? false, FILTER_VALIDATE_BOOLEAN),
                'min_amount' => max(0.0, $this->asFloat($limit['min_amount'] ?? 0)),
                'max_amount' => max(0.0, $this->asFloat($limit['max_amount'] ?? 0)),
                'fee_amount' => max(0.0, $this->asFloat($commission['fee_amount'] ?? 0)),
                'fee_percent' => max(0.0, $this->asFloat($commission['percent'] ?? 0)),
            ];
        }

        usort($normalized, static function (array $a, array $b): int {
            return [$a['currency'], $a['network']] <=> [$b['currency'], $b['network']];
        });

        return $normalized;
    }

    private function mapHeleketNetworkCode(string $network): string
    {
        return match (strtoupper(trim($network))) {
            'TRON' => 'TRC20',
            'ETH' => 'ERC20',
            'BSC' => 'BEP20',
            default => strtoupper(trim($network)),
        };
    }

    private function asFloat(mixed $value): float
    {
        if (is_float($value) || is_int($value)) {
            return (float) $value;
        }

        if (is_string($value) && trim($value) !== '') {
            return (float) $value;
        }

        return 0.0;
    }

    private function supportsMethod(string $currency, string $method): bool
    {
        $currency = strtolower($currency);

        return match ($method) {
            'crypto_wallet', 'heleket' => in_array($currency, ['usd', 'usdt', 'sol'], true),
            default => false,
        };
    }

    /**
     * @return array<int, string>
     */
    private function allowedNetworks(string $currency): array
    {
        return match (strtolower($currency)) {
            'sol' => ['SOL'],
            'usd', 'usdt' => ['TRC20', 'SOL'],
            default => ['TRC20'],
        };
    }

    private function calculateFee(string $currency, float $amount): float
    {
        return match (strtolower($currency)) {
            'usd' => round(max($amount * 0.0075, 1.0), 8),
            'usdt' => round(max($amount * 0.005, 0.8), 8),
            'sol' => round(max($amount * 0.0025, 0.0008), 8),
            default => round(max($amount * 0.01, 1.0), 8),
        };
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

    private function transform(Withdrawal $withdrawal, bool $verbose = false): array
    {
        $payload = [
            'id' => $withdrawal->id,
            'wallet_id' => $withdrawal->wallet_id,
            'currency' => strtoupper((string) optional($withdrawal->wallet)->currency),
            'method' => $withdrawal->method,
            'network' => $withdrawal->destination_label,
            'destination_address' => $withdrawal->destination_value,
            'recipient_name' => $withdrawal->recipient_name,
            'amount' => (float) $withdrawal->amount,
            'fee' => (float) $withdrawal->fee,
            'total_debit' => round((float) $withdrawal->amount + (float) $withdrawal->fee, 8),
            'net_amount' => (float) $withdrawal->net_amount,
            'status' => $withdrawal->status,
            'reference' => $withdrawal->reference,
            'completed_at' => $withdrawal->completed_at?->toIso8601String(),
            'created_at' => $withdrawal->created_at?->toIso8601String(),
        ];

        if ($verbose) {
            $payload['note'] = $withdrawal->note;
            $payload['instructions'] = $withdrawal->instructions;
        }

        return $payload;
    }
}
