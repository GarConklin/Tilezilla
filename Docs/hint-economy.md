# Hint Economy Design

## User hint balance

Current balance is stored on the user record for fast reads:

```sql
hint_tokens INT NOT NULL DEFAULT 5 CHECK (hint_tokens >= 0)
```

## Hint transaction history

Every hint gain or spend creates a row in `hint_transactions`. The table is the **source of truth**; `users.hint_tokens` is a **cached balance** for performance.

```sql
CREATE TABLE hint_transactions (
    transaction_id BIGINT AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT NOT NULL,

    amount INT NOT NULL,

    reason VARCHAR(100) NOT NULL,

    reference_id VARCHAR(50) NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
);
```

`reference_id` optionally links a transaction to a level, daily date, purchase id, etc. (app-defined).

## Example transactions

| amount | reason |
|--------|--------|
| +1 | Puzzle Completion |
| +1 | Time Bonus |
| -1 | Random Solution Hint |
| -2 | Start Tile Hint |
| -2 | End Tile Hint |
| +1 | Daily Challenge Reward |
| +1 | Watch Advertisement |
| +25 | Hint Pack Small |
| +100 | Hint Pack Large |

## Hint balance rule

After any change, balance should match:

```text
SUM(hint_transactions.amount)   -- per user_id
```

…or the app updates `users.hint_tokens` in the same transaction as inserting `hint_transactions`, and reconciles periodically.

**Never allow negative hint balances.** Before applying a spend (`amount` &lt; 0), check `hint_tokens >= abs(amount)` (or equivalent sum). Reject the operation if it would go below zero.

## Store purchases (not V1)

When real-money purchases are added, use a separate `purchases` table (not created in schema V1):

```sql
CREATE TABLE purchases (
    purchase_id BIGINT AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT NOT NULL,

    product_code VARCHAR(50) NOT NULL,

    hints_awarded INT NOT NULL,

    amount_paid DECIMAL(10,2) NOT NULL,

    currency VARCHAR(10) NOT NULL,

    purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
);
```

Until then, store-style grants are recorded only as `hint_transactions` (e.g. reason `Hint Pack Small`, `reference_id` optional).
