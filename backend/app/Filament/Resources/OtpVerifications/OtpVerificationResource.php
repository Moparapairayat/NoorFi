<?php

namespace App\Filament\Resources\OtpVerifications;

use App\Filament\Concerns\HasPanelRoleAuthorization;
use App\Filament\Resources\OtpVerifications\Pages\ManageOtpVerifications;
use App\Models\OtpVerification;
use App\Models\User;
use BackedEnum;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Enums\FiltersLayout;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class OtpVerificationResource extends Resource
{
    use HasPanelRoleAuthorization;

    protected static ?string $model = OtpVerification::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedKey;

    protected static ?string $navigationLabel = 'OTP Logs';

    protected static string|\UnitEnum|null $navigationGroup = 'Security';

    protected static ?int $navigationSort = 10;

    protected static array $viewAnyRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
        User::ADMIN_ROLE_SUPPORT,
        User::ADMIN_ROLE_COMPLIANCE,
    ];

    protected static array $createRoles = [];

    protected static array $editRoles = [];

    protected static array $deleteRoles = [];

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('email')
                    ->disabled(),
                TextInput::make('flow')
                    ->disabled(),
                TextInput::make('code')
                    ->disabled(),
                DateTimePicker::make('expires_at')
                    ->disabled(),
                DateTimePicker::make('consumed_at')
                    ->disabled(),
                TextInput::make('attempts')
                    ->numeric()
                    ->disabled(),
                TextInput::make('ip_address')
                    ->disabled(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('id')
                    ->sortable(),
                TextColumn::make('email')
                    ->searchable(),
                TextColumn::make('flow')
                    ->badge(),
                TextColumn::make('code')
                    ->label('OTP')
                    ->formatStateUsing(function (?string $state): string {
                        $value = (string) $state;
                        if ($value === '') {
                            return '-';
                        }

                        $visible = substr($value, -2);
                        return str_repeat('*', max(strlen($value) - 2, 0)) . $visible;
                    }),
                TextColumn::make('otp_state')
                    ->label('State')
                    ->state(function (OtpVerification $record): string {
                        if ($record->consumed_at !== null) {
                            return 'consumed';
                        }

                        if ($record->expires_at->isPast()) {
                            return 'expired';
                        }

                        return 'active';
                    })
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'active' => 'success',
                        'consumed' => 'gray',
                        default => 'danger',
                    }),
                TextColumn::make('attempts')
                    ->sortable(),
                TextColumn::make('ip_address')
                    ->toggleable(),
                TextColumn::make('expires_at')
                    ->dateTime('Y-m-d H:i')
                    ->sortable(),
                TextColumn::make('consumed_at')
                    ->dateTime('Y-m-d H:i')
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->dateTime('Y-m-d H:i')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('flow')
                    ->options([
                        'register' => 'Register',
                        'login' => 'Login',
                        'reset_password' => 'Reset password',
                    ]),
                SelectFilter::make('state')
                    ->label('State')
                    ->options([
                        'active' => 'Active',
                        'consumed' => 'Consumed',
                        'expired' => 'Expired',
                    ])
                    ->query(function (Builder $query, array $data): Builder {
                        $value = trim((string) ($data['value'] ?? ''));
                        if ($value === '') {
                            return $query;
                        }

                        if ($value === 'active') {
                            return $query
                                ->whereNull('consumed_at')
                                ->where('expires_at', '>', now());
                        }

                        if ($value === 'consumed') {
                            return $query->whereNotNull('consumed_at');
                        }

                        return $query
                            ->whereNull('consumed_at')
                            ->where('expires_at', '<=', now());
                    }),
            ])
            ->filtersLayout(FiltersLayout::AboveContentCollapsible)
            ->filtersFormColumns(2)
            ->deferFilters()
            ->recordActions([])
            ->toolbarActions([])
            ->striped()
            ->emptyStateIcon('heroicon-o-key')
            ->emptyStateHeading('No OTP logs found')
            ->emptyStateDescription('OTP generation and verification audit logs will appear here.');
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageOtpVerifications::route('/'),
        ];
    }
}
