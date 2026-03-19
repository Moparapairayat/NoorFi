<?php

namespace App\Filament\Resources\KycProfiles\Pages;

use App\Filament\Pages\OperationsWorkflowCenterPage;
use App\Filament\Resources\KycProfiles\KycProfileResource;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ManageKycProfiles extends ManageRecords
{
    protected static string $resource = KycProfileResource::class;

    public function getHeading(): string
    {
        return 'KYC Verification Queue';
    }

    public function getSubheading(): ?string
    {
        return 'Review submitted profiles, approve/reject decisions, and monitor provider state.';
    }

    public function getTabs(): array
    {
        return [
            'all' => Tab::make('All')
                ->badge(\App\Models\KycProfile::query()->count()),
            'submitted' => Tab::make('Submitted')
                ->badge(\App\Models\KycProfile::query()->where('status', 'submitted')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'submitted')),
            'in_review' => Tab::make('In Review')
                ->badge(\App\Models\KycProfile::query()->where('status', 'in_review')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'in_review')),
            'approved' => Tab::make('Approved')
                ->badge(\App\Models\KycProfile::query()->where('status', 'approved')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'approved')),
            'rejected' => Tab::make('Rejected')
                ->badge(\App\Models\KycProfile::query()->where('status', 'rejected')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'rejected')),
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
