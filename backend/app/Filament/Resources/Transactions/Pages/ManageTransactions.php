<?php

namespace App\Filament\Resources\Transactions\Pages;

use App\Filament\Pages\OperationsWorkflowCenterPage;
use App\Filament\Resources\Transactions\TransactionResource;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ManageTransactions extends ManageRecords
{
    protected static string $resource = TransactionResource::class;

    public function getHeading(): string
    {
        return 'Transaction Ledger';
    }

    public function getSubheading(): ?string
    {
        return 'Unified ledger for deposits, transfers, withdrawals, and exchange movements.';
    }

    public function getTabs(): array
    {
        return [
            'all' => Tab::make('All')
                ->badge(\App\Models\Transaction::query()->count()),
            'pending' => Tab::make('Pending')
                ->badge(\App\Models\Transaction::query()->whereIn('status', ['pending', 'processing'])->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->whereIn('status', ['pending', 'processing'])),
            'completed' => Tab::make('Completed')
                ->badge(\App\Models\Transaction::query()->where('status', 'completed')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'completed')),
            'failed' => Tab::make('Failed')
                ->badge(\App\Models\Transaction::query()->whereIn('status', ['failed', 'cancelled', 'reversed'])->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->whereIn('status', ['failed', 'cancelled', 'reversed'])),
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
