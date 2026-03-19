<?php

namespace App\Filament\Resources\Withdrawals\Pages;

use App\Filament\Pages\OperationsWorkflowCenterPage;
use App\Filament\Resources\Withdrawals\WithdrawalResource;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ManageWithdrawals extends ManageRecords
{
    protected static string $resource = WithdrawalResource::class;

    public function getHeading(): string
    {
        return 'Withdrawal Operations';
    }

    public function getSubheading(): ?string
    {
        return 'Track payout requests and provider confirmation states.';
    }

    public function getTabs(): array
    {
        return [
            'all' => Tab::make('All')
                ->badge(\App\Models\Withdrawal::query()->count()),
            'pending' => Tab::make('Pending')
                ->badge(\App\Models\Withdrawal::query()->where('status', 'pending')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'pending')),
            'processing' => Tab::make('Processing')
                ->badge(\App\Models\Withdrawal::query()->where('status', 'processing')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'processing')),
            'completed' => Tab::make('Completed')
                ->badge(\App\Models\Withdrawal::query()->where('status', 'completed')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'completed')),
            'failed' => Tab::make('Failed')
                ->badge(\App\Models\Withdrawal::query()->whereIn('status', ['failed', 'cancelled'])->count())
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
