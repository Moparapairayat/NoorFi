<?php

namespace App\Filament\Resources\Deposits\Pages;

use App\Filament\Pages\OperationsWorkflowCenterPage;
use App\Filament\Resources\Deposits\DepositResource;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ManageDeposits extends ManageRecords
{
    protected static string $resource = DepositResource::class;

    public function getHeading(): string
    {
        return 'Deposit Operations';
    }

    public function getSubheading(): ?string
    {
        return 'Monitor incoming funding requests and provider settlement states.';
    }

    public function getTabs(): array
    {
        return [
            'all' => Tab::make('All')
                ->badge(\App\Models\Deposit::query()->count()),
            'pending' => Tab::make('Pending')
                ->badge(\App\Models\Deposit::query()->where('status', 'pending')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'pending')),
            'processing' => Tab::make('Processing')
                ->badge(\App\Models\Deposit::query()->where('status', 'processing')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'processing')),
            'completed' => Tab::make('Completed')
                ->badge(\App\Models\Deposit::query()->where('status', 'completed')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'completed')),
            'failed' => Tab::make('Failed')
                ->badge(\App\Models\Deposit::query()->whereIn('status', ['failed', 'cancelled'])->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->whereIn('status', ['failed', 'cancelled'])),
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
