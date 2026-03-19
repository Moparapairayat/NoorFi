<?php

namespace App\Filament\Resources\SystemSettings\Pages;

use App\Filament\Pages\BinancePayApiPage;
use App\Filament\Pages\DiditKycApiPage;
use App\Filament\Pages\HeleketApiPage;
use App\Filament\Pages\MailProviderApiPage;
use App\Filament\Pages\OperationsWorkflowCenterPage;
use App\Filament\Pages\StrowalletVirtualCardApiPage;
use App\Filament\Resources\SystemSettings\SystemSettingResource;
use App\Models\SystemSetting;
use App\Services\ProviderConnectionTestService;
use Filament\Actions\Action;
use Filament\Actions\ActionGroup;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ManageRecords;
use Filament\Schemas\Components\Callout;
use Filament\Schemas\Components\EmbeddedTable;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\RenderHook;
use Filament\Schemas\Schema;
use Filament\Schemas\Components\Tabs\Tab;
use Filament\View\PanelsRenderHook;
use Illuminate\Database\Eloquent\Builder;

class ManageSystemSettings extends ManageRecords
{
    protected static string $resource = SystemSettingResource::class;

    public function mount(): void
    {
        parent::mount();

        if (SystemSetting::query()->doesntExist()) {
            SystemSetting::syncDefaults();
            SystemSetting::flushConfigCache();
        }
    }

    public function getHeading(): string
    {
        return 'System Configuration Center';
    }

    public function getSubheading(): ?string
    {
        return 'Manage core runtime keys here. Provider API keys are managed from dedicated setup pages.';
    }

    public function content(Schema $schema): Schema
    {
        return $schema
            ->components([
                Grid::make([
                    'md' => 2,
                ])
                    ->schema([
                        Callout::make('Core Runtime Health')
                            ->status(fn (): string => $this->missingVisibleCount() > 0 ? 'warning' : 'success')
                            ->icon('heroicon-o-cog-6-tooth')
                            ->description(fn (): string => sprintf(
                                '%d configured of %d visible keys. %d keys still missing values.',
                                $this->configuredVisibleCount(),
                                $this->totalVisibleCount(),
                                $this->missingVisibleCount(),
                            ))
                            ->actions([
                                Action::make('callout_sync_keys')
                                    ->label('Sync Keys')
                                    ->icon('heroicon-o-arrow-path')
                                    ->action(fn (): mixed => $this->syncDefaultsNow()),
                                Action::make('callout_refresh_cache')
                                    ->label('Refresh Cache')
                                    ->icon('heroicon-o-bolt')
                                    ->action(fn (): mixed => $this->refreshCacheNow()),
                            ]),
                        Callout::make('Provider Setup Pages')
                            ->info()
                            ->icon('heroicon-o-arrow-top-right-on-square')
                            ->description('Sensitive provider credentials are intentionally separated from core settings for safer operations.')
                            ->actions([
                                Action::make('callout_setup_strowallet')
                                    ->label('Virtual Card API')
                                    ->icon('heroicon-o-credit-card')
                                    ->url(StrowalletVirtualCardApiPage::getUrl()),
                                Action::make('callout_setup_didit')
                                    ->label('Didit KYC API')
                                    ->icon('heroicon-o-shield-check')
                                    ->url(DiditKycApiPage::getUrl()),
                                Action::make('callout_setup_binance')
                                    ->label('Binance Pay API')
                                    ->icon('heroicon-o-bolt')
                                    ->url(BinancePayApiPage::getUrl()),
                                Action::make('callout_setup_heleket')
                                    ->label('Heleket API')
                                    ->icon('heroicon-o-building-library')
                                    ->url(HeleketApiPage::getUrl()),
                                Action::make('callout_setup_mail')
                                    ->label('Mail Provider')
                                    ->icon('heroicon-o-envelope')
                                    ->url(MailProviderApiPage::getUrl()),
                            ]),
                    ]),
                $this->getTabsContentComponent(),
                RenderHook::make(PanelsRenderHook::RESOURCE_PAGES_LIST_RECORDS_TABLE_BEFORE),
                EmbeddedTable::make(),
                RenderHook::make(PanelsRenderHook::RESOURCE_PAGES_LIST_RECORDS_TABLE_AFTER),
            ]);
    }

