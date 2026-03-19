<?php

namespace App\Filament\Resources\Exchanges\Pages;

use App\Filament\Pages\OperationsWorkflowCenterPage;
use App\Filament\Resources\Exchanges\ExchangeResource;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ManageExchanges extends ManageRecords
{
    protected static string $resource = ExchangeResource::class;

    public function getHeading(): string
    {
        return 'Exchange Operations';
    }

    public function getSubheading(): ?string
    {
        return 'Track quote execution, conversion settlement, and failure queue.';
    }

    public function getTabs(): array
    {
        return [
            'all' => Tab::make('All')
                ->badge(\App\Models\Exchange::query()->count()),
            'pending' => Tab::make('Pending')
                ->badge(\App\Models\Exchange::query()->whereIn('status', ['pending', 'processing'])->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->whereIn('status', ['pending', 'processing'])),
            'completed' => Tab::make('Completed')
                ->badge(\App\Models\Exchange::query()->where('status', 'completed')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'completed')),
            'failed' => Tab::make('Failed')
                ->badge(\App\Models\Exchange::query()->whereIn('status', ['failed', 'cancelled'])->count())
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
