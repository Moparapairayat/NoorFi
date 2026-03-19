# NoorFi Backend API

Base URL:

- `http://127.0.0.1:8000/api`

Auth:

- `Authorization: Bearer <token>` for all protected endpoints.

## 1) Auth

- `POST /auth/otp/request`
  - body: `{ "email": "demo@noorfi.com", "flow": "login|signup|recovery" }`
- `POST /auth/otp/verify`
  - body: `{ "email": "...", "flow": "...", "code": "123456", "full_name": "Optional for signup" }`
- `POST /auth/set-pin` (auth)
  - body: `{ "pin": "1234" }`
- `GET /auth/me` (auth)
- `POST /auth/logout` (auth)

## 2) Wallets

- `GET /wallets` (auth)
- `GET /wallets/{wallet}` (auth)

## 3) Cards

- `GET /cards` (auth)
- `GET /cards/{card}` (auth)
- `POST /cards/apply` (auth)
  - body example:
    ```json
    {
      "card_type": "virtual",
      "card_name": "USDC",
      "holder_name": "MOPARA PAIR AYAT",
      "theme": "islamic-emerald",
      "funding_wallet_id": 1,
      "issue_fee": 10
    }
    ```

## 4) Deposits

- `GET /deposits/options` (auth)
- `GET /deposits` (auth)
- `GET /deposits/{deposit}` (auth)
- `POST /deposits` (auth)
  - supported methods: `binance_pay`, `crypto_wallet`
  - body example:
    ```json
    {
      "wallet_id": 2,
      "method": "crypto_wallet",
      "amount": 150,
      "network": "TRC20",
      "note": "Top up",
      "auto_credit": false
    }
    ```

## 5) Transfers (Send)

- `GET /transfers` (auth)
- `GET /transfers/{transfer}` (auth)
- `POST /transfers` (auth)
  - body:
    ```json
    {
      "wallet_id": 1,
      "recipient_email": "friend@noorfi.com",
      "amount": 25,
      "note": "Support",
      "pin": "1234"
    }
    ```

## 6) Withdrawals

- `GET /withdrawals/options` (auth)
- `GET /withdrawals` (auth)
- `GET /withdrawals/{withdrawal}` (auth)
- `POST /withdrawals` (auth)
  - only method: `crypto_wallet`
  - body:
    ```json
    {
      "wallet_id": 2,
      "method": "crypto_wallet",
      "network": "TRC20",
      "destination_address": "TK5vP6sawCJJz7HiN46vP5VYFXe1QHkBLS",
      "recipient_name": "MOPARA PAIR AYAT",
      "amount": 80,
      "note": "Cash out",
      "pin": "1234"
    }
    ```

## 7) Exchanges

- `GET /exchanges/rates` (auth)
- `POST /exchanges/quote` (auth)
- `GET /exchanges` (auth)
- `GET /exchanges/{exchange}` (auth)
- `POST /exchanges` (auth)
  - body:
    ```json
    {
      "from_wallet_id": 3,
      "to_currency": "usdt",
      "amount_from": 0.5,
      "quote_id": "QTE-ABCDE12345",
      "note": "Rebalance",
      "pin": "1234"
    }
    ```

## 8) Transactions

- `GET /transactions` (auth)
  - filters: `wallet_id`, `type`, `direction`, `status`, `search`, `per_page`
- `GET /transactions/{transaction}` (auth)

## Demo Credentials (Seeder)

- Admin panel: `admin@noorfi.com` / `Admin@12345`
- Demo app user: `demo@noorfi.com` / OTP flow + PIN `1234`

## Run Locally

1. Create DB `noorfi` in MySQL.
2. Set `.env` DB values.
3. Run:
   - `php artisan migrate --seed`
   - `php artisan serve`
4. Admin panel:
   - `http://127.0.0.1:8000/admin`

