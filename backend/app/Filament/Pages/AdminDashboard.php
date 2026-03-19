<?php

namespace App\Filament\Pages;

use App\Filament\Resources\Deposits\DepositResource;
use App\Filament\Resources\KycProfiles\KycProfileResource;
use App\Filament\Resources\ProviderWebhookLogs\ProviderWebhookLogResource;
use App\Filament\Resources\SupportTickets\SupportTicketResource;
use App\Filament\Resources\SystemSettings\SystemSettingResource;
use App\Filament\Resources\Users\UserResource;
use App\Filament\Resources\Withdrawals\WithdrawalResource;
use App\Filament\Widgets\AdminOverviewStatsWidget;
use App\Filament\Widgets\FailedProviderWebhookTableWidget;
use App\Filament\Widgets\OpenSupportTicketsTableWidget;
use App\Filament\Widgets\OperationsPulseStatsWidget;
use App\Filament\Widgets\PendingKycTableWidget;
use App\Filament\Widgets\ProviderHealthStatsWidget;
use App\Models\SystemSetting;
use App\Models\User;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\ActionGroup;
use Filament\Pages\Dashboard;
use Filament\Support\Icons\Heroicon;
use Illuminate\Contracts\Support\Htmlable;

class AdminDashboard extends Dashboard
{
    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedSquares2x2;

    protected static ?string $title = 'Control Center';

    public static function getNavigationLabel(): string
    {
        return 'Control Center';
    }

    public function getTitle(): string|Htmlable
    {
        return 'NoorFi Admin Control Center';
    }

    public function getSubheading(): ?string
    {
        return 'Unified command center for operations throughput, compliance queues, provider health, and risk signals.';
    }

    /**
     * @return array<class-string>
     */
    public function getWidgets(): array
    {
        return [
            AdminOverviewStatsWidget::class,
            OperationsPulseStatsWidget::class,
            ProviderHealthStatsWidget::class,
            PendingKycTableWidget::class,
            OpenSupportTicketsTableWidget::class,
            FailedProviderWebhookTableWidget::class,
        ];
    }

    public function getColumns(): int|array
    {
        return [
            'md' => 2,
            'xl' => 3,
        ];
    }

    protected function getHeaderActions(): array
    {
        $missingSettings = SystemSetting::query()->whereNull('value')->count();
        $user = auth()->user();
        $isSuperAdmin = $user instanceof User && $user->hasPanelRole(User::ADMIN_ROLE_SUPER_ADMIN);

        $actions = [];

        if (OperationsWorkflowCenterPage::canAccess()) {
            $actions[] = Action::make('workflowCenter')
                ->label('Workflow Center')
                ->icon('heroicon-o-view-columns')
                ->url(OperationsWorkflowCenterPage::getUrl());
        }

        $configurationActions = [];
        if (SystemSettingResource::canViewAny()) {
            $configurationActions[] = Action::make('systemSettings')
                    ->label($missingSettings > 0 ? "System Settings ({$missingSettings} missing)" : 'System Settings')
                    ->icon('heroicon-o-cog-6-tooth')
                    ->url(SystemSettingResource::getUrl());
        }
        if (StrowalletVirtualCardApiPage::canAccess()) {
            $configurationActions[] = Action::make('strowalletSetup')
                    ->label('Virtual Card API')
                    ->icon('heroicon-o-credit-card')
                    ->url(StrowalletVirtualCardApiPage::getUrl());
        }
        if (DiditKycApiPage::canAccess()) {
            $configurationActions[] = Action::make('diditSetup')
                    ->label('Didit KYC API')
                    ->icon('heroicon-o-shield-check')
                    ->url(DiditKycApiPage::getUrl());
        }
        if (BinancePayApiPage::canAccess()) {
            $configurationActions[] = Action::make('binanceSetup')
                    ->label('Binance Pay API')
                    ->icon('heroicon-o-bolt')
                    ->url(BinancePayApiPage::getUrl());
        }
        if (HeleketApiPage::canAccess()) {
            $configurationActions[] = Action::make('heleketSetup')
                    ->label('Heleket API')
                    ->icon('heroicon-o-building-library')
                    ->url(HeleketApiPage::getUrl());
        }
        if (MailProviderApiPage::canAccess()) {
            $configurationActions[] = Action::make('mailSetup')
                    ->label('Mail Provider')
                    ->icon('heroicon-o-envelope')
                    ->url(MailProviderApiPage::getUrl());
        }

        if ($configurationActions !== [] && $isSuperAdmin) {
            $actions[] = ActionGroup::make($configurationActions)
                ->label('Configuration')
                ->icon('heroicon-o-cog-6-tooth')
                ->button();
        }

        $operationActions = [];
        if (ProviderWebhookLogResource::canViewAny()) {
            $operationActions[] = Action::make('webhookLogs')
                    ->label('Webhook Logs')
                    ->icon('heroicon-o-signal')
                    ->url(ProviderWebhookLogResource::getUrl());
        }
        if (KycProfileResource::canViewAny()) {
            $operationActions[] = Action::make('kycQueue')
                    ->label('KYC Queue')
                    ->icon('heroicon-o-shield-check')
                    ->url(KycProfileResource::getUrl());
        }
        if (SupportTicketResource::canViewAny()) {
            $operationActions[] = Action::make('supportQueue')
                    ->label('Support Queue')
                    ->icon('heroicon-o-lifebuoy')
                    ->url(SupportTicketResource::getUrl());
        }
        if (DepositResource::canViewAny()) {
            $operationActions[] = Action::make('payments')
                    ->label('Deposits')
                    ->icon('heroicon-o-arrow-down-circle')
                    ->url(DepositResource::getUrl());
        }
        if (WithdrawalResource::canViewAny()) {
            $operationActions[] = Action::make('payouts')
                    ->label('Withdrawals')
                    ->icon('heroicon-o-arrow-up-circle')
                    ->url(WithdrawalResource::getUrl());
        }
        if (UserResource::canViewAny()) {
            $operationActions[] = Action::make('users')
                    ->label('Users')
                    ->icon('heroicon-o-users')
                    ->url(UserResource::getUrl());
        }

        if ($operationActions !== []) {
            $actions[] = ActionGroup::make($operationActions)
                ->label('Operations')
                ->icon('heroicon-o-arrows-right-left')
                ->button();
        }

        return $actions;
    }
}
