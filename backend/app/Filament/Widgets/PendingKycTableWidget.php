<?php

namespace App\Filament\Widgets;

use App\Filament\Resources\KycProfiles\KycProfileResource;
use App\Models\KycProfile;
use App\Models\User;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;

class PendingKycTableWidget extends TableWidget
{
    protected static ?int $sort = 4;

    protected int|string|array $columnSpan = 1;

    public static function canView(): bool
    {
        $user = auth()->user();

        return $user instanceof User && $user->hasAnyPanelRole([
            User::ADMIN_ROLE_SUPER_ADMIN,
            User::ADMIN_ROLE_COMPLIANCE,
            User::ADMIN_ROLE_SUPPORT,
        ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->heading('Pending KYC Reviews')
            ->description('Profiles waiting for verification decision.')
            ->query(
                KycProfile::query()
                    ->with('user:id,email')
                    ->whereIn('status', ['submitted', 'in_review'])
            )
            ->defaultSort('submitted_at', 'desc')
            ->columns([
                TextColumn::make('user.email')
                    ->label('User')
                    ->searchable(),
                TextColumn::make('full_name')
                    ->label('Name')
                    ->searchable()
                    ->limit(26),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => $state === 'in_review' ? 'warning' : 'gray'),
                TextColumn::make('submitted_at')
                    ->label('Submitted')
                    ->dateTime('Y-m-d H:i')
                    ->since(),
            ])
            ->recordUrl(fn (KycProfile $record): string => KycProfileResource::getUrl())
            ->poll('20s')
            ->striped()
            ->paginated([5, 10]);
    }
}
