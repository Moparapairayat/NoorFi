<?php

namespace App\Filament\Widgets;

use App\Filament\Resources\ProviderWebhookLogs\ProviderWebhookLogResource;
use App\Models\ProviderWebhookLog;
use App\Models\User;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;

class FailedProviderWebhookTableWidget extends TableWidget
{
    protected static ?int $sort = 6;

    protected int|string|array $columnSpan = 1;

    public static function canView(): bool
    {
        $user = auth()->user();

        return $user instanceof User && $user->hasAnyPanelRole([
            User::ADMIN_ROLE_SUPER_ADMIN,
            User::ADMIN_ROLE_OPERATIONS,
            User::ADMIN_ROLE_COMPLIANCE,
        ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->heading('Failed Provider Webhooks')
            ->description('Recent webhook failures that may block automation.')
            ->query(
                ProviderWebhookLog::query()
                    ->where('process_status', 'failed')
            )
            ->defaultSort('received_at', 'desc')
            ->columns([
                TextColumn::make('provider')
                    ->badge()
                    ->searchable(),
                TextColumn::make('topic')
                    ->badge()
                    ->toggleable(),
                TextColumn::make('process_message')
                    ->label('Error')
                    ->limit(36),
                TextColumn::make('attempt_count')
                    ->label('Attempts')
                    ->badge()
                    ->color(fn (int $state): string => $state >= 3 ? 'danger' : 'warning'),
                TextColumn::make('received_at')
                    ->label('Received')
                    ->dateTime('Y-m-d H:i')
                    ->since(),
            ])
            ->recordUrl(fn (ProviderWebhookLog $record): string => ProviderWebhookLogResource::getUrl())
            ->poll('30s')
            ->striped()
            ->paginated([5, 10]);
    }
}
