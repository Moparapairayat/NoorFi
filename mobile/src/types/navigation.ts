export type CardThemeId =
  | 'nebula'
  | 'midnight'
  | 'ocean'
  | 'sunset'
  | 'islamic'
  | 'emerald';

export type CardChipId = 'gold' | 'platinum';
export type AuthFlow = 'login' | 'signup' | 'recovery';
export type TopUpMethodId = 'binance_pay' | 'crypto_wallet' | 'heleket';
export type WalletId = 'usd' | 'usdt' | 'sol';
export type TransferMethodId = 'noorfi_user' | 'crypto_wallet' | 'binance_id';
export type WithdrawMethodId = 'crypto_wallet' | 'heleket';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ForgotPin: undefined;
  Otp: {
    email: string;
    flow: AuthFlow;
    fullName?: string;
    phoneNumber?: string;
    password?: string;
    passwordConfirmation?: string;
  };
  SetPin: {
    email: string;
    flow: AuthFlow;
    fullName?: string;
  };
  MainTabs: undefined;
  Activity: undefined;
  Assets: undefined;
  CardDetails: { cardId: string };
  TopUp: { presetAmount?: number } | undefined;
  TopUpReview: {
    walletId: WalletId;
    method: TopUpMethodId;
    amount: number;
    note?: string;
    feeUsd: number;
    etaLabel: string;
  };
  TopUpInstructions: {
    walletId: WalletId;
    method: TopUpMethodId;
    amount: number;
    note?: string;
    feeUsd: number;
    etaLabel: string;
    referenceId: string;
    depositId: number;
    instructions?: Record<string, unknown>;
  };
  TopUpSuccess: {
    walletId: WalletId;
    method: TopUpMethodId;
    amount: number;
    feeUsd: number;
    referenceId: string;
    depositId?: number;
  };
  Exchange: { presetAmount?: number } | undefined;
  ExchangeReview: {
    fromWallet: WalletId;
    toWallet: WalletId;
    amountFrom: number;
    amountTo: number;
    usdValue: number;
    feeUsd: number;
    rate: number;
    slippagePct: number;
    note?: string;
    quoteId: string;
  };
  ExchangeSecurity: {
    fromWallet: WalletId;
    toWallet: WalletId;
    amountFrom: number;
    amountTo: number;
    usdValue: number;
    feeUsd: number;
    rate: number;
    slippagePct: number;
    note?: string;
    quoteId: string;
  };
  ExchangeSuccess: {
    fromWallet: WalletId;
    toWallet: WalletId;
    amountFrom: number;
    amountTo: number;
    usdValue: number;
    feeUsd: number;
    rate: number;
    slippagePct: number;
    note?: string;
    quoteId: string;
    exchangeRef: string;
    completedAt: string;
  };
  Withdraw: { presetAmount?: number } | undefined;
  WithdrawReview: {
    walletId: WalletId;
    method: WithdrawMethodId;
    network: string;
    destinationLabel: string;
    destinationValue: string;
    recipientName: string;
    amount: number;
    note?: string;
    feeUsd: number;
    etaLabel: string;
  };
  WithdrawSecurity: {
    walletId: WalletId;
    method: WithdrawMethodId;
    network: string;
    destinationLabel: string;
    destinationValue: string;
    recipientName: string;
    amount: number;
    note?: string;
    feeUsd: number;
    etaLabel: string;
  };
  WithdrawSuccess: {
    walletId: WalletId;
    method: WithdrawMethodId;
    network: string;
    destinationLabel: string;
    destinationValue: string;
    recipientName: string;
    amount: number;
    note?: string;
    feeUsd: number;
    withdrawalRef: string;
    completedAt: string;
  };
  Transfer: { presetAmount?: number } | undefined;
  TransferReview: {
    walletId: WalletId;
    method: TransferMethodId;
    recipientLabel: string;
    destination: string;
    amount: number;
    note?: string;
    feeUsd: number;
    etaLabel: string;
  };
  TransferSecurity: {
    walletId: WalletId;
    method: TransferMethodId;
    recipientLabel: string;
    destination: string;
    amount: number;
    note?: string;
    feeUsd: number;
    etaLabel: string;
  };
  TransferSuccess: {
    walletId: WalletId;
    method: TransferMethodId;
    recipientLabel: string;
    destination: string;
    amount: number;
    note?: string;
    feeUsd: number;
    transferRef: string;
    completedAt: string;
  };
  Sadaqah: { presetAmount?: number } | undefined;
  ProfileDetails: undefined;
  ProfileEdit: undefined;
  SecurityPin: undefined;
  FeesLimits: undefined;
  Kyc: undefined;
  KycSubmitted: {
    submissionId: string;
    submittedAt: string;
    reviewEta: string;
    tierAfterApproval: string;
    diditSessionId?: string | null;
    diditVerificationUrl?: string | null;
    diditProviderStatus?: string | null;
    diditDecision?: string | null;
  };
  Notifications: undefined;
  VirtualCardApplySetup: {
    cardType: 'virtual' | 'physical';
    cardName: string;
    holderName: string;
    theme: CardThemeId;
    chipStyle: CardChipId;
  };
  VirtualCardApplySecurity: {
    cardType: 'virtual' | 'physical';
    cardName: string;
    holderName: string;
    theme: CardThemeId;
    chipStyle: CardChipId;
    fundingSource: 'usd_wallet';
    issueFee: number;
    prefundAmount: number;
  };
  VirtualCardApplyReview: {
    cardType: 'virtual' | 'physical';
    cardName: string;
    holderName: string;
    theme: CardThemeId;
    chipStyle: CardChipId;
    fundingSource: 'usd_wallet';
    issueFee: number;
    prefundAmount: number;
    dailyLimit: number;
    monthlyLimit: number;
    allowOnline: boolean;
    allowInternational: boolean;
    allowAtm: boolean;
  };
  VirtualCardApplySuccess: {
    cardId: string;
    cardName: string;
    holderName: string;
    theme: CardThemeId;
    chipStyle: CardChipId;
    last4: string;
  };
};

export type MainTabParamList = {
  Home: undefined;
  Cards: undefined;
  Activity: undefined;
  Profile: undefined;
};
