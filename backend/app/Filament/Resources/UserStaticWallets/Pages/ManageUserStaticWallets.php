<?php

namespace App\Filament\Resources\UserStaticWallets\Pages;

use App\Filament\Pages\OperationsWorkflowCenterPage;
use App\Filament\Resources\UserStaticWallets\UserStaticWalletResource;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ManageUserStaticWallets extends ManageRecords
{
    protected static string $resource = UserStaticWalletResource::class;

    public function getHeading(): string
    {
        return 'Static Deposit Wallets';
    }

    public function getSubheading(): ?string
    {
        return 'Manage generated provider wallet addresses and network mappings.';
    }

    public function getTabs(): array
    {
        return [
            'all' => Tab::make('All')
                ->badge(\App\Models\UserStaticWallet::query()->count()),
            'heleket' => Tab::make('Heleket')
                ->badge(\App\Models\UserStaticWallet::query()->where('provider', 'heleket')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('provider', 'heleket')),
            'binance_pay' => Tab::make('Binance Pay')
                ->badge(\App\Models\UserStaticWallet::query()->where('provider', 'binance_pay')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('provider', 'binance_pay')),
            'strowallet' => Tab::make('Strowallet')
                ->badge(\App\Models\UserStaticWallet::query()->where('provider', 'strowallet')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('provider', 'strowallet')),
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
