<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Deposit;
use App\Models\User;
use App\Models\UserStaticWallet;
use App\Models\Wallet;
use App\Services\BinancePayService;
use App\Services\HeleketService;
use App\Services\ProviderWebhookReliabilityService;
use App\Services\WalletLedgerService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class DepositController extends Controller
{
    public function options(Request $request, HeleketService $heleket): JsonResponse
    {
        $wallets = $request->user()
            ->wallets()
            ->orderByRaw("FIELD(currency, 'usd', 'usdt', 'sol')")
            ->get(['id', 'currency', 'balance', 'is_active']);

        $heleketOption = $this->buildHeleketPaymentMethodOption($heleket);

        return response()->json([
            'methods' => [
                [
                    'key' => 'binance_pay',
                    'label' => 'Binance Pay',
                    'description' => 'Instant checkout via Binance Pay QR / deep-link with auto confirmation.',
                    'supported_currencies' => ['USD', 'USDT'],
                ],
                [
                    'key' => 'crypto_wallet',
                    'label' => 'Crypto Wallet',
                    'description' => 'Send on-chain funds to your generated deposit address.',
                    'supported_currencies' => ['USDT', 'SOL'],
                    'networks' => [
                        'USDT' => ['TRC20', 'SOL'],
                        'SOL' => ['SOL'],
                    ],
                ],
                $heleketOption,
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
        $deposits = Deposit::query()
            ->where('user_id', $request->user()->id)
            ->with('wallet:id,currency')
            ->latest('id')
            ->paginate((int) min(max((int) $request->integer('per_page', 20), 1), 100));

        return response()->json([
            'data' => $deposits->getCollection()->map(fn (Deposit $deposit): array => $this->transformDeposit($deposit)),
            'meta' => [
                'current_page' => $deposits->currentPage(),
                'last_page' => $deposits->lastPage(),
                'per_page' => $deposits->perPage(),
                'total' => $deposits->total(),
            ],
        ]);
    }

    public function show(Request $request, Deposit $deposit): JsonResponse
    {
        abort_unless($deposit->user_id === $request->user()->id, 404);

        $deposit->loadMissing('wallet:id,currency');

        return response()->json([
            'deposit' => $this->transformDeposit($deposit, true),
        ]);
    }

    public function sync(
        Request $request,
        Deposit $deposit,
        WalletLedgerService $ledger,
        BinancePayService $binancePay,
        HeleketService $heleket
    ): JsonResponse {
        abort_unless($deposit->user_id === $request->user()->id, 404);

        if ($deposit->status === 'completed' && $deposit->credited_at !== null) {
            $deposit->loadMissing('wallet:id,currency');

            return response()->json([
                'message' => 'Deposit already completed.',
                'deposit' => $this->transformDeposit($deposit, true),
            ]);
        }

        return match ($deposit->method) {
            'binance_pay' => $this->syncBinancePayDeposit($deposit, $ledger, $binancePay),
            'heleket' => $this->syncHeleketDeposit($deposit, $ledger, $heleket),
            'crypto_wallet' => response()->json([
                'message' => 'Crypto deposit is awaiting Heleket/blockchain confirmation.',
                'deposit' => $this->transformDeposit($deposit->loadMissing('wallet:id,currency'), true),
            ]),
            default => response()->json([
                'message' => 'Deposit sync is not available for this method yet.',
                'deposit' => $this->transformDeposit($deposit->loadMissing('wallet:id,currency'), true),
            ]),
        };
    }

    public function store(
        Request $request,
        WalletLedgerService $ledger,
        BinancePayService $binancePay,
        HeleketService $heleket
    ): JsonResponse
    {
        $data = $request->validate([
            'wallet_id' => ['required', 'integer'],
            'method' => ['required', 'in:binance_pay,crypto_wallet,heleket'],
            'amount' => ['required', 'numeric', 'min:1', 'max:10000000'],
            'network' => ['nullable', 'string', 'max:30'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();
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
                'wallet_id' => 'This wallet is inactive.',
            ]);
        }

        if (! $this->supportsMethod($wallet->currency, $data['method'])) {
            throw ValidationException::withMessages([
                'method' => 'Selected funding method does not support this wallet currency.',
            ]);
        }

        $amount = round((float) $data['amount'], 8);
        $fee = $data['method'] === 'binance_pay'
            ? round(max($amount * 0.0025, 0.25), 8)
            : 0.0;
        $net = round($amount - $fee, 8);

        if ($net <= 0) {
            throw ValidationException::withMessages([
                'amount' => 'Amount is too low after fee deduction.',
            ]);
        }

        $network = strtoupper(trim((string) ($data['network'] ?? '')));
        $reference = $ledger->makeReference('DEP');
        $instructions = match ($data['method']) {
            'heleket' => $this->buildHeleketInstructions(
                heleket: $heleket,
                currency: $wallet->currency,
                amount: $amount,
                reference: $reference,
                network: $network,
                userId: (int) $user->id,
            ),
            'binance_pay' => $this->buildBinancePayInstructions(
                binancePay: $binancePay,
                currency: $wallet->currency,
                amount: $amount,
                reference: $reference,
                userId: (int) $user->id,
            ),
            'crypto_wallet' => $this->buildCryptoWalletInstructions(
                heleket: $heleket,
                wallet: $wallet,
                amount: $amount,
                network: $network,
                reference: $reference,
            ),
            default => throw ValidationException::withMessages([
                'method' => 'Unsupported funding method.',
            ]),
        };

        $deposit = DB::transaction(function () use (
            $wallet,
            $data,
            $amount,
            $fee,
            $net,
            $instructions,
            $reference,
        ) {
            return Deposit::query()->create([
                'user_id' => $wallet->user_id,
                'wallet_id' => $wallet->id,
                'method' => $data['method'],
                'amount' => $amount,
                'fee' => $fee,
                'net_amount' => $net,
                'status' => 'pending',
                'reference' => $reference,
                'note' => $data['note'] ?? null,
                'instructions' => $instructions,
                'credited_at' => null,
            ]);
        });

        $deposit->loadMissing('wallet:id,currency');

        return response()->json([
            'message' => 'Deposit request created. Please complete the instructions.',
            'deposit' => $this->transformDeposit($deposit, true),
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
                'message' => 'Invalid Heleket webhook payload.',
            ], 422);
        }

        if (! $heleket->verifyWebhookSignature($payload)) {
            return response()->json([
                'message' => 'Invalid Heleket signature.',
            ], 401);
        }

        $orderId = trim((string) ($payload['order_id'] ?? ''));
        $invoiceUuid = trim((string) ($payload['uuid'] ?? ''));
        $walletAddressUuid = trim((string) ($payload['wallet_address_uuid'] ?? ''));
        $webhookType = strtolower(trim((string) ($payload['type'] ?? '')));

        if ($orderId === '' && $invoiceUuid === '' && $walletAddressUuid === '') {
            return response()->json([
                'message' => 'Webhook accepted. Missing provider identifiers.',
            ], 202);
        }

        $eventKey = $walletAddressUuid !== ''
            ? $walletAddressUuid
            : ($orderId !== '' ? $orderId : $invoiceUuid);

        [$webhookLog, $duplicate] = $webhookReliability->registerIncoming(
            provider: 'heleket',
            payload: $payload,
            eventKey: $eventKey,
            topic: 'deposit',
        );

        if ($duplicate && in_array($webhookLog->process_status, ['processed', 'ignored'], true)) {
            return response()->json([
                'message' => 'Duplicate Heleket webhook ignored.',
            ], 202);
        }

        $webhookReliability->markProcessing($webhookLog);

        try {
            [$lockedDeposit, $creditedNow] = DB::transaction(function () use (
                $orderId,
                $invoiceUuid,
                $walletAddressUuid,
                $webhookType,
                $payload,
                $ledger
            ): array {
                $lockedDeposit = $this->findDepositForHeleketWebhook(
                    orderId: $orderId,
                    invoiceUuid: $invoiceUuid,
                    walletAddressUuid: $walletAddressUuid,
                    webhookType: $webhookType,
                );
                if (! $lockedDeposit instanceof Deposit) {
                    return [null, false];
                }

                $providerStatus = strtolower(trim((string) ($payload['status'] ?? '')));
                $isFinal = filter_var($payload['is_final'] ?? false, FILTER_VALIDATE_BOOLEAN);
                $mappedStatus = $this->mapHeleketStatus($providerStatus, (bool) $isFinal);

                $instructions = is_array($lockedDeposit->instructions) ? $lockedDeposit->instructions : [];
                $provider = is_array($instructions['provider'] ?? null) ? $instructions['provider'] : [];
                $provider['provider'] = 'heleket';
                $provider['last_status'] = $providerStatus;
                $provider['last_payload'] = $payload;
                if ($orderId !== '') {
                    $provider['order_id'] = $orderId;
                }
                if ($invoiceUuid !== '') {
                    if ($lockedDeposit->method === 'crypto_wallet') {
                        $provider['payment_uuid'] = $invoiceUuid;
                    } else {
                        $provider['invoice_uuid'] = $invoiceUuid;
                    }
                }
                if ($walletAddressUuid !== '') {
                    $provider['wallet_address_uuid'] = $walletAddressUuid;
                }
                $instructions['provider'] = $provider;

                $webhookHistory = $instructions['provider_webhook_events'] ?? [];
                if (! is_array($webhookHistory)) {
                    $webhookHistory = [];
                }
                $webhookHistory[] = [
                    'received_at' => now()->toIso8601String(),
                    'status' => $providerStatus,
                    'is_final' => (bool) $isFinal,
                    'payload' => $payload,
                ];
                $instructions['provider_webhook_events'] = $webhookHistory;
                $instructions['provider_last_status'] = $providerStatus;
                $instructions['provider_last_is_final'] = (bool) $isFinal;

                if (in_array($providerStatus, ['paid', 'paid_over'], true)) {
                    if ($lockedDeposit->status === 'completed' && $lockedDeposit->credited_at !== null) {
                        $lockedDeposit->forceFill([
                            'instructions' => $instructions,
                        ])->save();

                        return [$lockedDeposit, false];
                    }

                    if (! in_array($lockedDeposit->status, ['pending', 'processing'], true)) {
                        throw ValidationException::withMessages([
                            'deposit' => 'Only pending/processing Heleket deposits can be finalized.',
                        ]);
                    }

                    $wallet = $lockedDeposit->wallet;
                    if (! $wallet || $wallet->user_id !== $lockedDeposit->user_id) {
                        throw ValidationException::withMessages([
                            'wallet_id' => 'Deposit wallet is invalid.',
                        ]);
                    }

                    if (! $wallet->is_active) {
                        throw ValidationException::withMessages([
                            'wallet_id' => 'Deposit wallet is inactive.',
                        ]);
                    }

                    $creditAmount = (float) $lockedDeposit->amount;
                    if ($lockedDeposit->method === 'crypto_wallet') {
                        $receivedAmount = $this->extractHeleketWebhookAmount($payload);
                        if ($receivedAmount > 0) {
                            $creditAmount = $receivedAmount;
                            $lockedDeposit->amount = round($receivedAmount, 8);
                            $lockedDeposit->net_amount = round(max($receivedAmount - (float) $lockedDeposit->fee, 0), 8);
                            $instructions['amount'] = $lockedDeposit->amount;
                        }
                    }

                    $ledger->credit(
                        wallet: $wallet,
                        type: 'deposit',
                        amount: $creditAmount,
                        fee: (float) $lockedDeposit->fee,
                        context: [
                            'related' => $lockedDeposit,
                            'reference' => "{$lockedDeposit->reference}-C",
                            'description' => 'Deposit confirmed by Heleket webhook',
                            'meta' => [
                                'provider' => 'heleket',
                                'provider_status' => $providerStatus,
                                'provider_payload' => $payload,
                            ],
                        ],
                    );

                    $lockedDeposit->forceFill([
                        'status' => 'completed',
                        'credited_at' => now(),
                        'instructions' => $instructions,
                    ])->save();

                    $lockedDeposit->loadMissing('wallet:id,currency');

                    return [$lockedDeposit, true];
                }

                if ($lockedDeposit->status !== 'completed') {
                    $lockedDeposit->forceFill([
                        'status' => $mappedStatus,
                        'instructions' => $instructions,
                    ])->save();
                } else {
                    $lockedDeposit->forceFill([
                        'instructions' => $instructions,
                    ])->save();
                }

                $lockedDeposit->loadMissing('wallet:id,currency');

                return [$lockedDeposit, false];
            });

            if (! $lockedDeposit instanceof Deposit) {
                $webhookReliability->markProcessed($webhookLog, 'ignored', 'No matching Heleket deposit found.');

                return response()->json([
                    'message' => 'Webhook accepted. No matching Heleket deposit found.',
                ], 202);
            }

            $webhookReliability->markProcessed(
                $webhookLog,
                'processed',
                $creditedNow
                    ? 'Deposit credited from Heleket webhook.'
                    : 'Heleket deposit status synchronized.'
            );

            return response()->json([
                'message' => $creditedNow
                    ? 'Heleket payment confirmed and wallet credited.'
                    : 'Heleket payment status synchronized.',
                'deposit' => $this->transformDeposit($lockedDeposit, true),
            ]);
        } catch (Throwable $exception) {
            $webhookReliability->markFailed($webhookLog, $exception->getMessage());

            throw $exception;
        }
    }

    public function confirm(
        Request $request,
        Deposit $deposit,
        WalletLedgerService $ledger
    ): JsonResponse {
        abort_unless(
            $request->user() instanceof User
                && $request->user()->hasAnyPanelRole([
                    User::ADMIN_ROLE_SUPER_ADMIN,
                    User::ADMIN_ROLE_OPERATIONS,
                ]),
            403,
            'Only operations admins can confirm deposits.'
        );

        $data = $request->validate([
            'provider_reference' => ['nullable', 'string', 'max:120'],
            'provider_tx_hash' => ['nullable', 'string', 'max:191'],
            'provider_payload' => ['nullable', 'array'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $adminUserId = (int) $request->user()->id;

        [$lockedDeposit, $creditedNow] = DB::transaction(function () use ($deposit, $data, $ledger, $adminUserId): array {
            $lockedDeposit = Deposit::query()
                ->with('wallet:id,user_id,currency,is_active')
                ->lockForUpdate()
                ->findOrFail($deposit->id);

            if ($lockedDeposit->status === 'completed' && $lockedDeposit->credited_at !== null) {
                return [$lockedDeposit, false];
            }

            if (! in_array($lockedDeposit->status, ['pending', 'processing'], true)) {
                throw ValidationException::withMessages([
                    'deposit' => 'Only pending deposits can be confirmed.',
                ]);
            }

            $wallet = $lockedDeposit->wallet;
            if (! $wallet || $wallet->user_id !== $lockedDeposit->user_id) {
                throw ValidationException::withMessages([
                    'wallet_id' => 'Deposit wallet is invalid.',
                ]);
            }

            if (! $wallet->is_active) {
                throw ValidationException::withMessages([
                    'wallet_id' => 'Deposit wallet is inactive.',
                ]);
            }

            $confirmationMeta = array_filter([
                'provider_reference' => $data['provider_reference'] ?? null,
                'provider_tx_hash' => $data['provider_tx_hash'] ?? null,
                'confirmed_by_user_id' => $adminUserId,
                'confirmed_at' => now()->toIso8601String(),
                'provider_payload' => $data['provider_payload'] ?? null,
            ], static fn ($value): bool => $value !== null && $value !== '');

            $ledger->credit(
                wallet: $wallet,
                type: 'deposit',
                amount: (float) $lockedDeposit->amount,
                fee: (float) $lockedDeposit->fee,
                context: [
                    'related' => $lockedDeposit,
                    'reference' => "{$lockedDeposit->reference}-C",
                    'description' => 'Deposit confirmed by admin',
                    'meta' => $confirmationMeta,
                ],
            );

            $instructions = is_array($lockedDeposit->instructions) ? $lockedDeposit->instructions : [];
            $instructions['provider_confirmation'] = $confirmationMeta;

            $lockedDeposit->forceFill([
                'status' => 'completed',
                'credited_at' => now(),
                'note' => $data['note'] ?? $lockedDeposit->note,
                'instructions' => $instructions,
            ])->save();

            $lockedDeposit->loadMissing('wallet:id,currency');

            return [$lockedDeposit, true];
        });

        return response()->json([
            'message' => $creditedNow
                ? 'Deposit confirmed and wallet credited.'
                : 'Deposit already confirmed.',
            'deposit' => $this->transformDeposit($lockedDeposit, true),
        ]);
    }

    private function syncBinancePayDeposit(
        Deposit $deposit,
        WalletLedgerService $ledger,
        BinancePayService $binancePay
    ): JsonResponse {
        try {
            $order = $binancePay->queryOrderByMerchantTradeNo($deposit->reference);
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages([
                'deposit' => $exception->getMessage(),
            ]);
        }

        $providerStatus = strtoupper(trim((string) data_get($order, 'status', 'INITIAL')));
        $mappedStatus = $this->mapBinancePayStatus($providerStatus);

        [$lockedDeposit, $creditedNow] = DB::transaction(function () use (
            $deposit,
            $order,
            $providerStatus,
            $mappedStatus,
            $ledger
        ): array {
            $lockedDeposit = Deposit::query()
                ->with('wallet:id,user_id,currency,is_active')
                ->lockForUpdate()
                ->findOrFail($deposit->id);

            $instructions = is_array($lockedDeposit->instructions) ? $lockedDeposit->instructions : [];
            $provider = is_array($instructions['provider'] ?? null) ? $instructions['provider'] : [];
            $provider['order_status'] = $providerStatus;
            $provider['last_sync_at'] = now()->toIso8601String();
            $provider['last_sync_payload'] = $order;
            $instructions['provider'] = $provider;

            if ($mappedStatus === 'completed') {
                if ($lockedDeposit->status === 'completed' && $lockedDeposit->credited_at !== null) {
                    $lockedDeposit->forceFill([
                        'instructions' => $instructions,
                    ])->save();

                    return [$lockedDeposit, false];
                }

                $wallet = $lockedDeposit->wallet;
                if (! $wallet || $wallet->user_id !== $lockedDeposit->user_id) {
                    throw ValidationException::withMessages([
                        'wallet_id' => 'Deposit wallet is invalid.',
                    ]);
                }

                if (! $wallet->is_active) {
                    throw ValidationException::withMessages([
                        'wallet_id' => 'Deposit wallet is inactive.',
                    ]);
                }

                $ledger->credit(
                    wallet: $wallet,
                    type: 'deposit',
                    amount: (float) $lockedDeposit->amount,
                    fee: (float) $lockedDeposit->fee,
                    context: [
                        'related' => $lockedDeposit,
                        'reference' => "{$lockedDeposit->reference}-C",
                        'description' => 'Deposit confirmed by Binance Pay sync',
                        'meta' => [
                            'provider' => 'binance_pay',
                            'provider_status' => $providerStatus,
                            'provider_payload' => $order,
                        ],
                    ],
                );

                $lockedDeposit->forceFill([
                    'status' => 'completed',
                    'credited_at' => now(),
                    'instructions' => $instructions,
                ])->save();

                return [$lockedDeposit, true];
            }

            if ($lockedDeposit->status !== 'completed') {
                $lockedDeposit->forceFill([
                    'status' => $mappedStatus,
                    'instructions' => $instructions,
                ])->save();
            } else {
                $lockedDeposit->forceFill([
                    'instructions' => $instructions,
                ])->save();
            }

            return [$lockedDeposit, false];
        });

        $lockedDeposit->loadMissing('wallet:id,currency');

        return response()->json([
            'message' => $creditedNow
                ? 'Binance Pay payment confirmed and wallet credited.'
                : 'Binance Pay payment status synchronized.',
            'deposit' => $this->transformDeposit($lockedDeposit, true),
        ]);
    }

    private function syncHeleketDeposit(
        Deposit $deposit,
        WalletLedgerService $ledger,
        HeleketService $heleket
    ): JsonResponse {
        try {
            $invoice = $heleket->paymentInfoByOrderId($deposit->reference);
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages([
                'deposit' => $exception->getMessage(),
            ]);
        }

        $providerStatus = strtolower(trim((string) data_get($invoice, 'status', 'check')));
        $isFinal = in_array($providerStatus, ['paid', 'paid_over', 'fail', 'wrong_amount', 'system_fail', 'cancelled', 'canceled'], true);
        $mappedStatus = $this->mapHeleketStatus($providerStatus, $isFinal);

        [$lockedDeposit, $creditedNow] = DB::transaction(function () use (
            $deposit,
            $invoice,
            $providerStatus,
            $mappedStatus,
            $ledger
        ): array {
            $lockedDeposit = Deposit::query()
                ->with('wallet:id,user_id,currency,is_active')
                ->lockForUpdate()
                ->findOrFail($deposit->id);

            $instructions = is_array($lockedDeposit->instructions) ? $lockedDeposit->instructions : [];
            $provider = is_array($instructions['provider'] ?? null) ? $instructions['provider'] : [];
            $provider['status'] = $providerStatus;
            $provider['last_sync_at'] = now()->toIso8601String();
            $provider['last_sync_payload'] = $invoice;
            $instructions['provider'] = $provider;

            if (in_array($providerStatus, ['paid', 'paid_over'], true)) {
                if ($lockedDeposit->status === 'completed' && $lockedDeposit->credited_at !== null) {
                    $lockedDeposit->forceFill([
                        'instructions' => $instructions,
                    ])->save();

                    return [$lockedDeposit, false];
                }

                $wallet = $lockedDeposit->wallet;
                if (! $wallet || $wallet->user_id !== $lockedDeposit->user_id) {
                    throw ValidationException::withMessages([
                        'wallet_id' => 'Deposit wallet is invalid.',
                    ]);
                }

                if (! $wallet->is_active) {
                    throw ValidationException::withMessages([
                        'wallet_id' => 'Deposit wallet is inactive.',
                    ]);
                }

                $ledger->credit(
                    wallet: $wallet,
                    type: 'deposit',
                    amount: (float) $lockedDeposit->amount,
                    fee: (float) $lockedDeposit->fee,
                    context: [
                        'related' => $lockedDeposit,
                        'reference' => "{$lockedDeposit->reference}-C",
                        'description' => 'Deposit confirmed by Heleket sync',
                        'meta' => [
                            'provider' => 'heleket',
                            'provider_status' => $providerStatus,
                            'provider_payload' => $invoice,
                        ],
                    ],
                );

                $lockedDeposit->forceFill([
                    'status' => 'completed',
                    'credited_at' => now(),
                    'instructions' => $instructions,
                ])->save();

                return [$lockedDeposit, true];
            }

            if ($lockedDeposit->status !== 'completed') {
                $lockedDeposit->forceFill([
                    'status' => $mappedStatus,
                    'instructions' => $instructions,
                ])->save();
            } else {
                $lockedDeposit->forceFill([
                    'instructions' => $instructions,
                ])->save();
            }

            return [$lockedDeposit, false];
        });

        $lockedDeposit->loadMissing('wallet:id,currency');

        return response()->json([
            'message' => $creditedNow
                ? 'Heleket payment confirmed and wallet credited.'
                : 'Heleket payment status synchronized.',
            'deposit' => $this->transformDeposit($lockedDeposit, true),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildHeleketPaymentMethodOption(HeleketService $heleket): array
    {
        $fallback = [
            'key' => 'heleket',
            'label' => 'Heleket',
            'description' => 'Create secure checkout invoice and pay via supported rails.',
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
            $services = $heleket->paymentServices();
        } catch (RuntimeException) {
            return $fallback;
        }

        $normalized = $this->normalizeHeleketServiceList($services);
        if ($normalized === []) {
            return $fallback;
        }

        $supported = [];
        $networks = [];
        $limits = [];

        foreach ($normalized as $service) {
            if (! $service['is_available'] || ! $service['is_enabled']) {
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
            'label' => 'Heleket',
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
    private function normalizeHeleketServiceList(array $services): array
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
                'is_enabled' => array_key_exists('is_enabled', $service)
                    ? filter_var($service['is_enabled'], FILTER_VALIDATE_BOOLEAN)
                    : true,
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
            'binance_pay' => in_array($currency, ['usd', 'usdt'], true),
            'crypto_wallet' => in_array($currency, ['usdt', 'sol'], true),
            'heleket' => in_array($currency, ['usd', 'usdt', 'sol'], true),
            default => false,
        };
    }

    private function mapHeleketStatus(string $providerStatus, bool $isFinal): string
    {
        $status = strtolower(trim($providerStatus));

        if (in_array($status, ['paid', 'paid_over'], true)) {
            return 'completed';
        }

        if (in_array($status, ['fail', 'wrong_amount', 'system_fail', 'cancelled', 'canceled'], true)) {
            return 'failed';
        }

        if ($isFinal && ! in_array($status, ['check', 'confirm_check', 'process'], true)) {
            return 'failed';
        }

        return 'processing';
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

    private function buildBinancePayInstructions(
        BinancePayService $binancePay,
        string $currency,
        float $amount,
        string $reference,
        int $userId
    ): array {
        try {
            $order = $binancePay->createOrder(
                amount: $amount,
                currency: strtoupper($currency),
                merchantTradeNo: $reference,
                options: [
                    'product_type' => 'wallet_topup',
                    'product_name' => 'NoorFi Wallet Top Up',
                    'product_detail' => "NoorFi user {$userId} top up {$reference}",
                    'trade_type' => 'APP',
                    'support_pay_currency' => strtoupper($currency),
                ],
            );
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages([
                'method' => $exception->getMessage(),
            ]);
        }

        $checkoutUrl = trim((string) (data_get($order, 'checkoutUrl')
            ?? data_get($order, 'checkoutUrlV2')
            ?? data_get($order, 'universalUrl')
            ?? ''));
        $deeplink = trim((string) data_get($order, 'deeplink', ''));
        $qrPayload = trim((string) (data_get($order, 'qrContent')
            ?? data_get($order, 'qrCode')
            ?? $checkoutUrl
            ?? $reference));

        return [
            'provider' => [
                'provider' => 'binance_pay',
                'merchant_trade_no' => $reference,
                'prepay_id' => (string) data_get($order, 'prepayId', ''),
                'status' => strtoupper(trim((string) data_get($order, 'status', 'INITIAL'))),
                'currency' => strtoupper($currency),
                'raw' => $order,
            ],
            'merchant_name' => 'NoorFi',
            'binance_pay_id' => (string) config('services.binance_pay.merchant_id', ''),
            'reference_note' => $reference,
            'currency' => strtoupper($currency),
            'amount' => $amount,
            'checkout_url' => $checkoutUrl !== '' ? $checkoutUrl : null,
            'deeplink' => $deeplink !== '' ? $deeplink : null,
            'qr_payload' => $qrPayload !== '' ? $qrPayload : $reference,
            'steps' => [
                'Open Binance Pay checkout via URL/QR.',
                'Complete payment from your Binance account.',
                'NoorFi will auto-confirm and credit wallet instantly after provider success.',
            ],
        ];
    }

    private function buildHeleketInstructions(
        HeleketService $heleket,
        string $currency,
        float $amount,
        string $reference,
        string $network,
        int $userId
    ): array {
        try {
            $invoice = $heleket->createInvoice(
                amount: $amount,
                currency: strtoupper($currency),
                orderId: $reference,
                network: $network !== '' ? strtolower($network) : null,
                options: [
                    'additional_data' => "noorfi_user_{$userId}_deposit_{$reference}",
                    'lifetime' => 3600,
                ],
            );
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages([
                'method' => $exception->getMessage(),
            ]);
        }

        $paymentUrl = trim((string) data_get($invoice, 'url', ''));
        $paymentAddress = trim((string) data_get($invoice, 'address', ''));
        $addressQrCode = trim((string) data_get($invoice, 'address_qr_code', ''));
        $providerNetwork = strtoupper(trim((string) data_get($invoice, 'network', '')));

        return [
            'provider' => [
                'provider' => 'heleket',
                'kind' => 'invoice',
                'invoice_uuid' => (string) data_get($invoice, 'uuid', ''),
                'order_id' => (string) (data_get($invoice, 'order_id', '') ?: $reference),
                'status' => (string) data_get($invoice, 'status', 'check'),
                'raw' => $invoice,
            ],
            'invoice_uuid' => (string) data_get($invoice, 'uuid', ''),
            'order_id' => (string) (data_get($invoice, 'order_id', '') ?: $reference),
            'provider_status' => (string) data_get($invoice, 'status', 'check'),
            'currency' => strtoupper((string) data_get($invoice, 'currency', strtoupper($currency))),
            'amount' => (float) data_get($invoice, 'amount', $amount),
            'payment_url' => $paymentUrl !== '' ? $paymentUrl : null,
            'address' => $paymentAddress !== '' ? $paymentAddress : null,
            'network' => $providerNetwork !== '' ? $providerNetwork : ($network !== '' ? $network : null),
            'payer_currency' => data_get($invoice, 'payer_currency'),
            'expires_at' => data_get($invoice, 'expired_at'),
            'address_qr_code' => str_starts_with($addressQrCode, 'data:image')
                ? $addressQrCode
                : null,
            'qr_payload' => $paymentUrl !== '' ? $paymentUrl : ($paymentAddress !== '' ? $paymentAddress : $reference),
            'steps' => [
                'Open secure Heleket checkout page or scan QR code.',
                'Complete payment in selected network/currency.',
                'Wait for provider confirmation, NoorFi will credit wallet automatically.',
            ],
        ];
    }

    private function buildCryptoWalletInstructions(
        HeleketService $heleket,
        Wallet $wallet,
        float $amount,
        string $network,
        string $reference
    ): array {
        [$selectedNetwork, $providerCurrency, $providerNetwork] = $this->resolveStaticWalletProviderParams(
            walletCurrency: $wallet->currency,
            network: $network,
        );

        $staticWallet = UserStaticWallet::query()
            ->where('user_id', $wallet->user_id)
            ->where('wallet_id', $wallet->id)
            ->where('provider', 'heleket')
            ->where('network', $selectedNetwork)
            ->first();

        if (! $staticWallet instanceof UserStaticWallet) {
            $orderId = $this->makeStaticWalletOrderId(
                userId: (int) $wallet->user_id,
                walletId: (int) $wallet->id,
                network: $selectedNetwork,
            );

            try {
                $providerWallet = $heleket->createStaticWallet(
                    currency: $providerCurrency,
                    network: $providerNetwork,
                    orderId: $orderId
                );
            } catch (RuntimeException $exception) {
                throw ValidationException::withMessages([
                    'method' => $exception->getMessage(),
                ]);
            }

            $walletUuid = trim((string) data_get($providerWallet, 'uuid', ''));
            $providerOrderId = trim((string) (data_get($providerWallet, 'order_id', '') ?: $orderId));
            $paymentUrl = trim((string) data_get($providerWallet, 'url', ''));
            $callbackUrl = trim((string) data_get($providerWallet, 'url_callback', ''));

            $address = trim((string) data_get($providerWallet, 'address', ''));
            $addressUuid = '';
            $currencies = data_get($providerWallet, 'currencies');
            if (is_array($currencies)) {
                foreach ($currencies as $currencyItem) {
                    if (! is_array($currencyItem)) {
                        continue;
                    }

                    $candidateAddress = trim((string) ($currencyItem['address'] ?? ''));
                    if ($candidateAddress === '') {
                        continue;
                    }

                    $address = $candidateAddress;
                    $addressUuid = trim((string) ($currencyItem['uuid'] ?? ''));
                    break;
                }
            }

            if ($address === '') {
                throw ValidationException::withMessages([
                    'method' => 'Heleket static wallet created without deposit address.',
                ]);
            }

            try {
                $staticWallet = UserStaticWallet::query()->create([
                    'user_id' => $wallet->user_id,
                    'wallet_id' => $wallet->id,
                    'provider' => 'heleket',
                    'currency' => strtoupper($wallet->currency),
                    'network' => $selectedNetwork,
                    'order_id' => $providerOrderId,
                    'wallet_uuid' => $walletUuid !== '' ? $walletUuid : null,
                    'address_uuid' => $addressUuid !== '' ? $addressUuid : null,
                    'address' => $address,
                    'payment_url' => $paymentUrl !== '' ? $paymentUrl : null,
                    'callback_url' => $callbackUrl !== '' ? $callbackUrl : null,
                    'meta' => [
                        'provider_currency' => $providerCurrency,
                        'provider_network' => $providerNetwork,
                        'raw' => $providerWallet,
                    ],
                    'last_used_at' => now(),
                ]);
            } catch (QueryException $exception) {
                $staticWallet = UserStaticWallet::query()
                    ->where('user_id', $wallet->user_id)
                    ->where('wallet_id', $wallet->id)
                    ->where('provider', 'heleket')
                    ->where('network', $selectedNetwork)
                    ->first();

                if (! $staticWallet instanceof UserStaticWallet) {
                    throw $exception;
                }
            }
        } else {
            $staticWallet->forceFill([
                'last_used_at' => now(),
            ])->save();
        }

        if (trim((string) $staticWallet->address) === '') {
            throw ValidationException::withMessages([
                'method' => 'Configured static wallet address is empty. Recreate wallet before retrying.',
            ]);
        }

        $pendingDepositQuery = Deposit::query()
            ->where('user_id', $wallet->user_id)
            ->where('wallet_id', $wallet->id)
            ->where('method', 'crypto_wallet')
            ->whereIn('status', ['pending', 'processing']);

        if (is_string($staticWallet->address_uuid) && trim($staticWallet->address_uuid) !== '') {
            $pendingDepositQuery->where('instructions->provider->wallet_address_uuid', trim($staticWallet->address_uuid));
        } else {
            $pendingDepositQuery->where('instructions->provider->order_id', $staticWallet->order_id);
        }

        $existingPending = $pendingDepositQuery->latest('id')->first();
        if ($existingPending instanceof Deposit) {
            throw ValidationException::withMessages([
                'method' => "A crypto deposit request is already pending ({$existingPending->reference}). Complete or cancel it first.",
            ]);
        }

        $paymentUrl = is_string($staticWallet->payment_url) ? trim($staticWallet->payment_url) : '';
        $addressUuid = is_string($staticWallet->address_uuid) ? trim($staticWallet->address_uuid) : '';
        $walletUuid = is_string($staticWallet->wallet_uuid) ? trim($staticWallet->wallet_uuid) : '';

        return [
            'provider' => [
                'provider' => 'heleket',
                'kind' => 'static_wallet',
                'status' => 'waiting_payment',
                'order_id' => $staticWallet->order_id,
                'static_wallet_uuid' => $walletUuid !== '' ? $walletUuid : null,
                'wallet_address_uuid' => $addressUuid !== '' ? $addressUuid : null,
                'network' => $selectedNetwork,
                'currency' => strtoupper($wallet->currency),
            ],
            'network' => $selectedNetwork,
            'address' => $staticWallet->address,
            'currency' => strtoupper($wallet->currency),
            'amount' => $amount,
            'reference' => $reference,
            'payment_url' => $paymentUrl !== '' ? $paymentUrl : null,
            'qr_payload' => $staticWallet->address,
            'steps' => [
                'Copy your personal deposit address or scan the QR code.',
                "Send only " . strtoupper($wallet->currency) . " on {$selectedNetwork} network.",
                'NoorFi will credit wallet automatically after provider confirmation.',
            ],
        ];
    }

    private function findDepositForHeleketWebhook(
        string $orderId,
        string $invoiceUuid,
        string $walletAddressUuid,
        string $webhookType
    ): ?Deposit {
        $query = Deposit::query()
            ->with('wallet:id,user_id,currency,is_active')
            ->lockForUpdate();

        if ($this->isStaticWalletWebhook($walletAddressUuid, $webhookType, $orderId)) {
            $query->where('method', 'crypto_wallet');

            if ($walletAddressUuid !== '') {
                $query->where('instructions->provider->wallet_address_uuid', $walletAddressUuid);
            } elseif ($orderId !== '') {
                $query->where(function ($walletQuery) use ($orderId): void {
                    $walletQuery->where('instructions->provider->order_id', $orderId)
                        ->orWhere('instructions->order_id', $orderId);
                });
            } elseif ($invoiceUuid !== '') {
                $query->where('instructions->provider->static_wallet_uuid', $invoiceUuid);
            }

            return $query->latest('id')->first();
        }

        $query->where('method', 'heleket');

        if ($orderId !== '') {
            $query->where('reference', $orderId);
        } elseif ($invoiceUuid !== '') {
            $query->where(function ($invoiceQuery) use ($invoiceUuid): void {
                $invoiceQuery->where('instructions->provider->invoice_uuid', $invoiceUuid)
                    ->orWhere('instructions->invoice_uuid', $invoiceUuid);
            });
        }

        return $query->latest('id')->first();
    }

    private function isStaticWalletWebhook(string $walletAddressUuid, string $webhookType, string $orderId): bool
    {
        if ($walletAddressUuid !== '') {
            return true;
        }

        if ($webhookType === 'wallet') {
            return true;
        }

        return $orderId !== '' && str_starts_with(strtoupper($orderId), 'SW-');
    }

    private function extractHeleketWebhookAmount(array $payload): float
    {
        $candidates = [
            data_get($payload, 'merchant_amount'),
            data_get($payload, 'amount'),
            data_get($payload, 'payer_amount'),
        ];

        foreach ($candidates as $candidate) {
            $amount = $this->asFloat($candidate);
            if ($amount > 0) {
                return round($amount, 8);
            }
        }

        return 0.0;
    }

    /**
     * @return array{0: string, 1: string, 2: string}
     */
    private function resolveStaticWalletProviderParams(string $walletCurrency, string $network): array
    {
        $currency = strtolower(trim($walletCurrency));
        $selectedNetwork = strtoupper(trim($network));

        if ($currency === 'sol') {
            return ['SOL', 'SOL', 'SOL'];
        }

        if ($currency !== 'usdt') {
            throw ValidationException::withMessages([
                'method' => 'Crypto wallet deposit supports only USDT and SOL wallets.',
            ]);
        }

        if ($selectedNetwork === '') {
            $selectedNetwork = 'TRC20';
        }

        if (! in_array($selectedNetwork, ['TRC20', 'SOL'], true)) {
            throw ValidationException::withMessages([
                'network' => 'Selected network is not available for this wallet.',
            ]);
        }

        $providerNetwork = $selectedNetwork === 'TRC20' ? 'TRON' : $selectedNetwork;

        return [$selectedNetwork, 'USDT', $providerNetwork];
    }

    private function makeStaticWalletOrderId(int $userId, int $walletId, string $network): string
    {
        return sprintf(
            'SW-U%d-W%d-%s',
            $userId,
            $walletId,
            strtoupper(trim($network))
        );
    }

    private function transformDeposit(Deposit $deposit, bool $withInstructions = false): array
    {
        $payload = [
            'id' => $deposit->id,
            'wallet_id' => $deposit->wallet_id,
            'currency' => strtoupper((string) optional($deposit->wallet)->currency),
            'method' => $deposit->method,
            'amount' => (float) $deposit->amount,
            'fee' => (float) $deposit->fee,
            'net_amount' => (float) $deposit->net_amount,
            'status' => $deposit->status,
            'reference' => $deposit->reference,
            'note' => $deposit->note,
            'credited_at' => $deposit->credited_at?->toIso8601String(),
            'created_at' => $deposit->created_at?->toIso8601String(),
        ];

        if ($withInstructions) {
            $payload['instructions'] = $deposit->instructions;
        }

        return $payload;
    }
}
