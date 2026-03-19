<?php

namespace App\Filament\Pages;

use App\Filament\Resources\Cards\CardResource;
use App\Filament\Resources\Deposits\DepositResource;
use App\Filament\Resources\Exchanges\ExchangeResource;
use App\Filament\Resources\KycProfiles\KycProfileResource;
use App\Filament\Resources\ProviderWebhookLogs\ProviderWebhookLogResource;
use App\Filament\Resources\SupportTickets\SupportTicketResource;
use App\Filament\Resources\Transactions\TransactionResource;
use App\Filament\Resources\Transfers\TransferResource;
use App\Filament\Resources\Users\UserResource;
use App\Filament\Resources\Wallets\WalletResource;
use App\Filament\Resources\Withdrawals\WithdrawalResource;
use App\Models\Card;
use App\Models\Deposit;
use App\Models\Exchange;
use App\Models\KycProfile;
use App\Models\SupportTicket;
use App\Models\Transaction;
use App\Models\Transfer;
use App\Models\User;
use App\Models\Withdrawal;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Pages\Page;
use Filament\Schemas\Components\Callout;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Illuminate\Contracts\Support\Htmlable;
use UnitEnum;

class OperationsWorkflowCenterPage extends Page
{
    protected static ?string $title = 'Workflow Center';

    protected static ?string $slug = 'workflow-center';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedViewColumns;

    protected static ?string $navigationLabel = 'Workflow Center';

    protected static string|UnitEnum|null $navigationGroup = 'Operations';

    protected static ?int $navigationSort = 5;

    public static function canAccess(): bool
    {
        $user = auth()->user();

        return $user instanceof User && $user->hasAnyPanelRole([
            User::ADMIN_ROLE_SUPER_ADMIN,
            User::ADMIN_ROLE_OPERATIONS,
            User::ADMIN_ROLE_COMPLIANCE,
        ]);
    }

    public function getTitle(): string|Htmlable
    {
        return 'NoorFi Workflow Center';
    }

    public function getSubheading(): ?string
    {
        return 'Single place for operations queues, compliance tasks, provider monitoring, and daily execution flow.';
    }

    public function content(Schema $schema): Schema
    {
        return $schema
            ->components([
                Grid::make([
                    'md' => 2,
                    'xl' => 3,
                ])
                    ->schema([
                        Callout::make('Operations Queue')
                            ->status(fn (): string => $this->operationsBacklogCount() > 0 ? 'warning' : 'success')
                            ->icon('heroicon-o-arrow-path-rounded-square')
                            ->description(fn (): string => sprintf(
                                'Deposits: %d pending, Withdrawals: %d pending, Transfers: %d pending, Exchanges: %d pending.',
                                $this->pendingDepositsCount(),
                                $this->pendingWithdrawalsCount(),
                                $this->pendingTransfersCount(),
                                $this->pendingExchangesCount(),
                            ))
                            ->actions([
                                Action::make('open_deposits_queue')
                                    ->label('Deposits')
                                    ->icon('heroicon-o-arrow-down-circle')
                                    ->visible(fn (): bool => DepositResource::canViewAny())
                                    ->url(DepositResource::getUrl()),
                                Action::make('open_withdrawals_queue')
                                    ->label('Withdrawals')
                                    ->icon('heroicon-o-arrow-up-circle')
                                    ->visible(fn (): bool => WithdrawalResource::canViewAny())
                                    ->url(WithdrawalResource::getUrl()),
                                Action::make('open_transfers_queue')
                                    ->label('Transfers')
                                    ->icon('heroicon-o-paper-airplane')
                                    ->visible(fn (): bool => TransferResource::canViewAny())
                                    ->url(TransferResource::getUrl()),
                                Action::make('open_exchanges_queue')
                                    ->label('Exchanges')
                                    ->icon('heroicon-o-arrows-right-left')
                                    ->visible(fn (): bool => ExchangeResource::canViewAny())
                                    ->url(ExchangeResource::getUrl()),
                            ]),
                        Callout::make('Compliance & Support Queue')
                            ->status(fn (): string => $this->complianceBacklogCount() > 0 ? 'warning' : 'success')
                            ->icon('heroicon-o-shield-check')
                            ->description(fn (): string => sprintf(
                                'KYC waiting: %d, Open support tickets: %d.',
                                $this->pendingKycCount(),
                                $this->openSupportTicketsCount(),
                            ))
                            ->actions([
                                Action::make('open_kyc_queue')
                                    ->label('KYC Queue')
                                    ->icon('heroicon-o-shield-check')
                                    ->visible(fn (): bool => KycProfileResource::canViewAny())
                                    ->url(KycProfileResource::getUrl()),
                                Action::make('open_support_queue')
                                    ->label('Support Queue')
                                    ->icon('heroicon-o-lifebuoy')
                                    ->visible(fn (): bool => SupportTicketResource::canViewAny())
                                    ->url(SupportTicketResource::getUrl()),
                            ]),
                        Callout::make('Customer & Card Lifecycle')
                            ->info()
                            ->icon('heroicon-o-users')
                            ->description(fn (): string => sprintf(
                                'Users: %d, Cards pending/frozen: %d, Ledger pending: %d.',
                                User::query()->count(),
                                $this->cardAttentionCount(),
                                $this->pendingTransactionsCount(),
                            ))
                            ->actions([
                                Action::make('open_users')
                                    ->label('Users')
                                    ->icon('heroicon-o-user-group')
                                    ->visible(fn (): bool => UserResource::canViewAny())
                                    ->url(UserResource::getUrl()),
                                Action::make('open_wallets')
                                    ->label('Wallets')
                                    ->icon('heroicon-o-wallet')
                                    ->visible(fn (): bool => WalletResource::canViewAny())
                                    ->url(WalletResource::getUrl()),
                                Action::make('open_cards')
                                    ->label('Cards')
                                    ->icon('heroicon-o-credit-card')
                                    ->visible(fn (): bool => CardResource::canViewAny())
                                    ->url(CardResource::getUrl()),
                                Action::make('open_transactions')
                                    ->label('Ledger')
                                    ->icon('heroicon-o-list-bullet')
                                    ->visible(fn (): bool => TransactionResource::canViewAny())
                                    ->url(TransactionResource::getUrl()),
                            ]),
                    ]),
                Section::make('Workflow Runbook')
                    ->description('Recommended execution order to keep operations clean and reduce manual mistakes.')
                    ->columns([
                        'md' => 2,
                        'xl' => 3,
                    ])
                    ->schema([
                        Callout::make('Start of Shift')
                            ->status('info')
                            ->icon('heroicon-o-play-circle')
                            ->description('1) Check provider webhooks. 2) Clear pending deposit/withdraw queues. 3) Review failed events.')
                            ->actions([
                                Action::make('runbook_webhook_logs')
                                    ->label('Open Webhook Logs')
                                    ->icon('heroicon-o-signal')
                                    ->visible(fn (): bool => ProviderWebhookLogResource::canViewAny())
                                    ->url(ProviderWebhookLogResource::getUrl()),
                            ]),
                        Callout::make('Compliance Pass')
                            ->status('warning')
                            ->icon('heroicon-o-shield-exclamation')
                            ->description('Review submitted/in-review KYC first. Resolve linked support tickets after KYC decision.')
                            ->actions([
                                Action::make('runbook_kyc')
                                    ->label('Review KYC')
                                    ->icon('heroicon-o-shield-check')
                                    ->visible(fn (): bool => KycProfileResource::canViewAny())
                                    ->url(KycProfileResource::getUrl()),
                                Action::make('runbook_support')
                                    ->label('Review Tickets')
                                    ->icon('heroicon-o-lifebuoy')
                                    ->visible(fn (): bool => SupportTicketResource::canViewAny())
                                    ->url(SupportTicketResource::getUrl()),
                            ]),
                        Callout::make('Settlement Check')
                            ->status('success')
                            ->icon('heroicon-o-check-badge')
                            ->description('Verify completed settlements in deposits, withdrawals, and transactions to keep balances reconciled.')
                            ->actions([
                                Action::make('runbook_deposits')
                                    ->label('Deposits')
                                    ->icon('heroicon-o-arrow-down-circle')
                                    ->visible(fn (): bool => DepositResource::canViewAny())
                                    ->url(DepositResource::getUrl()),
                                Action::make('runbook_withdrawals')
                                    ->label('Withdrawals')
                                    ->icon('heroicon-o-arrow-up-circle')
                                    ->visible(fn (): bool => WithdrawalResource::canViewAny())
                                    ->url(WithdrawalResource::getUrl()),
                                Action::make('runbook_ledger')
                                    ->label('Transactions')
                                    ->icon('heroicon-o-list-bullet')
                                    ->visible(fn (): bool => TransactionResource::canViewAny())
                                    ->url(TransactionResource::getUrl()),
                            ]),
                    ]),
            ]);
    }

