<?php

namespace App\Filament\Widgets;

use App\Filament\Resources\SupportTickets\SupportTicketResource;
use App\Models\SupportTicket;
use App\Models\User;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;

class OpenSupportTicketsTableWidget extends TableWidget
{
    protected static ?int $sort = 5;

    protected int|string|array $columnSpan = 1;

    public static function canView(): bool
    {
        $user = auth()->user();

        return $user instanceof User && $user->hasAnyPanelRole([
            User::ADMIN_ROLE_SUPER_ADMIN,
            User::ADMIN_ROLE_SUPPORT,
            User::ADMIN_ROLE_COMPLIANCE,
        ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->heading('Open Support Tickets')
            ->description('Tickets requiring support/compliance response.')
            ->query(
                SupportTicket::query()
                    ->with('user:id,email')
                    ->whereIn('status', ['open', 'in_progress'])
            )
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('user.email')
                    ->label('User')
                    ->searchable(),
                TextColumn::make('subject')
                    ->searchable()
                    ->limit(28),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => $state === 'in_progress' ? 'warning' : 'danger'),
                TextColumn::make('created_at')
                    ->label('Created')
                    ->dateTime('Y-m-d H:i')
                    ->since(),
            ])
            ->recordUrl(fn (SupportTicket $record): string => SupportTicketResource::getUrl())
            ->poll('20s')
            ->striped()
            ->paginated([5, 10]);
    }
}
