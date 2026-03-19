<?php

namespace App\Filament\Resources\Transfers\Pages;

use App\Filament\Pages\OperationsWorkflowCenterPage;
use App\Filament\Resources\Transfers\TransferResource;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ManageTransfers extends ManageRecords
{
    protected static string $resource = TransferResource::class;

    public function getHeading(): string
    {
        return 'Transfer Operations';
    }

    public function getSubheading(): ?string
    {
        return 'Monitor user-to-user and external transfer flow from one queue.';
    }

    public function getTabs(): array
    {
        return [
            'all' => Tab::make('All')
                ->badge(\App\Models\Transfer::query()->count()),
            'pending' => Tab::make('Pending')
                ->badge(\App\Models\Transfer::query()->whereIn('status', ['pending', 'processing'])->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->whereIn('status', ['pending', 'processing'])),
            'completed' => Tab::make('Completed')
                ->badge(\App\Models\Transfer::query()->where('status', 'completed')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'completed')),
            'failed' => Tab::make('Failed')
                ->badge(\App\Models\Transfer::query()->whereIn('status', ['failed', 'cancelled'])->count())
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
