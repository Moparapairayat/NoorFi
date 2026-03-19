<?php

namespace App\Filament\Resources\SupportTickets;

use App\Filament\Concerns\HasPanelRoleAuthorization;
use App\Filament\Resources\SupportTickets\Pages\ManageSupportTickets;
use App\Models\SupportTicket;
use App\Models\User;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\KeyValue;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Enums\FiltersLayout;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class SupportTicketResource extends Resource
{
    use HasPanelRoleAuthorization;

    protected static ?string $model = SupportTicket::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedLifebuoy;

    protected static ?string $navigationLabel = 'Support Tickets';

    protected static string|\UnitEnum|null $navigationGroup = 'Compliance';

    protected static ?int $navigationSort = 20;

    protected static array $viewAnyRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
        User::ADMIN_ROLE_SUPPORT,
        User::ADMIN_ROLE_COMPLIANCE,
    ];

    protected static array $createRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
        User::ADMIN_ROLE_SUPPORT,
        User::ADMIN_ROLE_COMPLIANCE,
    ];

    protected static array $editRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
        User::ADMIN_ROLE_SUPPORT,
        User::ADMIN_ROLE_COMPLIANCE,
    ];

    protected static array $deleteRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
    ];

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('user_id')
                    ->relationship('user', 'email')
                    ->searchable()
                    ->preload()
                    ->required(),
                Select::make('category')
                    ->options([
                        'kyc' => 'KYC',
                    ])
                    ->required(),
                Select::make('status')
                    ->options([
                        'open' => 'Open',
                        'in_progress' => 'In progress',
                        'resolved' => 'Resolved',
                        'closed' => 'Closed',
                    ])
                    ->required(),
                TextInput::make('submission_id')
                    ->maxLength(120),
                TextInput::make('subject')
                    ->required()
                    ->maxLength(160),
                Textarea::make('message')
                    ->required()
                    ->rows(4)
                    ->maxLength(2000),
                TextInput::make('contact_email')
                    ->email()
                    ->maxLength(191),
                KeyValue::make('meta')
                    ->columnSpanFull(),
                Textarea::make('admin_note')
                    ->rows(3),
                DateTimePicker::make('resolved_at'),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('id')
                    ->sortable(),
                TextColumn::make('user.email')
                    ->label('User')
                    ->searchable(),
                TextColumn::make('category')
                    ->badge(),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'resolved' => 'success',
                        'in_progress' => 'warning',
                        'closed' => 'gray',
                        default => 'danger',
                    }),
                TextColumn::make('submission_id')
                    ->searchable()
                    ->toggleable(),
                TextColumn::make('subject')
                    ->searchable()
                    ->limit(50),
                TextColumn::make('contact_email')
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->dateTime('Y-m-d H:i')
                    ->sortable(),
                TextColumn::make('resolved_at')
                    ->dateTime('Y-m-d H:i')
                    ->toggleable(),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options([
                        'open' => 'Open',
                        'in_progress' => 'In progress',
                        'resolved' => 'Resolved',
                        'closed' => 'Closed',
                    ]),
                SelectFilter::make('category')
                    ->options([
                        'kyc' => 'KYC',
                    ]),
            ])
            ->filtersLayout(FiltersLayout::AboveContentCollapsible)
            ->filtersFormColumns(3)
            ->deferFilters()
            ->recordActions([
                Action::make('in_progress')
                    ->label('Mark In Progress')
                    ->color('warning')
                    ->visible(fn (SupportTicket $record): bool => self::canEdit($record) && $record->status === 'open')
                    ->action(fn (SupportTicket $record) => $record->update(['status' => 'in_progress'])),
                Action::make('resolve')
                    ->label('Resolve')
                    ->color('success')
                    ->visible(fn (SupportTicket $record): bool => self::canEdit($record) && in_array($record->status, ['open', 'in_progress'], true))
                    ->action(fn (SupportTicket $record) => $record->update([
                        'status' => 'resolved',
                        'resolved_at' => now(),
                    ])),
                Action::make('reopen')
                    ->label('Reopen')
                    ->color('info')
                    ->visible(fn (SupportTicket $record): bool => self::canEdit($record) && in_array($record->status, ['resolved', 'closed'], true))
                    ->action(fn (SupportTicket $record) => $record->update([
                        'status' => 'open',
                        'resolved_at' => null,
                    ])),
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ])
            ->striped()
            ->emptyStateIcon('heroicon-o-lifebuoy')
            ->emptyStateHeading('No support tickets found')
            ->emptyStateDescription('User support requests will appear here.');
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageSupportTickets::route('/'),
        ];
    }

    public static function getNavigationBadge(): ?string
    {
        $count = SupportTicket::query()
            ->whereIn('status', ['open', 'in_progress'])
            ->count();

        return $count > 0 ? (string) $count : null;
    }

    public static function getNavigationBadgeTooltip(): ?string
    {
        return 'Open/in-progress support queue.';
    }

    public static function getNavigationBadgeColor(): string|array|null
    {
        return 'danger';
    }
}
