<?php

namespace Tests\Feature;

use App\Models\Deposit;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DepositConfirmTest extends TestCase
{
    use RefreshDatabase;

    public function test_non_admin_cannot_confirm_deposit(): void
    {
        $deposit = $this->makePendingDeposit();
        $nonAdmin = User::factory()->create([
            'is_admin' => false,
        ]);

        Sanctum::actingAs($nonAdmin);

        $response = $this->postJson("/api/deposits/{$deposit->id}/confirm");

        $response->assertForbidden();

        $deposit->refresh();
        $wallet = Wallet::query()->findOrFail($deposit->wallet_id);

        $this->assertSame('pending', $deposit->status);
        $this->assertNull($deposit->credited_at);
        $this->assertSame(50.0, (float) $wallet->balance);
        $this->assertSame(0, Transaction::query()->count());
    }

    public function test_admin_can_confirm_pending_deposit_and_credit_wallet(): void
    {
        $deposit = $this->makePendingDeposit();
        $admin = User::factory()->create([
            'is_admin' => true,
        ]);

        Sanctum::actingAs($admin);

        $response = $this->postJson("/api/deposits/{$deposit->id}/confirm", [
            'provider_reference' => 'STRW-001',
            'provider_tx_hash' => 'tx_abc123',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('deposit.status', 'completed');

        $deposit->refresh();
        $wallet = Wallet::query()->findOrFail($deposit->wallet_id);
        $transaction = Transaction::query()->first();

        $this->assertSame('completed', $deposit->status);
        $this->assertNotNull($deposit->credited_at);
        $this->assertSame(149.75, (float) $wallet->balance);
        $this->assertNotNull($transaction);
        $this->assertSame('deposit', $transaction->type);
        $this->assertSame('credit', $transaction->direction);
        $this->assertSame("{$deposit->reference}-C", $transaction->reference);
        $this->assertSame(100.0, (float) $transaction->amount);
        $this->assertSame(0.25, (float) $transaction->fee);
        $this->assertSame(99.75, (float) $transaction->net_amount);
    }

    public function test_confirm_endpoint_is_idempotent_for_completed_deposit(): void
    {
        $deposit = $this->makePendingDeposit();
        $admin = User::factory()->create([
            'is_admin' => true,
        ]);

        Sanctum::actingAs($admin);

        $this->postJson("/api/deposits/{$deposit->id}/confirm")
            ->assertOk()
            ->assertJsonPath('message', 'Deposit confirmed and wallet credited.');

        $second = $this->postJson("/api/deposits/{$deposit->id}/confirm");

        $second
            ->assertOk()
            ->assertJsonPath('message', 'Deposit already confirmed.');

        $wallet = Wallet::query()->findOrFail($deposit->wallet_id);

        $this->assertSame(149.75, (float) $wallet->balance);
        $this->assertSame(1, Transaction::query()->count());
    }

    private function makePendingDeposit(): Deposit
    {
        $user = User::factory()->create([
            'is_admin' => false,
        ]);

        $wallet = Wallet::query()->create([
            'user_id' => $user->id,
            'currency' => 'usd',
            'balance' => 50,
            'locked_balance' => 0,
            'is_active' => true,
        ]);

        return Deposit::query()->create([
            'user_id' => $user->id,
            'wallet_id' => $wallet->id,
            'method' => 'binance_pay',
            'amount' => 100,
            'fee' => 0.25,
            'net_amount' => 99.75,
            'status' => 'pending',
            'reference' => 'DEP-TST-' . strtoupper(substr(sha1((string) microtime(true)), 0, 10)),
            'note' => null,
            'instructions' => [
                'merchant_name' => 'NoorFi',
                'binance_pay_id' => 'NOORFI-9074458',
            ],
            'credited_at' => null,
        ]);
    }
}
