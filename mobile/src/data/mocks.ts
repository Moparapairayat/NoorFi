export type QuickActionItem = {
  id: string;
  label: string;
  icon: string;
};

export type TransactionItem = {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  type: 'credit' | 'debit';
};

export const quickActions: QuickActionItem[] = [
  { id: 'topup', label: 'Top Up', icon: 'add-circle-outline' },
  { id: 'transfer', label: 'Transfer', icon: 'swap-horizontal-outline' },
  { id: 'freeze', label: 'Freeze', icon: 'snow-outline' },
  { id: 'limits', label: 'Limits', icon: 'options-outline' },
];

export const recentTransactions: TransactionItem[] = [
  {
    id: 'tx-1',
    title: 'Netflix Premium',
    subtitle: 'Today, 8:04 PM',
    amount: '-$15.99',
    type: 'debit',
  },
  {
    id: 'tx-2',
    title: 'Wallet Top Up',
    subtitle: 'Today, 6:22 PM',
    amount: '+$300.00',
    type: 'credit',
  },
  {
    id: 'tx-3',
    title: 'Amazon Purchase',
    subtitle: 'Yesterday, 9:10 AM',
    amount: '-$58.31',
    type: 'debit',
  },
  {
    id: 'tx-4',
    title: 'Spotify',
    subtitle: 'Yesterday, 12:45 AM',
    amount: '-$9.99',
    type: 'debit',
  },
];

export const notifications = [
  {
    id: 'n-1',
    title: 'Virtual card funded',
    body: 'Your card was funded with $125.00.',
    time: '2m ago',
  },
  {
    id: 'n-2',
    title: 'KYC review in progress',
    body: 'Your address proof is currently being verified.',
    time: '1h ago',
  },
  {
    id: 'n-3',
    title: 'Card security tip',
    body: 'Turn on merchant lock to restrict unknown merchants.',
    time: '3h ago',
  },
];

