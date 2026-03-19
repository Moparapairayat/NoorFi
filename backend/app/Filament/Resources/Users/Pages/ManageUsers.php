<?php

namespace App\Filament\Resources\Users\Pages;

use App\Filament\Pages\OperationsWorkflowCenterPage;
use App\Filament\Resources\Users\UserResource;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ManageUsers extends ManageRecords
{
    protected static string $resource = UserResource::class;

    public function getHeading(): string
    {
        return 'User Management';
    }

    public function getSubheading(): ?string
    {
        return 'Manage customer accounts, roles, KYC state, and account access status.';
    }

    public function getTabs(): array
    {
        return [
            'all' => Tab::make('All')
                ->badge(\App\Models\User::query()->count()),
            'active' => Tab::make('Active')
                ->badge(\App\Models\User::query()->where('account_status', 'active')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('account_status', 'active')),
            'pending_kyc' => Tab::make('Pending KYC')
                ->badge(\App\Models\User::query()->whereIn('kyc_status', ['pending', 'submitted', 'in_review'])->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->whereIn('kyc_status', ['pending', 'submitted', 'in_review'])),
            'admins' => Tab::make('Admins')
                ->badge(\App\Models\User::query()->where('is_admin', true)->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('is_admin', true)),
            'restricted' => Tab::make('Restricted')
                ->badge(\App\Models\User::query()->whereIn('account_status', ['suspended', 'blocked'])->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->whereIn('account_status', ['suspended', 'blocked'])),
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
