<?php

namespace Database\Seeders;

use App\Models\Card;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Support\Facades\Hash;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        SystemSetting::syncDefaults();

        $admins = $this->seedAdminUsers();
        $admin = $admins[User::ADMIN_ROLE_SUPER_ADMIN];

        $user = User::query()->updateOrCreate(
            ['email' => 'demo@noorfi.com'],
            [
                'name' => 'MOPARA PAIR AYAT',
                'full_name' => 'MOPARA PAIR AYAT',
                'password' => Hash::make('Demo@12345'),
                'email_verified_at' => now(),
                'transaction_pin' => Hash::make('1234'),
                'kyc_status' => 'approved',
                'account_status' => 'active',
                'is_admin' => false,
                'admin_role' => null,
                'last_login_at' => now(),
            ],
        );

        $this->seedWallets($admin, [
            'usd' => 50000,
            'usdt' => 50000,
            'sol' => 500,
        ]);

        $userWallets = $this->seedWallets($user, [
            'usd' => 1420.75,
            'usdt' => 890.10,
            'sol' => 14.35,
        ]);

        Card::query()->firstOrCreate([
            'user_id' => $user->id,
            'type' => 'virtual',
            'template_name' => 'USDC',
        ], [
            'wallet_id' => $userWallets['usd']->id,
            'holder_name' => 'MOPARA PAIR AYAT',
            'brand' => 'visa',
            'theme' => 'islamic-emerald',
            'status' => 'active',
            'last4' => '9027',
            'masked_number' => '**** **** **** 9027',
            'expiry_month' => 12,
            'expiry_year' => (int) now()->addYears(3)->format('Y'),
            'issued_at' => now()->subWeeks(2),
            'meta' => [
                'issuer' => 'NoorFi',
            ],
        ]);
    }

    /**
     * @return array<string, User>
     */
    private function seedAdminUsers(): array
    {
        $accounts = [
            User::ADMIN_ROLE_SUPER_ADMIN => [
                'email' => 'admin@noorfi.com',
                'name' => 'NoorFi Super Admin',
                'password' => 'Admin@12345',
            ],
            User::ADMIN_ROLE_OPERATIONS => [
                'email' => 'ops@noorfi.com',
                'name' => 'NoorFi Operations',
                'password' => 'Ops@12345',
            ],
            User::ADMIN_ROLE_SUPPORT => [
                'email' => 'support@noorfi.com',
                'name' => 'NoorFi Support',
                'password' => 'Support@12345',
            ],
            User::ADMIN_ROLE_COMPLIANCE => [
                'email' => 'compliance@noorfi.com',
                'name' => 'NoorFi Compliance',
                'password' => 'Compliance@12345',
            ],
        ];

        $admins = [];

        foreach ($accounts as $role => $account) {
            $admins[$role] = User::query()->updateOrCreate(
                ['email' => $account['email']],
                [
                    'name' => $account['name'],
                    'full_name' => $account['name'],
                    'password' => Hash::make($account['password']),
                    'email_verified_at' => now(),
                    'transaction_pin' => Hash::make('1234'),
                    'kyc_status' => 'approved',
                    'account_status' => 'active',
                    'is_admin' => true,
                    'admin_role' => $role,
                    'last_login_at' => now(),
                ],
            );
        }

        return $admins;
    }

    private function seedWallets(User $user, array $balances): array
    {
        $wallets = [];

        foreach ($balances as $currency => $balance) {
            $wallets[$currency] = Wallet::query()->updateOrCreate(
                [
                    'user_id' => $user->id,
                    'currency' => strtolower($currency),
                ],
                [
                    'balance' => $balance,
                    'locked_balance' => 0,
                    'is_active' => true,
                    'last_activity_at' => now(),
                ],
            );
        }

        return $wallets;
    }
}
