<?php

namespace App\Filament\Resources\ProviderWebhookLogs\Pages;

use App\Filament\Pages\OperationsWorkflowCenterPage;
use App\Filament\Resources\ProviderWebhookLogs\ProviderWebhookLogResource;
use Filament\Actions\Action;
use Filament\Resources\Pages\ManageRecords;

class ManageProviderWebhookLogs extends ManageRecords
{
    protected static string $resource = ProviderWebhookLogResource::class;

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
