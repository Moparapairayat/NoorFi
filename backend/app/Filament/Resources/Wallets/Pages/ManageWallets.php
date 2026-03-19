<?php

namespace App\Filament\Resources\Wallets\Pages;

use App\Filament\Pages\OperationsWorkflowCenterPage;
use App\Filament\Resources\Wallets\WalletResource;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ManageWallets extends ManageRecords
{
    protected static string $resource = WalletResource::class;

    public function getHeading(): string
    {
        return 'Wallet Inventory';
    }

    public function getSubheading(): ?string
    {
        return 'Manage user wallets, currency allocation, and active/inactive states.';
    }

    public function getTabs(): array
    {
        return [
            'all' => Tab::make('All')
                ->badge(\App\Models\Wallet::query()->count()),
            'usd' => Tab::make('USD')
                ->badge(\App\Models\Wallet::query()->where('currency', 'usd')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('currency', 'usd')),
            'usdt' => Tab::make('USDT')
                ->badge(\App\Models\Wallet::query()->where('currency', 'usdt')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('currency', 'usdt')),
            'sol' => Tab::make('SOL')
                ->badge(\App\Models\Wallet::query()->where('currency', 'sol')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('currency', 'sol')),
            'inactive' => Tab::make('Inactive')
                ->badge(\App\Models\Wallet::query()->where('is_active', false)->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('is_active', false)),
        ];
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('workflow_center')
                ->label('Workflow Center')
                ->icon('heroicon-o-view-columns')
                ->visible(fn (): bool => OperationsWorkflowCenterPage::canAccess())
                ->url(OperationsWorkflowCenterPage::getUrl()),
            CreateAction::make(),
        ];
    }
}
