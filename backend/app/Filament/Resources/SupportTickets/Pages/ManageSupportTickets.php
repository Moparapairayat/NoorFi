<?php

namespace App\Filament\Resources\SupportTickets\Pages;

use App\Filament\Pages\OperationsWorkflowCenterPage;
use App\Filament\Resources\SupportTickets\SupportTicketResource;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ManageSupportTickets extends ManageRecords
{
    protected static string $resource = SupportTicketResource::class;

    public function getHeading(): string
    {
        return 'Support Ticket Desk';
    }

    public function getSubheading(): ?string
    {
        return 'Track open requests, assign progress state, and close resolved cases quickly.';
    }

    public function getTabs(): array
    {
        return [
            'all' => Tab::make('All')
                ->badge(\App\Models\SupportTicket::query()->count()),
            'open' => Tab::make('Open')
                ->badge(\App\Models\SupportTicket::query()->where('status', 'open')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'open')),
            'in_progress' => Tab::make('In Progress')
                ->badge(\App\Models\SupportTicket::query()->where('status', 'in_progress')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'in_progress')),
            'resolved' => Tab::make('Resolved')
                ->badge(\App\Models\SupportTicket::query()->where('status', 'resolved')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'resolved')),
            'closed' => Tab::make('Closed')
                ->badge(\App\Models\SupportTicket::query()->where('status', 'closed')->count())
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', 'closed')),
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
