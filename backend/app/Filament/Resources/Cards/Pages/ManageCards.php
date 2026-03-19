<?php

namespace App\Filament\Resources\Cards\Pages;

use App\Filament\Pages\OperationsWorkflowCenterPage;
use App\Filament\Resources\Cards\CardResource;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ManageCards extends ManageRecords
{
    protected static string $resource = CardResource::class;

    public function getHeading(): string
    {
        return 'Card Operations';
    }

    public function getSubheading(): ?string
    {
        return 'Manage virtual/physical card lifecycle, status, and brand inventory.';
    }

    public function getTabs(): array
    {
        return [
            'all' => Tab::make('All')
                ->badge(\App\Models\Card::query()->count()),
            'virtual' => Tab::make('Virtual')
                ->badge(\App\Models\Card::query()->where('type', 'virtual')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('type', 'virtual')),
            'physical' => Tab::make('Physical')
                ->badge(\App\Models\Card::query()->where('type', 'physical')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('type', 'physical')),
            'active' => Tab::make('Active')
                ->badge(\App\Models\Card::query()->where('status', 'active')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'active')),
            'pending' => Tab::make('Pending')
                ->badge(\App\Models\Card::query()->where('status', 'pending')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'pending')),
            'frozen' => Tab::make('Frozen')
                ->badge(\App\Models\Card::query()->where('status', 'frozen')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'frozen')),
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
