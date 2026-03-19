<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Transaction;
use App\Models\Wallet;
use App\Services\StrowalletService;
use App\Services\WalletLedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class CardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $cards = $request->user()
            ->cards()
            ->latest('id')
            ->get();

        return response()->json([
            'cards' => $cards->map(fn (Card $card) => $this->transformCard($card)),
        ]);
    }

    public function show(Request $request, Card $card): JsonResponse
    {
        abort_unless($card->user_id === $request->user()->id, 404);

        return response()->json([
            'card' => $this->transformCard($card),
        ]);
    }

    public function applyVirtual(
        Request $request,
        WalletLedgerService $ledger,
        StrowalletService $strowallet
    ): JsonResponse
    {
        $data = $request->validate([
            'card_type' => ['required', 'in:virtual'],
            'card_name' => ['required', 'string', 'max:40'],
            'holder_name' => ['required', 'string', 'max:100'],
            'theme' => ['required', 'string', 'max:40'],
            'funding_wallet_id' => ['nullable', 'integer'],
            'issue_fee' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'prefund_amount' => ['nullable', 'numeric', 'min:0', 'max:1000'],
        ]);

        $user = $request->user();
        $profile = $user->kycProfile;
        $issueFee = isset($data['issue_fee']) ? round((float) $data['issue_fee'], 2) : 10.0;
        $prefundAmount = isset($data['prefund_amount']) ? round((float) $data['prefund_amount'], 2) : 5.0;

        if ($user->account_status !== 'active') {
            throw ValidationException::withMessages([
                'card' => 'Account is not active. Please contact support.',
            ]);
        }

        if ((string) $user->kyc_status !== 'approved' || (string) ($profile?->status ?? '') !== 'approved') {
            throw ValidationException::withMessages([
                'card' => 'KYC must be approved before applying for a card.',
            ]);
        }

        try {
            $card = DB::transaction(function () use (
                $data,
                $user,
                $issueFee,
                $prefundAmount,
                $ledger,
                $strowallet
            ) {
                /** @var Wallet|null $fundingWallet */
                $fundingWallet = null;
                $issueFeeTransaction = null;
                $prefundTransaction = null;

                if (! empty($data['funding_wallet_id'])) {
                    $fundingWallet = Wallet::query()
                        ->where('id', $data['funding_wallet_id'])
                        ->where('user_id', $user->id)
                        ->where('currency', 'usd')
                        ->lockForUpdate()
                        ->first();
                }

                if (! $fundingWallet) {
                    $fundingWallet = Wallet::query()
                        ->where('user_id', $user->id)
                        ->where('currency', 'usd')
                        ->lockForUpdate()
                        ->first();
                }

                if (! $fundingWallet) {
                    throw ValidationException::withMessages([
                        'funding_wallet_id' => 'Only USD wallet is supported for virtual USD card.',
                    ]);
                }

                if ($issueFee > 0) {
                    $issueFeeTransaction = $ledger->debit(
                        wallet: $fundingWallet,
                        type: 'card_apply',
                        amount: $issueFee,
                        fee: 0,
                        context: [
                            'reference' => $ledger->makeReference('CARD'),
                            'description' => 'Virtual card issuance fee',
                            'meta' => [
                                'card_name' => $data['card_name'],
                                'theme' => $data['theme'],
                            ],
                        ],
                    );
                }

                if ($prefundAmount > 0) {
                    $prefundTransaction = $ledger->debit(
                        wallet: $fundingWallet,
                        type: 'card_prefund',
                        amount: $prefundAmount,
                        fee: 0,
                        context: [
                            'reference' => $ledger->makeReference('CRDFUND'),
                            'description' => 'Virtual card prefund amount',
                            'meta' => [
                                'card_name' => $data['card_name'],
                                'theme' => $data['theme'],
                            ],
                        ],
                    );
                }

                $provider = $strowallet->createVirtualCard(
                    user: $user,
                    nameOnCard: strtoupper(trim($data['holder_name'])),
                    prefundAmount: $prefundAmount,
                );

                $providerResponse = (array) data_get($provider, 'card.response', []);
                $providerCardId = (string) (
                    data_get($providerResponse, 'card_id')
                    ?: ''
                );
                $providerDetails = (array) data_get($provider, 'card_details.response.card_detail', []);

                if ($providerCardId === '' && $providerDetails !== []) {
                    $providerCardId = (string) data_get($providerDetails, 'card_id', '');
                }

                if ($providerCardId === '') {
                    throw new RuntimeException('Card provider did not return a card ID. Please try again.');
                }

                if ($providerDetails === []) {
                    $freshDetails = $strowallet->fetchCardDetails($providerCardId);
                    $providerDetails = (array) data_get($freshDetails, 'response.card_detail', []);
                }

                $cardNumber = (string) data_get($providerDetails, 'card_number', '');
                $last4 = (string) (
                    data_get($providerDetails, 'last4')
                    ?: (strlen($cardNumber) >= 4 ? substr($cardNumber, -4) : '')
                );

                if ($last4 === '') {
                    throw new RuntimeException('Card provider did not return last4 card digits.');
                }

                [$expiryMonth, $expiryYear] = $this->parseExpiry((string) data_get($providerDetails, 'expiry', ''));
                $providerStatus = strtolower((string) (
                    data_get($providerDetails, 'card_status')
                    ?: data_get($providerResponse, 'card_status')
                    ?: 'pending'
                ));
                $issuedAtRaw = (string) (
                    data_get($providerResponse, 'card_created_date')
                    ?: data_get($providerDetails, 'card_created_date')
                    ?: ''
                );
                $issuedAt = $issuedAtRaw !== '' ? Carbon::parse($issuedAtRaw) : now();
                $maskedNumber = $this->maskCardNumber($cardNumber, $last4);

                $brand = strtolower((string) config('services.strowallet.card_type', 'mastercard'));
                if ($brand === '') {
                    $brand = 'mastercard';
                }

                $card = Card::query()->create([
                    'user_id' => $user->id,
                    'wallet_id' => $fundingWallet->id,
                    'type' => 'virtual',
                    'template_name' => $data['card_name'],
                    'holder_name' => strtoupper(trim($data['holder_name'])),
                    'brand' => $brand,
                    'theme' => $data['theme'],
                    'status' => $providerStatus !== '' ? $providerStatus : 'pending',
                    'last4' => $last4,
                    'masked_number' => $maskedNumber,
                    'expiry_month' => $expiryMonth,
                    'expiry_year' => $expiryYear,
                    'issued_at' => $issuedAt,
                    'meta' => [
                        'issuer' => 'NoorFi',
                        'provider' => (string) config('services.card_providers.virtual', 'strowallet'),
                        'provider_customer_id' => data_get($provider, 'customer_id'),
                        'provider_card_id' => $providerCardId !== '' ? $providerCardId : null,
                        'provider_reference' => data_get($providerResponse, 'reference'),
                        'provider_status' => data_get($providerResponse, 'card_status'),
                        'provider_payload' => $providerResponse,
                        'provider_details' => $this->sanitizeProviderDetails($providerDetails),
                        'funding_wallet_currency' => strtoupper($fundingWallet->currency),
                        'card_currency' => 'USD',
                        'issue_fee' => $issueFee,
                        'prefund_amount' => $prefundAmount,
                    ],
                ]);

                $transactionMeta = [
                    'card_id' => $card->id,
                    'provider_card_id' => $providerCardId !== '' ? $providerCardId : null,
                ];

                if ($issueFeeTransaction !== null) {
                    $issueFeeTransaction->forceFill([
                        'related_type' => Card::class,
                        'related_id' => $card->id,
                        'meta' => array_merge((array) ($issueFeeTransaction->meta ?? []), $transactionMeta, [
                            'ledger_line' => 'issue_fee',
                        ]),
                    ])->save();
                }

                if ($prefundTransaction !== null) {
                    $prefundTransaction->forceFill([
                        'related_type' => Card::class,
                        'related_id' => $card->id,
                        'meta' => array_merge((array) ($prefundTransaction->meta ?? []), $transactionMeta, [
                            'ledger_line' => 'prefund',
                        ]),
                    ])->save();
                }

                return $card;
            });
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages([
                'card' => $exception->getMessage(),
            ]);
        }

        return response()->json([
            'message' => 'Virtual card issued successfully.',
            'card' => $this->transformCard($card),
        ], 201);
    }

    public function reveal(
        Request $request,
        Card $card,
        StrowalletService $strowallet
    ): JsonResponse
    {
        abort_unless($card->user_id === $request->user()->id, 404);

        $data = $request->validate([
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

        $providerCardId = $this->resolveProviderCardId($card);

        if ($providerCardId === '') {
            throw ValidationException::withMessages([
                'card' => 'Provider card reference is missing for this card.',
            ]);
        }

        try {
            $providerPayload = $strowallet->fetchCardDetails($providerCardId);
            $providerDetails = (array) data_get($providerPayload, 'response.card_detail', []);
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages([
                'card' => $exception->getMessage(),
            ]);
        }

        $digitsOnly = preg_replace('/\D+/', '', (string) data_get($providerDetails, 'card_number', '')) ?? '';

        if (strlen($digitsOnly) < 12) {
            throw ValidationException::withMessages([
                'card' => 'Card number is not available yet. Try again in a few moments.',
            ]);
        }

        $cvv = trim((string) (data_get($providerDetails, 'cvv2') ?: data_get($providerDetails, 'cvv') ?: ''));
        if ($cvv === '') {
            throw ValidationException::withMessages([
                'card' => 'CVV is not available from provider yet. Please refresh and try again.',
            ]);
        }

        $expiryRaw = (string) data_get($providerDetails, 'expiry', '');
        [$expiryMonth, $expiryYear] = $this->parseExpiry($expiryRaw);

        $providerStatus = strtolower((string) (
            data_get($providerDetails, 'card_status')
            ?: data_get($providerPayload, 'response.card_status')
            ?: $card->status
        ));

        $last4 = substr($digitsOnly, -4);
        $card->forceFill([
            'last4' => $last4,
            'masked_number' => $this->maskCardNumber($digitsOnly, $last4),
            'expiry_month' => $expiryMonth,
            'expiry_year' => $expiryYear,
            'status' => $providerStatus,
            'meta' => array_merge($card->meta ?? [], [
                'provider_details' => $this->sanitizeProviderDetails($providerDetails),
                'provider_status' => $providerStatus,
            ]),
        ])->save();

        $fresh = $card->fresh();

        return response()->json([
            'card' => $this->transformCard($fresh ?? $card),
            'sensitive' => [
                'card_number' => $this->formatCardNumber($digitsOnly),
                'cvv' => $cvv,
                'expiry' => $expiryRaw !== '' ? $expiryRaw : null,
                'holder_name' => (string) (data_get($providerDetails, 'name_on_card') ?: $card->holder_name),
            ],
        ]);
    }

    public function providerTransactions(
        Request $request,
        Card $card,
        StrowalletService $strowallet
    ): JsonResponse
    {
        abort_unless($card->user_id === $request->user()->id, 404);

        $data = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $providerCardId = $this->resolveProviderCardId($card);

        if ($providerCardId === '') {
            throw ValidationException::withMessages([
                'card' => 'Provider card reference is missing for this card.',
            ]);
        }

        try {
            $payload = $strowallet->fetchCardTransactions($providerCardId);
            $transactions = $this->normalizeProviderCardTransactions($payload);
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages([
                'card' => $exception->getMessage(),
            ]);
        }

        $limit = (int) ($data['limit'] ?? 20);

        return response()->json([
            'transactions' => array_slice($transactions, 0, $limit),
        ]);
    }

    public function freeze(
        Request $request,
        Card $card,
        StrowalletService $strowallet
    ): JsonResponse {
        return $this->changeFreezeStatus($request, $card, $strowallet, true);
    }

    public function unfreeze(
        Request $request,
        Card $card,
        StrowalletService $strowallet
    ): JsonResponse {
        return $this->changeFreezeStatus($request, $card, $strowallet, false);
    }
    public function addFund(
        Request $request,
        Card $card,
        WalletLedgerService $ledger,
        StrowalletService $strowallet
    ): JsonResponse {
        abort_unless($card->user_id === $request->user()->id, 404);

        if ($card->type !== 'virtual') {
            throw ValidationException::withMessages([
                'card' => 'Add fund is available for virtual cards only.',
            ]);
        }

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:1', 'max:5000'],
            'funding_wallet_id' => ['nullable', 'integer'],
        ]);

        $providerCardId = $this->resolveProviderCardId($card);

        if ($providerCardId === '') {
            throw ValidationException::withMessages([
                'card' => 'Provider card reference is missing for this card.',
            ]);
        }

        $amount = round((float) $data['amount'], 2);
        $userId = (int) $request->user()->id;

        try {
            [$updatedCard, $providerPayload] = DB::transaction(function () use (
                $data,
                $card,
                $ledger,
                $strowallet,
                $providerCardId,
                $amount,
                $userId
            ): array {
                $fundingWalletQuery = Wallet::query()
                    ->where('user_id', $userId)
                    ->where('currency', 'usd');

                if (! empty($data['funding_wallet_id'])) {
                    $fundingWalletQuery->where('id', (int) $data['funding_wallet_id']);
                } elseif ($card->wallet_id) {
                    $fundingWalletQuery->where('id', (int) $card->wallet_id);
                }

                $fundingWallet = $fundingWalletQuery->lockForUpdate()->first();

                if (! $fundingWallet instanceof Wallet) {
                    throw ValidationException::withMessages([
                        'funding_wallet_id' => 'USD wallet not found for funding this card.',
                    ]);
                }

                if (! $fundingWallet->is_active) {
                    throw ValidationException::withMessages([
                        'funding_wallet_id' => 'Funding wallet is inactive.',
                    ]);
                }

                $fundTransaction = $ledger->debit(
                    wallet: $fundingWallet,
                    type: 'card_fund',
                    amount: $amount,
                    fee: 0,
                    context: [
                        'reference' => $ledger->makeReference('CRDFUND'),
                        'description' => 'Add fund to virtual card',
                        'related' => $card,
                        'meta' => [
                            'card_id' => $card->id,
                            'provider_card_id' => $providerCardId,
                            'flow' => 'wallet_to_card',
                        ],
                    ],
                );

                try {
                    $providerPayload = $strowallet->fundCard($providerCardId, $amount);
                } catch (RuntimeException $exception) {
                    throw ValidationException::withMessages([
                        'card' => $exception->getMessage(),
                    ]);
                }

                $providerStatus = strtolower((string) (
                    data_get($providerPayload, 'response.card_status')
                    ?: data_get($providerPayload, 'response.status')
                    ?: data_get($providerPayload, 'data.card_status')
                    ?: data_get($providerPayload, 'status')
                    ?: data_get($card->meta, 'provider_status')
                    ?: ''
                ));

                $detailsPayload = [];
                $providerDetails = [];

                try {
                    $detailsPayload = $strowallet->fetchCardDetails($providerCardId);
                    $providerDetails = (array) data_get($detailsPayload, 'response.card_detail', []);
                } catch (RuntimeException) {
                    $providerDetails = (array) data_get($card->meta, 'provider_details', []);
                }

                $nextCardBalance = $this->resolveCardBalanceFromProvider($providerDetails);
                if ($nextCardBalance === null) {
                    $nextCardBalance = round($this->resolveLocalCardBalance($card) + $amount, 2);
                }

                $card->forceFill([
                    'wallet_id' => $fundingWallet->id,
                    'status' => $this->resolveCardStatusFromPayload($card->status, $providerStatus),
                    'meta' => array_merge($card->meta ?? [], [
                        'provider_status' => $providerStatus !== ''
                            ? $providerStatus
                            : data_get($card->meta, 'provider_status'),
                        'provider_details' => $this->sanitizeProviderDetails($providerDetails),
                        'provider_last_fund_at' => now()->toIso8601String(),
                        'provider_last_fund_payload' => Arr::only($providerPayload, [
                            'success',
                            'message',
                            'response',
                            'data',
                        ]),
                        'card_local_balance' => $nextCardBalance,
                    ]),
                ])->save();

                $fundTransaction->forceFill([
                    'related_type' => Card::class,
                    'related_id' => $card->id,
                    'meta' => array_merge((array) ($fundTransaction->meta ?? []), [
                        'provider_response' => Arr::only($providerPayload, ['success', 'message', 'response', 'data']),
                    ]),
                ])->save();

                return [$card->fresh() ?? $card, $providerPayload];
            });
        } catch (ValidationException $exception) {
            throw $exception;
        }

        return response()->json([
            'message' => (string) (
                data_get($providerPayload, 'message')
                ?: data_get($providerPayload, 'response.message')
                ?: 'Card funded successfully.'
            ),
            'card' => $this->transformCard($updatedCard),
            'provider_response' => Arr::only($providerPayload, ['success', 'message', 'response', 'data']),
        ]);
    }

    public function withdrawFromCard(
        Request $request,
        Card $card,
        WalletLedgerService $ledger,
        StrowalletService $strowallet
    ): JsonResponse {
        abort_unless($card->user_id === $request->user()->id, 404);

        if ($card->type !== 'virtual') {
            throw ValidationException::withMessages([
                'card' => 'Withdraw from card is available for virtual cards only.',
            ]);
        }

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:1', 'max:5000'],
            'destination_wallet_id' => ['nullable', 'integer'],
        ]);

        $providerCardId = $this->resolveProviderCardId($card);

        if ($providerCardId === '') {
            throw ValidationException::withMessages([
                'card' => 'Provider card reference is missing for this card.',
            ]);
        }

        $amount = round((float) $data['amount'], 2);
        $currentBalance = $this->resolveLocalCardBalance($card);
        if ($currentBalance > 0 && $amount > $currentBalance) {
            throw ValidationException::withMessages([
                'amount' => 'Amount exceeds current card balance.',
            ]);
        }

        $userId = (int) $request->user()->id;

        try {
            [$updatedCard, $providerPayload, $isPending] = DB::transaction(function () use (
                $data,
                $card,
                $ledger,
                $strowallet,
                $providerCardId,
                $amount,
                $userId
            ): array {
                $destinationWalletQuery = Wallet::query()
                    ->where('user_id', $userId)
                    ->where('currency', 'usd');

                if (! empty($data['destination_wallet_id'])) {
                    $destinationWalletQuery->where('id', (int) $data['destination_wallet_id']);
                } elseif ($card->wallet_id) {
                    $destinationWalletQuery->where('id', (int) $card->wallet_id);
                }

                $destinationWallet = $destinationWalletQuery->lockForUpdate()->first();

                if (! $destinationWallet instanceof Wallet) {
                    throw ValidationException::withMessages([
                        'destination_wallet_id' => 'USD wallet not found for card withdrawal.',
                    ]);
                }

                if (! $destinationWallet->is_active) {
                    throw ValidationException::withMessages([
                        'destination_wallet_id' => 'Destination wallet is inactive.',
                    ]);
                }

                try {
                    $providerPayload = $strowallet->withdrawFromCard($providerCardId, $amount);
                } catch (RuntimeException $exception) {
                    throw ValidationException::withMessages([
                        'card' => $exception->getMessage(),
                    ]);
                }

                $providerStatus = strtolower((string) (
                    data_get($providerPayload, 'response.card_status')
                    ?: data_get($providerPayload, 'response.status')
                    ?: data_get($providerPayload, 'data.card_status')
                    ?: data_get($providerPayload, 'status')
                    ?: data_get($card->meta, 'provider_status')
                    ?: ''
                ));

                $isPending = $this->isPendingProviderStatus($providerStatus);

                if ($isPending) {
                    Transaction::query()->create([
                        'user_id' => $destinationWallet->user_id,
                        'wallet_id' => $destinationWallet->id,
                        'related_type' => Card::class,
                        'related_id' => $card->id,
                        'type' => 'card_withdraw',
                        'direction' => 'credit',
                        'amount' => $amount,
                        'fee' => 0,
                        'net_amount' => $amount,
                        'status' => 'pending',
                        'reference' => $ledger->makeReference('CRDWTH'),
                        'description' => 'Withdraw from card (pending settlement)',
                        'meta' => [
                            'card_id' => $card->id,
                            'provider_card_id' => $providerCardId,
                            'provider_status' => $providerStatus,
                            'provider_response' => Arr::only($providerPayload, ['success', 'message', 'response', 'data']),
                            'flow' => 'card_to_wallet',
                        ],
                        'occurred_at' => now(),
                    ]);
                } else {
                    $withdrawTransaction = $ledger->credit(
                        wallet: $destinationWallet,
                        type: 'card_withdraw',
                        amount: $amount,
                        fee: 0,
                        context: [
                            'reference' => $ledger->makeReference('CRDWTH'),
                            'description' => 'Withdraw from card',
                            'related' => $card,
                            'meta' => [
                                'card_id' => $card->id,
                                'provider_card_id' => $providerCardId,
                                'provider_status' => $providerStatus,
                                'provider_response' => Arr::only($providerPayload, ['success', 'message', 'response', 'data']),
                                'flow' => 'card_to_wallet',
                            ],
                        ],
                    );

                    $withdrawTransaction->forceFill([
                        'related_type' => Card::class,
                        'related_id' => $card->id,
                    ])->save();
                }

                $detailsPayload = [];
                $providerDetails = [];

                try {
                    $detailsPayload = $strowallet->fetchCardDetails($providerCardId);
                    $providerDetails = (array) data_get($detailsPayload, 'response.card_detail', []);
                } catch (RuntimeException) {
                    $providerDetails = (array) data_get($card->meta, 'provider_details', []);
                }

                $nextCardBalance = $this->resolveCardBalanceFromProvider($providerDetails);
                if ($nextCardBalance === null) {
                    $nextCardBalance = max(round($this->resolveLocalCardBalance($card) - $amount, 2), 0);
                }

                $card->forceFill([
                    'wallet_id' => $destinationWallet->id,
                    'status' => $this->resolveCardStatusFromPayload($card->status, $providerStatus),
                    'meta' => array_merge($card->meta ?? [], [
                        'provider_status' => $providerStatus !== ''
                            ? $providerStatus
                            : data_get($card->meta, 'provider_status'),
                        'provider_details' => $this->sanitizeProviderDetails($providerDetails),
                        'provider_last_withdraw_at' => now()->toIso8601String(),
                        'provider_last_withdraw_payload' => Arr::only($providerPayload, [
                            'success',
                            'message',
                            'response',
                            'data',
                        ]),
                        'card_local_balance' => $nextCardBalance,
                    ]),
                ])->save();

                return [$card->fresh() ?? $card, $providerPayload, $isPending];
            });
        } catch (ValidationException $exception) {
            throw $exception;
        }

        $defaultMessage = $isPending
            ? 'Withdrawal request submitted. Funds will be credited after provider settlement.'
            : 'Withdrawal from card completed successfully.';

        return response()->json([
            'message' => (string) (
                data_get($providerPayload, 'message')
                ?: data_get($providerPayload, 'response.message')
                ?: $defaultMessage
            ),
            'card' => $this->transformCard($updatedCard),
            'provider_response' => Arr::only($providerPayload, ['success', 'message', 'response', 'data']),
        ]);
    }

    public function upgradeLimit(
        Request $request,
        Card $card,
        StrowalletService $strowallet
    ): JsonResponse {
        abort_unless($card->user_id === $request->user()->id, 404);

        if ($card->type !== 'virtual') {
            throw ValidationException::withMessages([
                'card' => 'Card limit upgrade is available for virtual cards only.',
            ]);
        }

        $user = $request->user();
        $profile = $user->kycProfile;

        if ((string) $user->kyc_status !== 'approved' || (string) ($profile?->status ?? '') !== 'approved') {
            throw ValidationException::withMessages([
                'card' => 'KYC must be approved before card limit upgrade.',
            ]);
        }

        if (! $profile) {
            throw ValidationException::withMessages([
                'card' => 'KYC profile not found. Please complete KYC first.',
            ]);
        }

        $customerId = trim((string) (
            $user->strowallet_customer_id
            ?: data_get($card->meta, 'provider_customer_id')
            ?: ''
        ));

        if ($customerId === '') {
            throw ValidationException::withMessages([
                'card' => 'Provider customer ID is missing. Please contact support.',
            ]);
        }

        $providerCardId = $this->resolveProviderCardId($card);

        if ($providerCardId === '') {
            throw ValidationException::withMessages([
                'card' => 'Provider card reference is missing for this card.',
            ]);
        }

        try {
            $detailsPayload = $strowallet->fetchCardDetails($providerCardId);
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages([
                'card' => $exception->getMessage(),
            ]);
        }

        $providerDetails = (array) data_get($detailsPayload, 'response.card_detail', []);
        $cardUserId = trim((string) (
            data_get($providerDetails, 'card_user_id')
            ?: data_get($providerDetails, 'cardUserId')
            ?: data_get($providerDetails, 'card_userid')
            ?: ''
        ));

        if ($cardUserId === '') {
            throw ValidationException::withMessages([
                'card' => 'Provider card user ID is missing. Please refresh and try again.',
            ]);
        }

        [$firstName, $lastName] = $this->splitName(
            (string) ($profile->full_name ?: $user->full_name ?: $user->name ?: '')
        );
        $dateOfBirth = optional($profile->date_of_birth)?->format('m/d/Y') ?? '';
        $line1 = trim((string) $profile->address_line);

        if ($dateOfBirth === '' || $line1 === '') {
            throw ValidationException::withMessages([
                'card' => 'Missing KYC data required for provider card limit upgrade.',
            ]);
        }

        try {
            $upgradePayload = $strowallet->upgradeCardLimit(
                customerId: $customerId,
                cardUserId: $cardUserId,
                firstName: $firstName,
                lastName: $lastName,
                dateOfBirth: $dateOfBirth,
                line1: $line1,
            );
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages([
                'card' => $exception->getMessage(),
            ]);
        }

        $providerStatus = strtolower((string) (
            data_get($upgradePayload, 'response.card_status')
            ?: data_get($upgradePayload, 'response.status')
            ?: data_get($upgradePayload, 'data.card_status')
            ?: data_get($upgradePayload, 'status')
            ?: data_get($card->meta, 'provider_status')
            ?: $card->status
        ));

        $card->forceFill([
            'status' => $providerStatus !== '' ? $providerStatus : $card->status,
            'meta' => array_merge($card->meta ?? [], [
                'provider_status' => $providerStatus,
                'provider_details' => $this->sanitizeProviderDetails($providerDetails),
                'provider_last_limit_upgrade_at' => now()->toIso8601String(),
                'provider_last_limit_upgrade_payload' => Arr::only($upgradePayload, [
                    'success',
                    'message',
                    'response',
                    'data',
                ]),
            ]),
        ])->save();

        return response()->json([
            'message' => (string) (
                data_get($upgradePayload, 'message')
                ?: data_get($upgradePayload, 'response.message')
                ?: 'Card limit upgrade requested successfully.'
            ),
            'card' => $this->transformCard($card->fresh() ?? $card),
            'provider_response' => Arr::only($upgradePayload, ['success', 'message', 'response', 'data']),
        ]);
    }

    private function changeFreezeStatus(
        Request $request,
        Card $card,
        StrowalletService $strowallet,
        bool $freeze
    ): JsonResponse {
        abort_unless($card->user_id === $request->user()->id, 404);

        if ($card->type !== 'virtual') {
            throw ValidationException::withMessages([
                'card' => 'Freeze/unfreeze is available for virtual cards only.',
            ]);
        }

        $providerCardId = $this->resolveProviderCardId($card);

        if ($providerCardId === '') {
            throw ValidationException::withMessages([
                'card' => 'Provider card reference is missing for this card.',
            ]);
        }

        try {
            $providerPayload = $strowallet->setCardFreezeStatus($providerCardId, $freeze);
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages([
                'card' => $exception->getMessage(),
            ]);
        }

        $providerStatus = strtolower((string) (
            data_get($providerPayload, 'response.card_status')
            ?: data_get($providerPayload, 'response.status')
            ?: data_get($providerPayload, 'data.card_status')
            ?: data_get($providerPayload, 'status')
            ?: ($freeze ? 'frozen' : 'active')
        ));

        if ($providerStatus === '') {
            $providerStatus = $freeze ? 'frozen' : 'active';
        }

        $cardStatus = $freeze
            ? 'frozen'
            : ($providerStatus === 'frozen' ? 'active' : $providerStatus);

        $card->forceFill([
            'status' => $cardStatus,
            'frozen_at' => $freeze ? now() : null,
            'meta' => array_merge($card->meta ?? [], [
                'provider_status' => $providerStatus,
                'provider_last_control_action' => $freeze ? 'freeze' : 'unfreeze',
                'provider_last_control_at' => now()->toIso8601String(),
                'provider_last_control_payload' => Arr::only($providerPayload, [
                    'success',
                    'message',
                    'response',
                    'data',
                ]),
            ]),
        ])->save();

        return response()->json([
            'message' => (string) (
                data_get($providerPayload, 'message')
                ?: data_get($providerPayload, 'response.message')
                ?: ($freeze ? 'Card frozen successfully.' : 'Card unfrozen successfully.')
            ),
            'card' => $this->transformCard($card->fresh() ?? $card),
            'provider_response' => Arr::only($providerPayload, ['success', 'message', 'response', 'data']),
        ]);
    }

    private function transformCard(Card $card): array
    {
        return [
            'id' => $card->id,
            'type' => $card->type,
            'template_name' => $card->template_name,
            'holder_name' => $card->holder_name,
            'brand' => strtoupper($card->brand),
            'theme' => $card->theme,
            'status' => $card->status,
            'last4' => $card->last4,
            'masked_number' => $card->masked_number,
            'expiry_month' => $card->expiry_month,
            'expiry_year' => $card->expiry_year,
            'currency' => (string) data_get($card->meta, 'card_currency', 'USD'),
            'issued_at' => $card->issued_at?->toIso8601String(),
            'frozen_at' => $card->frozen_at?->toIso8601String(),
            'provider' => strtoupper((string) data_get($card->meta, 'provider', '')),
            'provider_card_id' => data_get($card->meta, 'provider_card_id'),
            'meta' => $this->publicMeta($card),
        ];
    }

    /**
     * @param  array<string, mixed>  $providerDetails
     * @return array<string, mixed>
     */
    private function sanitizeProviderDetails(array $providerDetails): array
    {
        return Arr::only(
            $providerDetails,
            [
                'card_id',
                'reference',
                'card_status',
                'last4',
                'expiry',
                'balance',
                'card_brand',
                'card_type',
                'card_user_id',
                'card_created_date',
                'billing_country',
                'billing_city',
            ]
        );
    }

    private function publicMeta(Card $card): array
    {
        return [
            'issuer' => data_get($card->meta, 'issuer'),
            'provider' => data_get($card->meta, 'provider'),
            'provider_status' => data_get($card->meta, 'provider_status'),
            'provider_card_id' => data_get($card->meta, 'provider_card_id'),
            'provider_details' => $this->sanitizeProviderDetails(
                (array) data_get($card->meta, 'provider_details', [])
            ),
            'provider_last_control_action' => data_get($card->meta, 'provider_last_control_action'),
            'provider_last_control_at' => data_get($card->meta, 'provider_last_control_at'),
            'provider_last_limit_upgrade_at' => data_get($card->meta, 'provider_last_limit_upgrade_at'),
            'provider_last_fund_at' => data_get($card->meta, 'provider_last_fund_at'),
            'provider_last_withdraw_at' => data_get($card->meta, 'provider_last_withdraw_at'),
            'card_local_balance' => data_get($card->meta, 'card_local_balance', 0),
            'funding_wallet_currency' => data_get($card->meta, 'funding_wallet_currency'),
            'card_currency' => data_get($card->meta, 'card_currency'),
            'issue_fee' => data_get($card->meta, 'issue_fee', 0),
            'prefund_amount' => data_get($card->meta, 'prefund_amount', 0),
        ];
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function splitName(string $fullName): array
    {
        $parts = preg_split('/\s+/', trim($fullName)) ?: [];
        $firstName = trim((string) ($parts[0] ?? 'NoorFi'));
        $lastName = trim((string) implode(' ', array_slice($parts, 1)));

        if ($lastName === '') {
            $lastName = 'User';
        }

        return [$firstName, $lastName];
    }
    private function resolveCardStatusFromPayload(string $currentStatus, string $providerStatus): string
    {
        $status = strtolower(trim($providerStatus));

        if (in_array($status, ['active', 'inactive', 'frozen', 'suspended', 'pending'], true)) {
            return $status;
        }

        return strtolower(trim($currentStatus)) !== ''
            ? strtolower(trim($currentStatus))
            : 'active';
    }

    private function resolveLocalCardBalance(Card $card): float
    {
        $balance = $this->resolveCardBalanceFromProvider((array) data_get($card->meta, 'provider_details', []));

        if ($balance !== null) {
            return $balance;
        }

        $fallback = data_get($card->meta, 'card_local_balance');

        return is_numeric($fallback) ? round((float) $fallback, 2) : 0.0;
    }

    /**
     * @param array<string, mixed> $providerDetails
     */
    private function resolveCardBalanceFromProvider(array $providerDetails): ?float
    {
        $candidate = data_get($providerDetails, 'balance');

        if (is_numeric($candidate)) {
            return round((float) $candidate, 2);
        }

        if (is_string($candidate)) {
            $normalized = preg_replace('/[^0-9\.-]/', '', $candidate) ?? '';
            if ($normalized !== '' && is_numeric($normalized)) {
                return round((float) $normalized, 2);
            }
        }

        return null;
    }

    private function isPendingProviderStatus(string $status): bool
    {
        $normalized = strtolower(trim($status));

        if ($normalized === '') {
            return false;
        }

        return in_array($normalized, ['pending', 'processing', 'in_review', 'queued'], true)
            || str_contains($normalized, 'pending')
            || str_contains($normalized, 'process')
            || str_contains($normalized, 'review')
            || str_contains($normalized, 'queue');
    }

    private function parseExpiry(string $expiry): array
    {
        if (preg_match('/^(?<month>\d{1,2})\/(?<year>\d{2,4})$/', trim($expiry), $matches) !== 1) {
            return [null, null];
        }

        $month = (int) $matches['month'];
        $year = (int) $matches['year'];

        if ($year < 100) {
            $year += 2000;
        }

        if ($month < 1 || $month > 12) {
            return [null, null];
        }

        return [$month, $year];
    }

    private function maskCardNumber(string $cardNumber, string $last4): string
    {
        $digits = preg_replace('/\D+/', '', $cardNumber);

        if ($digits !== null && strlen($digits) >= 8) {
            $first4 = substr($digits, 0, 4);
            $final4 = substr($digits, -4);

            return "{$first4} **** **** {$final4}";
        }

        $safeLast4 = str_pad($last4, 4, '*', STR_PAD_LEFT);

        return "**** **** **** {$safeLast4}";
    }

    private function formatCardNumber(string $digits): string
    {
        return trim(implode(' ', str_split($digits, 4)));
    }

    private function resolveProviderCardId(Card $card): string
    {
        return trim((string) (data_get($card->meta, 'provider_card_id') ?: ''));
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<int, array<string, mixed>>
     */
    private function normalizeProviderCardTransactions(array $payload): array
    {
        $source = data_get($payload, 'response.transactions');

        if (! is_array($source)) {
            $source = data_get($payload, 'response.data');
        }

        if (! is_array($source)) {
            $source = data_get($payload, 'data');
        }

        if (! is_array($source)) {
            $source = data_get($payload, 'response');
        }

        if (! is_array($source)) {
            return [];
        }

        $normalized = [];

        foreach ($source as $index => $row) {
            if (! is_array($row)) {
                continue;
            }

            $rawAmount = data_get($row, 'amount');
            if (! is_numeric($rawAmount)) {
                $rawAmount = data_get($row, 'transaction_amount', 0);
            }

            $amount = round((float) (is_numeric($rawAmount) ? $rawAmount : 0), 2);
            $direction = strtolower((string) (
                data_get($row, 'direction')
                ?: data_get($row, 'flow')
                ?: data_get($row, 'credit_debit')
                ?: ''
            ));

            if (! in_array($direction, ['credit', 'debit'], true)) {
                $direction = $amount < 0 ? 'debit' : 'credit';
            }

            $occurredAtRaw = (string) (
                data_get($row, 'occurred_at')
                ?: data_get($row, 'created_at')
                ?: data_get($row, 'transaction_date')
                ?: data_get($row, 'date')
                ?: ''
            );
            $occurredAt = $occurredAtRaw !== '' ? $this->toIso8601($occurredAtRaw) : null;

            $normalized[] = [
                'id' => (string) (
                    data_get($row, 'id')
                    ?: data_get($row, 'reference')
                    ?: 'provider_tx_' . ((int) $index + 1)
                ),
                'reference' => (string) (data_get($row, 'reference') ?: ''),
                'status' => strtolower((string) (
                    data_get($row, 'status')
                    ?: data_get($row, 'transaction_status')
                    ?: 'unknown'
                )),
                'type' => strtolower((string) (
                    data_get($row, 'type')
                    ?: data_get($row, 'transaction_type')
                    ?: 'card'
                )),
                'amount' => abs($amount),
                'currency' => strtoupper((string) (
                    data_get($row, 'currency')
                    ?: data_get($row, 'card_currency')
                    ?: 'USD'
                )),
                'direction' => $direction,
                'merchant' => (string) (
                    data_get($row, 'merchant')
                    ?: data_get($row, 'merchant_name')
                    ?: ''
                ),
                'description' => (string) (
                    data_get($row, 'description')
                    ?: data_get($row, 'narration')
                    ?: data_get($row, 'remark')
                    ?: 'Card transaction'
                ),
                'occurred_at' => $occurredAt,
                'raw' => Arr::only($row, [
                    'id',
                    'reference',
                    'status',
                    'transaction_status',
                    'type',
                    'transaction_type',
                    'amount',
                    'transaction_amount',
                    'currency',
                    'card_currency',
                    'merchant',
                    'merchant_name',
                    'description',
                    'narration',
                    'remark',
                    'created_at',
                    'transaction_date',
                    'date',
                ]),
            ];
        }

        usort($normalized, function (array $left, array $right): int {
            return strcmp(
                (string) ($right['occurred_at'] ?? ''),
                (string) ($left['occurred_at'] ?? '')
            );
        });

        return $normalized;
    }

    private function toIso8601(string $value): ?string
    {
        try {
            return Carbon::parse($value)->toIso8601String();
        } catch (\Throwable) {
            return null;
        }
    }
}




