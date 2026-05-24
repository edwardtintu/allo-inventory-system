# Allo Inventory System

A production-grade, multi-warehouse inventory reservation system built with Next.js 16, Prisma 7, and Neon Serverless PostgreSQL. This system focuses heavily on robust concurrency handling, database-level invariants, and reliable reservation lifecycles.

## 1. Problem Statement

In any e-commerce or ticketing platform, the most critical vulnerability is the "double spend" or overselling problem. When multiple users attempt to reserve the last remaining stock simultaneously, naive implementations fail. This system is designed to handle high-concurrency reservation scenarios safely without relying on external locking mechanisms (like Redis) by leveraging database-native transactional guarantees.

## 2. System Architecture

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL (Neon Serverless)
- **ORM**: Prisma 7 (using `@prisma/adapter-pg` WebAssembly driver to support edge/serverless constraints natively)
- **Styling**: Tailwind CSS + Sonner for robust user feedback

The schema explicitly isolates `Product` from `Warehouse`, bridging them via an `Inventory` junction table. This ensures accurate localization of stock constraints.

## 3. Inventory Invariants

To guarantee data consistency, the system enforces a strict mathematical invariant at all times:
`availableStock = totalStock - reservedStock`

**Crucial Decision:** We *never* store `availableStock` in the database. It is strictly a derived value computed dynamically. Storing derived state is an anti-pattern that leads to desynchronization bugs under heavy load.

## 4. Concurrency Handling

### Why Naive Implementations Fail
A standard `findUnique -> check availability -> update` flow fails because both transactions read the initial availability *before* either writes. If stock=1, two users can read availability=1 and both successfully decrement stock, resulting in overselling.

### The Solution: Row-Level Locking
This system solves concurrency using Prisma's `$transaction` wrapper paired with raw SQL `SELECT ... FOR UPDATE`.
1. Request arrives to reserve stock.
2. A database transaction begins.
3. The inventory row is selected `FOR UPDATE`, blocking any other transaction from reading or modifying this row until the current transaction commits or rolls back.
4. If stock is sufficient, the system increments `reservedStock` and inserts a `PENDING` reservation.
5. If stock is insufficient, the transaction rolls back cleanly with a `409 Conflict`.

## 5. Reservation Lifecycle

Reservations operate as a finite state machine:
- `PENDING`: A temporary hold on inventory. `totalStock` is unchanged. `reservedStock` increases.
- `CONFIRMED`: Payment successful. `totalStock` decreases. `reservedStock` decreases. The `availableStock` mathematical invariant remains perfectly constant during confirmation.
- `RELEASED`: Cancellation or timeout. `reservedStock` decreases. `totalStock` is untouched. The stock returns to the available pool.

State transitions are strictly validated inside row-locked transactions to prevent anomalies like double-releasing or confirming a released reservation.

## 6. Expiry Automation

Reservations are granted a 10-minute expiry window (`expiresAt`).
To prevent abandoned carts from permanently locking up inventory, the system utilizes an automated cleanup mechanism. 

A Vercel Cron job triggers the `/api/cron/release-expired` endpoint every minute. This endpoint securely iterates through expired `PENDING` rows and transitions them to `RELEASED`, decrementing `reservedStock` safely under the exact same transactional row-locks as manual releases.

## 7. API Design

The API endpoints enforce proper HTTP semantics:
- `201 Created`: Successful reservation.
- `409 Conflict`: Insufficient stock or invalid state transition attempt (e.g., trying to release an already confirmed reservation).
- `410 Gone`: Attempting to confirm a reservation that has already expired.

## 8. Deployment Architecture

The application is deployed on Vercel. Specific configurations were applied to ensure stability in a serverless environment:
- `vercel.json` configures the automated cron job.
- `postinstall` script enforces `prisma generate` during the Vercel build step, ensuring the Prisma Client and WebAssembly bindings correctly compile against the deployment environment.
- Prisma client is instantiated as a global singleton (`src/lib/prisma.ts`) to prevent connection pool exhaustion during Next.js Hot Module Replacement (HMR).

## 9. Local Setup Instructions

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require"
   ```

3. Run migrations and seed the database with realistic multi-warehouse data:
   ```bash
   npx prisma migrate dev
   npm run seed
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## 10. Tradeoffs and Future Improvements

- **Database Locks vs Redis**: We utilized Postgres row-level locks instead of Redis distributed locks. For a single-database architecture, row locks are simpler, remove a point of failure, and are sufficiently performant. At extreme scale (e.g., millions of concurrent attempts on a single SKU), Redis would be preferred to prevent database connection queuing.
- **Sequential Cron Release**: The cron job releases expired reservations sequentially rather than in a massive batch transaction. This prevents DB deadlocks and massive locking scopes, ensuring the live application remains responsive during cleanup.
- **Idempotency**: Confirmation webhooks should theoretically include idempotency keys. While state validation (`status === "PENDING"`) prevents double-processing, full webhook integration would require tracking external transaction IDs.