    public static function getNavigationBadge(): ?string
    {
        $count = Deposit::query()->whereIn('status', ['pending', 'processing'])->count()
            + Withdrawal::query()->whereIn('status', ['pending', 'processing'])->count()
            + Transfer::query()->whereIn('status', ['pending', 'processing'])->count()
            + Exchange::query()->whereIn('status', ['pending', 'processing'])->count()
            + KycProfile::query()->whereIn('status', ['submitted', 'in_review'])->count()
            + SupportTicket::query()->whereIn('status', ['open', 'in_progress'])->count();

        return $count > 0 ? (string) $count : null;
    }

    public static function getNavigationBadgeColor(): string|array|null
    {
        return 'warning';
    }

    public static function getNavigationBadgeTooltip(): ?string
    {
        return 'Total items waiting in key operational queues.';
    }

    private function operationsBacklogCount(): int
    {
        return $this->pendingDepositsCount()
            + $this->pendingWithdrawalsCount()
            + $this->pendingTransfersCount()
            + $this->pendingExchangesCount();
    }

    private function complianceBacklogCount(): int
    {
        return $this->pendingKycCount() + $this->openSupportTicketsCount();
    }

    private function pendingDepositsCount(): int
    {
        return Deposit::query()->whereIn('status', ['pending', 'processing'])->count();
    }

    private function pendingWithdrawalsCount(): int
    {
        return Withdrawal::query()->whereIn('status', ['pending', 'processing'])->count();
    }

    private function pendingTransfersCount(): int
    {
        return Transfer::query()->whereIn('status', ['pending', 'processing'])->count();
    }

    private function pendingExchangesCount(): int
    {
        return Exchange::query()->whereIn('status', ['pending', 'processing'])->count();
    }

    private function pendingTransactionsCount(): int
    {
        return Transaction::query()->whereIn('status', ['pending', 'processing'])->count();
    }

    private function pendingKycCount(): int
    {
        return KycProfile::query()->whereIn('status', ['submitted', 'in_review'])->count();
    }

    private function openSupportTicketsCount(): int
    {
        return SupportTicket::query()->whereIn('status', ['open', 'in_progress'])->count();
    }

    private function cardAttentionCount(): int
    {
        return Card::query()->whereIn('status', ['pending', 'frozen'])->count();
    }
}
