<?php

namespace App\Filament\Resources\OtpVerifications\Pages;

use App\Filament\Pages\OperationsWorkflowCenterPage;
use App\Filament\Resources\OtpVerifications\OtpVerificationResource;
use Filament\Actions\Action;
use Filament\Resources\Pages\ManageRecords;

class ManageOtpVerifications extends ManageRecords
{
    protected static string $resource = OtpVerificationResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('workflow_center')
                ->label('Workflow Center')
                ->icon('heroicon-o-view-columns')
                ->visible(fn (): bool => OperationsWorkflowCenterPage::canAccess())
                ->url(OperationsWorkflowCenterPage::getUrl()),
        ];
    }
}
