<?php

namespace App\Filament\Widgets;

use App\Filament\Resources\Deposits\DepositResource;
use App\Filament\Resources\KycProfiles\KycProfileResource;
use App\Filament\Resources\SupportTickets\SupportTicketResource;
use App\Filament\Resources\SystemSettings\SystemSettingResource;
use App\Filament\Resources\Users\UserResource;
use App\Filament\Resources\Wallets\WalletResource;
use App\Filament\Resources\Withdrawals\WithdrawalResource;
use App\Models\Deposit;
use App\Models\KycProfile;
use App\Models\SystemSetting;
use App\Models\SupportTicket;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Withdrawal;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class AdminOverviewStatsWidget extends StatsOverviewWidget
{
    protected static ?int $sort = 1;

    protected int|string|array $columnSpan = 'full';

    protected ?string $pollingInterval = '15s';

    public static function canView(): bool
    {
        $user = auth()->user();

        return $user instanceof User && $user->hasAnyPanelRole([
            User::ADMIN_ROLE_SUPER_ADMIN,
            User::ADMIN_ROLE_OPERATIONS,
            User::ADMIN_ROLE_SUPPORT,
            User::ADMIN_ROLE_COMPLIANCE,
        ]);
    }

    /**
     * @return array<Stat>
     */
    protected function getStats(): array
    {
        $userCount = User::query()->count();
        $walletCount = Wallet::query()->count();
        $walletFloat = (float) Wallet::query()->sum('balance');
        $pendingKyc = KycProfile::query()->whereIn('status', ['submitted', 'in_review'])->count();
        $openTickets = SupportTicket::query()->whereIn('status', ['open', 'in_progress'])->count();
        $pendingDeposits = Deposit::query()->whereIn('status', ['pending', 'processing'])->count();
        $pendingWithdrawals = Withdrawal::query()->whereIn('status', ['pending', 'processing'])->count();
        $unconfiguredKeys = SystemSetting::query()->whereNull('value')->count();

        return [
            Stat::make('Total Users', number_format($userCount))
                ->description('Registered customer accounts')
                ->descriptionIcon('heroicon-m-user-group')
                ->color('primary')
                ->url(UserResource::getUrl()),

            Stat::make('Wallet Accounts', number_format($walletCount))
                ->description('Across USD, USDT, SOL')
                ->descriptionIcon('heroicon-m-wallet')
                ->color('info')
                ->url(WalletResource::getUrl()),

            Stat::make('Platform Float', '$' . number_format($walletFloat, 2))
                ->description('Current total wallet balance')
                ->descriptionIcon('heroicon-m-banknotes')
                ->color('success')
                ->url(WalletResource::getUrl()),

            Stat::make('KYC Queue', (string) $pendingKyc)
                ->description('Submitted + in review')
                ->descriptionIcon('heroicon-m-shield-check')
                ->color($pendingKyc > 0 ? 'warning' : 'success')
                ->url(KycProfileResource::getUrl()),

            Stat::make('Support Queue', (string) $openTickets)
                ->description('Open + in progress')
                ->descriptionIcon('heroicon-m-lifebuoy')
                ->color($openTickets > 0 ? 'warning' : 'success')
                ->url(SupportTicketResource::getUrl()),

            Stat::make('Pending Deposits', (string) $pendingDeposits)
                ->description('Awaiting provider completion')
                ->descriptionIcon('heroicon-m-arrow-down-circle')
                ->color($pendingDeposits > 0 ? 'warning' : 'success')
                ->url(DepositResource::getUrl()),

            Stat::make('Pending Withdrawals', (string) $pendingWithdrawals)
                ->description('Awaiting provider completion')
                ->descriptionIcon('heroicon-m-arrow-up-circle')
                ->color($pendingWithdrawals > 0 ? 'warning' : 'success')
                ->url(WithdrawalResource::getUrl()),

            Stat::make('Unconfigured Keys', (string) $unconfiguredKeys)
                ->description('System setting keys missing value')
                ->descriptionIcon('heroicon-m-cog-6-tooth')
                ->color($unconfiguredKeys > 0 ? 'danger' : 'success')
                ->url(SystemSettingResource::getUrl()),
        ];
    }
}
