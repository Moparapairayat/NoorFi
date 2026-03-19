<?php

namespace App\Filament\Resources\KycProfiles;

use App\Filament\Concerns\HasPanelRoleAuthorization;
use App\Filament\Resources\KycProfiles\Pages\ManageKycProfiles;
use App\Models\KycProfile;
use App\Models\User;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\DateTimePicker;
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

class KycProfileResource extends Resource
{
    use HasPanelRoleAuthorization;

    protected static ?string $model = KycProfile::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedShieldCheck;

    protected static ?string $navigationLabel = 'KYC Profiles';

    protected static string|\UnitEnum|null $navigationGroup = 'Compliance';

    protected static ?int $navigationSort = 10;

    protected static array $viewAnyRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
        User::ADMIN_ROLE_COMPLIANCE,
        User::ADMIN_ROLE_SUPPORT,
    ];

    protected static array $createRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
        User::ADMIN_ROLE_COMPLIANCE,
    ];

    protected static array $editRoles = [
        User::ADMIN_ROLE_SUPER_ADMIN,
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
                Select::make('status')
                    ->options([
                        'draft' => 'Draft',
                        'submitted' => 'Submitted',
                        'in_review' => 'In review',
                        'approved' => 'Approved',
                        'rejected' => 'Rejected',
                    ])
                    ->required(),
                DateTimePicker::make('submitted_at'),
                DateTimePicker::make('approved_at'),
                DateTimePicker::make('rejected_at'),
                Textarea::make('review_note')
                    ->rows(2)
                    ->maxLength(1000),

                TextInput::make('full_name')
                    ->required()
                    ->maxLength(120),
                DatePicker::make('date_of_birth')
                    ->required(),
                TextInput::make('nationality')
                    ->required()
                    ->maxLength(60),
                TextInput::make('occupation')
                    ->required()
                    ->maxLength(100),
                TextInput::make('phone_number')
                    ->required()
                    ->maxLength(24),

                Select::make('document_type')
                    ->options([
                        'national_id' => 'National ID',
                        'passport' => 'Passport',
                        'driving_license' => 'Driving license',
                    ])
                    ->required(),
                TextInput::make('document_number')
                    ->required()
                    ->maxLength(80),
                TextInput::make('issuing_country')
                    ->required()
                    ->maxLength(80),
                DatePicker::make('document_expiry_date')
                    ->required(),
                Select::make('address_proof_type')
                    ->options([
                        'utility_bill' => 'Utility bill',
                        'bank_statement' => 'Bank statement',
                        'rental_agreement' => 'Rental agreement',
                    ])
                    ->required(),

                TextInput::make('address_line')
                    ->required()
                    ->maxLength(255),
                TextInput::make('city')
                    ->required()
                    ->maxLength(80),
                TextInput::make('postal_code')
                    ->required()
                    ->maxLength(30),
                TextInput::make('country')
                    ->required()
                    ->maxLength(80),
                TextInput::make('id_type')
                    ->maxLength(40),
                TextInput::make('id_image_url')
                    ->url()
                    ->maxLength(2048),
                TextInput::make('selfie_image_url')
                    ->url()
                    ->maxLength(2048),
                TextInput::make('address_proof_url')
                    ->url()
                    ->maxLength(2048),

                TextInput::make('didit_session_id')
                    ->maxLength(191),
                TextInput::make('didit_reference_id')
                    ->maxLength(191),
                TextInput::make('didit_session_url')
                    ->url()
                    ->maxLength(2048),
                TextInput::make('didit_vendor_status')
                    ->maxLength(191),
                TextInput::make('didit_decision')
                    ->maxLength(191),
                DateTimePicker::make('didit_last_webhook_at'),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('submitted_at', 'desc')
            ->columns([
                TextColumn::make('id')
                    ->sortable(),
                TextColumn::make('user.email')
                    ->label('User')
                    ->searchable(),
                TextColumn::make('full_name')
                    ->searchable(),
                TextColumn::make('document_type')
                    ->badge(),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'approved' => 'success',
                        'rejected' => 'danger',
                        'submitted', 'in_review' => 'warning',
                        default => 'gray',
                    }),
                TextColumn::make('didit_vendor_status')
                    ->label('Provider status')
                    ->toggleable(),
                TextColumn::make('didit_decision')
                    ->label('Decision')
                    ->toggleable(),
                TextColumn::make('submitted_at')
                    ->dateTime('Y-m-d H:i')
                    ->toggleable(),
                TextColumn::make('approved_at')
                    ->dateTime('Y-m-d H:i')
                    ->toggleable(),
                TextColumn::make('updated_at')
                    ->dateTime('Y-m-d H:i')
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options([
                        'draft' => 'Draft',
                        'submitted' => 'Submitted',
                        'in_review' => 'In review',
                        'approved' => 'Approved',
                        'rejected' => 'Rejected',
                    ]),
                SelectFilter::make('document_type')
                    ->options([
                        'national_id' => 'National ID',
                        'passport' => 'Passport',
                        'driving_license' => 'Driving license',
                    ]),
            ])
            ->filtersLayout(FiltersLayout::AboveContentCollapsible)
            ->filtersFormColumns(3)
            ->deferFilters()
            ->recordActions([
                Action::make('in_review')
                    ->label('Mark In Review')
                    ->color('warning')
                    ->requiresConfirmation()
                    ->visible(fn (KycProfile $record): bool => self::canEdit($record) && in_array($record->status, ['draft', 'submitted'], true))
                    ->action(function (KycProfile $record): void {
                        $record->forceFill([
                            'status' => 'in_review',
                            'submitted_at' => $record->submitted_at ?? now(),
                            'approved_at' => null,
                            'rejected_at' => null,
                        ])->save();

                        if ($record->user) {
                            $record->user->forceFill([
                                'kyc_status' => 'in_review',
                            ])->save();
                        }
                    }),
                Action::make('approve')
                    ->label('Approve')
                    ->color('success')
                    ->requiresConfirmation()
                    ->visible(fn (KycProfile $record): bool => $record->status !== 'approved')
                    ->action(function (KycProfile $record): void {
                        $record->forceFill([
                            'status' => 'approved',
                            'approved_at' => now(),
                            'rejected_at' => null,
                            'review_note' => null,
                        ])->save();

                        if ($record->user) {
                            $record->user->forceFill([
                                'kyc_status' => 'approved',
                                'full_name' => $record->full_name,
                                'name' => $record->full_name,
                                'phone_number' => $record->phone_number,
                            ])->save();
                        }
                    }),
                Action::make('reject')
                    ->label('Reject')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->visible(fn (KycProfile $record): bool => $record->status !== 'rejected')
                    ->action(function (KycProfile $record): void {
                        $record->forceFill([
                            'status' => 'rejected',
                            'rejected_at' => now(),
                            'approved_at' => null,
                        ])->save();

                        if ($record->user) {
                            $record->user->forceFill([
                                'kyc_status' => 'rejected',
                            ])->save();
                        }
                    }),
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ])
            ->striped()
            ->emptyStateIcon('heroicon-o-shield-check')
            ->emptyStateHeading('No KYC profiles found')
            ->emptyStateDescription('Submitted KYC applications and review states will appear here.');
    }

    public static function getPages(): array
    {
        return [
            'index' => ManageKycProfiles::route('/'),
        ];
    }

    public static function getNavigationBadge(): ?string
    {
        $count = KycProfile::query()
            ->whereIn('status', ['submitted', 'in_review'])
            ->count();

        return $count > 0 ? (string) $count : null;
    }

    public static function getNavigationBadgeTooltip(): ?string
    {
        return 'Profiles waiting for review.';
    }

    public static function getNavigationBadgeColor(): string|array|null
    {
        return 'warning';
    }
}
