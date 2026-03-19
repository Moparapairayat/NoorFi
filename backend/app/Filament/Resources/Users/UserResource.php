<?php

namespace App\Filament\Resources\Users;

use App\Filament\Concerns\HasPanelRoleAuthorization;
use App\Filament\Resources\Users\Pages\ManageUsers;
use App\Models\User;
use BackedEnum;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Enums\FiltersLayout;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Validation\Rules\Password;

class UserResource extends Resource
{
    use HasPanelRoleAuthorization;

    protected static ?string $model = User::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?string $navigationLabel = 'Users';

    protected static string|\UnitEnum|null $navigationGroup = 'Core';

    protected static ?int $navigationSort = 10;

    protected static array $viewAnyRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
        User::ADMIN_ROLE_OPERATIONS,
        User::ADMIN_ROLE_SUPPORT,
        User::ADMIN_ROLE_COMPLIANCE,
    ];

    protected static array $createRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
    ];

    protected static array $editRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
    ];

    protected static array $deleteRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
    ];

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('full_name')
                    ->label('Full name')
                    ->maxLength(120),
                TextInput::make('name')
                    ->label('Display name')
                    ->required()
                    ->maxLength(120),
                TextInput::make('email')
                    ->email()
                    ->required()
                    ->maxLength(191)
                    ->unique(ignoreRecord: true),
                TextInput::make('phone_number')
                    ->tel()
                    ->maxLength(24)
                    ->unique(ignoreRecord: true),
                TextInput::make('password')
                    ->password()
                    ->revealable()
                    ->rule(Password::min(8))
                    ->dehydrated(fn (?string $state): bool => filled($state))
                    ->required(fn (string $operation): bool => $operation === 'create')
                    ->helperText('Leave empty to keep existing password.'),
                TextInput::make('transaction_pin')
                    ->password()
                    ->revealable()
                    ->maxLength(6)
                    ->dehydrated(fn (?string $state): bool => filled($state))
                    ->helperText('Leave empty to keep existing PIN.'),
                Select::make('kyc_status')
                    ->options([
                        'pending' => 'Pending',
                        'submitted' => 'Submitted',
                        'in_review' => 'In review',
                        'approved' => 'Approved',
                        'rejected' => 'Rejected',
                    ])
                    ->required(),
                Select::make('account_status')
                    ->options([
                        'active' => 'Active',
                        'pending' => 'Pending',
                        'suspended' => 'Suspended',
                        'blocked' => 'Blocked',
                    ])
                    ->required(),
                Toggle::make('is_admin')
                    ->label('Admin access')
                    ->inline(false),
                Select::make('admin_role')
                    ->label('Admin role')
                    ->options(User::adminRoleOptions())
                    ->required(fn (Get $get): bool => (bool) $get('is_admin'))
                    ->visible(fn (Get $get): bool => (bool) $get('is_admin'))
                    ->helperText('Used only when admin access is enabled.'),
                TextInput::make('strowallet_customer_id')
                    ->maxLength(120),
                DateTimePicker::make('last_login_at'),
                DateTimePicker::make('email_verified_at'),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('id')
                    ->sortable(),
                TextColumn::make('full_name')
                    ->label('Full name')
                    ->searchable()
                    ->toggleable(),
                TextColumn::make('name')
                    ->label('Name')
                    ->searchable()
                    ->toggleable(),
                TextColumn::make('email')
                    ->searchable()
                    ->copyable(),
                TextColumn::make('phone_number')
                    ->searchable()
                    ->toggleable(),
                IconColumn::make('is_admin')
                    ->label('Admin')
                    ->boolean(),
                TextColumn::make('admin_role')
                    ->label('Role')
                    ->badge()
                    ->formatStateUsing(fn (?string $state): string => $state ? ucwords(str_replace('_', ' ', $state)) : '-')
                    ->toggleable(),
                TextColumn::make('kyc_status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'approved' => 'success',
                        'rejected' => 'danger',
                        'in_review', 'submitted' => 'warning',
                        default => 'gray',
                    }),
                TextColumn::make('account_status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'active' => 'success',
                        'suspended', 'blocked' => 'danger',
                        default => 'warning',
                    }),
                TextColumn::make('last_login_at')
                    ->dateTime('Y-m-d H:i')
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->dateTime('Y-m-d H:i')
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                TernaryFilter::make('is_admin')
                    ->label('Admin only'),
                SelectFilter::make('admin_role')
                    ->label('Admin role')
                    ->options(User::adminRoleOptions()),
                SelectFilter::make('kyc_status')
                    ->options([
                        'pending' => 'Pending',
                        'submitted' => 'Submitted',
                        'in_review' => 'In review',
                        'approved' => 'Approved',
                        'rejected' => 'Rejected',
                    ]),
                SelectFilter::make('account_status')
                    ->options([
                        'active' => 'Active',
                        'pending' => 'Pending',
                        'suspended' => 'Suspended',
                        'blocked' => 'Blocked',
                    ]),
            ])
            ->filtersLayout(FiltersLayout::AboveContentCollapsible)
            ->filtersFormColumns(4)
            ->deferFilters()
            ->recordActions([
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ])
            ->striped()
            ->emptyStateIcon('heroicon-o-user-group')
            ->emptyStateHeading('No users found')
            ->emptyStateDescription('Customer accounts will appear here after signup.');
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageUsers::route('/'),
        ];
    }

    public static function getNavigationBadge(): ?string
    {
        $count = User::query()
            ->whereIn('kyc_status', ['pending', 'submitted', 'in_review'])
            ->count();

        return $count > 0 ? (string) $count : null;
    }

    public static function getNavigationBadgeTooltip(): ?string
    {
        return 'Users with pending KYC state.';
    }

    public static function getNavigationBadgeColor(): string|array|null
    {
        return 'warning';
    }
}