    public function getTabs(): array
    {
        $hiddenModules = SystemSettingResource::hiddenModules();
        $visibleModules = SystemSettingResource::visibleModuleOptions();

        $tabs = [
            'all' => Tab::make('All')
                ->icon('heroicon-o-rectangle-stack')
                ->badge(SystemSetting::query()->whereNotIn('module', $hiddenModules)->count()),
            'missing' => Tab::make('Missing')
                ->icon('heroicon-o-exclamation-circle')
                ->badge(SystemSetting::query()->whereNotIn('module', $hiddenModules)->whereNull('value')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->whereNull('value')),
            'secrets' => Tab::make('Secrets')
                ->icon('heroicon-o-key')
                ->badge(SystemSetting::query()->whereNotIn('module', $hiddenModules)->where('is_secret', true)->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('is_secret', true)),
        ];

        foreach ($visibleModules as $module => $label) {
            $tabs[$module] = Tab::make($label)
                ->icon($this->moduleTabIcon($module))
                ->badge(SystemSetting::query()->where('module', $module)->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('module', $module));
        }

        return $tabs;
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('workflowCenter')
                ->label('Workflow Center')
                ->icon('heroicon-o-view-columns')
                ->visible(fn (): bool => OperationsWorkflowCenterPage::canAccess())
                ->url(OperationsWorkflowCenterPage::getUrl()),
            ActionGroup::make([
                Action::make('syncDefaults')
                    ->label('Sync Keys')
                    ->icon('heroicon-o-arrow-path')
                    ->requiresConfirmation()
                    ->action(fn (): mixed => $this->syncDefaultsNow()),
                Action::make('refreshCache')
                    ->label('Refresh Cache')
                    ->icon('heroicon-o-bolt')
                    ->action(fn (): mixed => $this->refreshCacheNow()),
            ])
                ->label('System Tools')
                ->icon('heroicon-o-cog-6-tooth')
                ->button(),
            ActionGroup::make([
                Action::make('strowalletSetup')
                    ->label('Virtual Card API')
                    ->icon('heroicon-o-credit-card')
                    ->url(StrowalletVirtualCardApiPage::getUrl()),
                Action::make('diditSetup')
                    ->label('Didit KYC API')
                    ->icon('heroicon-o-shield-check')
                    ->url(DiditKycApiPage::getUrl()),
                Action::make('binanceSetup')
                    ->label('Binance Pay API')
                    ->icon('heroicon-o-bolt')
                    ->url(BinancePayApiPage::getUrl()),
                Action::make('heleketSetup')
                    ->label('Heleket API')
                    ->icon('heroicon-o-building-library')
                    ->url(HeleketApiPage::getUrl()),
                Action::make('mailSetup')
                    ->label('Mail Provider')
                    ->icon('heroicon-o-envelope')
                    ->url(MailProviderApiPage::getUrl()),
            ])
                ->label('Provider Setup')
                ->icon('heroicon-o-arrow-top-right-on-square')
                ->button(),
            ActionGroup::make([
                Action::make('test_all')
                    ->label('Run All')
                    ->icon('heroicon-o-play')
                    ->action(function (): void {
                        $results = app(ProviderConnectionTestService::class)->runAll();
                        $this->sendTestSummaryNotification($results);
                    }),
                Action::make('test_didit')
                    ->label('Test Didit')
                    ->icon('heroicon-o-shield-check')
                    ->action(fn (): mixed => $this->runProviderTest('didit')),
                Action::make('test_strowallet')
                    ->label('Test Strowallet')
                    ->icon('heroicon-o-credit-card')
                    ->action(fn (): mixed => $this->runProviderTest('strowallet')),
                Action::make('test_heleket_deposit')
                    ->label('Test Heleket Deposit')
                    ->icon('heroicon-o-arrow-down-circle')
                    ->action(fn (): mixed => $this->runProviderTest('heleket_deposit')),
                Action::make('test_heleket_payout')
                    ->label('Test Heleket Payout')
                    ->icon('heroicon-o-arrow-up-circle')
                    ->action(fn (): mixed => $this->runProviderTest('heleket_payout')),
                Action::make('test_binance')
                    ->label('Test Binance Pay')
                    ->icon('heroicon-o-bolt')
                    ->action(fn (): mixed => $this->runProviderTest('binance_pay')),
            ])
                ->label('Quick Test')
                ->icon('heroicon-o-wifi')
                ->button(),
            ActionGroup::make([
                Action::make('didit_docs')
                    ->label('Didit Docs')
                    ->icon('heroicon-o-shield-check')
                    ->url('https://docs.didit.me', shouldOpenInNewTab: true),
                Action::make('strowallet_docs')
                    ->label('Strowallet Docs')
                    ->icon('heroicon-o-credit-card')
                    ->url('https://strowallet.readme.io/', shouldOpenInNewTab: true),
                Action::make('heleket_docs')
                    ->label('Heleket Docs')
                    ->icon('heroicon-o-arrow-down-circle')
                    ->url('https://doc.heleket.com/', shouldOpenInNewTab: true),
                Action::make('binance_docs')
                    ->label('Binance Pay Docs')
                    ->icon('heroicon-o-bolt')
                    ->url('https://developers.binance.com/docs/binance-pay/introduction', shouldOpenInNewTab: true),
            ])
                ->label('Provider Docs')
                ->icon('heroicon-o-book-open')
                ->button(),
        ];
    }

    private function syncDefaultsNow(): void
    {
        SystemSetting::syncDefaults();
        SystemSetting::flushConfigCache();

        Notification::make()
            ->success()
            ->title('System setting keys synchronized.')
            ->send();
    }

    private function refreshCacheNow(): void
    {
        SystemSetting::flushConfigCache();

        Notification::make()
            ->success()
            ->title('Runtime settings cache refreshed.')
            ->send();
    }

    private function totalVisibleCount(): int
    {
        return SystemSetting::query()
            ->whereIn('module', SystemSettingResource::visibleModuleKeys())
            ->count();
    }

    private function configuredVisibleCount(): int
    {
        return SystemSetting::query()
            ->whereIn('module', SystemSettingResource::visibleModuleKeys())
            ->whereNotNull('value')
            ->count();
    }

    private function missingVisibleCount(): int
    {
        return max($this->totalVisibleCount() - $this->configuredVisibleCount(), 0);
    }

    private function moduleTabIcon(string $module): string
    {
        return match (strtolower(trim($module))) {
            'app' => 'heroicon-o-cog-6-tooth',
            'providers' => 'heroicon-o-cube-transparent',
            default => 'heroicon-o-rectangle-stack',
        };
    }

    private function runProviderTest(string $provider): void
    {
        $result = app(ProviderConnectionTestService::class)->run($provider);
        $this->sendSingleResultNotification($result);
    }

    /**
     * @param  array<string, mixed>  $result
     */
    private function sendSingleResultNotification(array $result): void
    {
        $status = (string) ($result['status'] ?? 'info');

        $notification = Notification::make()
            ->title((string) ($result['title'] ?? 'Provider Test'))
            ->body((string) ($result['message'] ?? 'No details returned.'));

        match ($status) {
            'success' => $notification->success(),
            'warning' => $notification->warning(),
            'danger' => $notification->danger(),
            default => $notification->info(),
        };

        $notification->send();
    }

    /**
     * @param  array<int, array<string, mixed>>  $results
     */
    private function sendTestSummaryNotification(array $results): void
    {
        $counts = [
            'success' => 0,
            'warning' => 0,
            'danger' => 0,
        ];

        foreach ($results as $result) {
            $status = (string) ($result['status'] ?? '');
            if (array_key_exists($status, $counts)) {
                $counts[$status]++;
            }
        }

        $overallStatus = $counts['danger'] > 0
            ? 'danger'
            : ($counts['warning'] > 0 ? 'warning' : 'success');

        $lines = [];
        foreach ($results as $result) {
            $provider = strtoupper(str_replace('_', ' ', (string) ($result['provider'] ?? '-')));
            $title = (string) ($result['title'] ?? 'Result');
            $lines[] = "{$provider}: {$title}";
        }

        $notification = Notification::make()
            ->title("Quick Test Result: {$counts['success']} ok, {$counts['warning']} warning, {$counts['danger']} error")
            ->body(implode("\n", $lines));

        match ($overallStatus) {
            'success' => $notification->success(),
            'warning' => $notification->warning(),
            default => $notification->danger(),
        };

        $notification->send();
    }
}
