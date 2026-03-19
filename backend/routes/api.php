<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CardController;
use App\Http\Controllers\Api\DepositController;
use App\Http\Controllers\Api\ExchangeController;
use App\Http\Controllers\Api\KycController;
use App\Http\Controllers\Api\SupportTicketController;
use App\Http\Controllers\Api\SystemHealthController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\TransferController;
use App\Http\Controllers\Api\WalletController;
use App\Http\Controllers\Api\WithdrawController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('/login', [AuthController::class, 'loginWithPassword'])
        ->middleware('throttle:auth-login');
    Route::post('/otp/request', [AuthController::class, 'requestOtp'])
        ->middleware('throttle:auth-otp-request');
    Route::post('/otp/verify', [AuthController::class, 'verifyOtp'])
        ->middleware('throttle:auth-otp-verify');
    Route::post('/password/otp/request', [AuthController::class, 'requestPasswordResetOtp'])
        ->middleware('throttle:auth-password-reset-request');
    Route::post('/password/reset', [AuthController::class, 'resetPassword'])
        ->middleware('throttle:auth-password-reset');
});

Route::post('/kyc/didit/webhook', [KycController::class, 'diditWebhook'])
    ->middleware('throttle:provider-webhook');
Route::get('/kyc/didit/callback', [KycController::class, 'diditCallback']);
Route::post('/deposits/heleket/webhook', [DepositController::class, 'heleketWebhook'])
    ->middleware('throttle:provider-webhook');
Route::post('/withdrawals/heleket/webhook', [WithdrawController::class, 'heleketWebhook'])
    ->middleware('throttle:provider-webhook');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::prefix('auth')->group(function (): void {
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::post('/set-pin', [AuthController::class, 'setPin'])
            ->middleware('throttle:sensitive-action');
        Route::post('/logout', [AuthController::class, 'logout']);
    });

    Route::get('/system/provider-health', [SystemHealthController::class, 'providerHealth'])
        ->middleware('throttle:sensitive-action');

    Route::get('/wallets', [WalletController::class, 'index']);
    Route::get('/wallets/{wallet}', [WalletController::class, 'show']);

    Route::get('/kyc/profile', [KycController::class, 'show']);
    Route::post('/kyc/profile', [KycController::class, 'upsert']);
    Route::post('/kyc/didit/session', [KycController::class, 'startDiditSession']);
    Route::get('/kyc/didit/session/status', [KycController::class, 'diditSessionStatus']);
    Route::post('/support/tickets', [SupportTicketController::class, 'store']);

    Route::get('/cards', [CardController::class, 'index']);
    Route::get('/cards/{card}', [CardController::class, 'show']);
    Route::post('/cards/apply', [CardController::class, 'applyVirtual']);
    Route::post('/cards/{card}/reveal', [CardController::class, 'reveal']);
    Route::post('/cards/{card}/freeze', [CardController::class, 'freeze']);
    Route::post('/cards/{card}/unfreeze', [CardController::class, 'unfreeze']);
    Route::post('/cards/{card}/add-fund', [CardController::class, 'addFund']);
    Route::post('/cards/{card}/withdraw', [CardController::class, 'withdrawFromCard']);
    Route::post('/cards/{card}/upgrade-limit', [CardController::class, 'upgradeLimit']);
    Route::get('/cards/{card}/provider-transactions', [CardController::class, 'providerTransactions']);

    Route::get('/deposits/options', [DepositController::class, 'options']);
    Route::get('/deposits', [DepositController::class, 'index']);
    Route::post('/deposits', [DepositController::class, 'store']);
    Route::get('/deposits/{deposit}', [DepositController::class, 'show']);
    Route::post('/deposits/{deposit}/sync', [DepositController::class, 'sync']);
    Route::post('/deposits/{deposit}/confirm', [DepositController::class, 'confirm']);

    Route::get('/transfers', [TransferController::class, 'index']);
    Route::post('/transfers', [TransferController::class, 'store']);
    Route::get('/transfers/{transfer}', [TransferController::class, 'show']);

    Route::get('/withdrawals/options', [WithdrawController::class, 'options']);
    Route::get('/withdrawals', [WithdrawController::class, 'index']);
    Route::post('/withdrawals', [WithdrawController::class, 'store']);
    Route::get('/withdrawals/{withdrawal}', [WithdrawController::class, 'show']);

    Route::get('/exchanges/rates', [ExchangeController::class, 'rates']);
    Route::post('/exchanges/quote', [ExchangeController::class, 'quote']);
    Route::get('/exchanges', [ExchangeController::class, 'index']);
    Route::post('/exchanges', [ExchangeController::class, 'store']);
    Route::get('/exchanges/{exchange}', [ExchangeController::class, 'show']);

    Route::get('/transactions', [TransactionController::class, 'index']);
    Route::get('/transactions/{transaction}', [TransactionController::class, 'show']);
});

