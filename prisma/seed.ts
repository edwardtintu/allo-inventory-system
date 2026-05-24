import { config } from "dotenv";
config();

import { Client } from "pg";

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  console.log("🌱 Starting seed...");

  // Clear in FK-safe order
  await client.query(`DELETE FROM "Reservation"`);
  await client.query(`DELETE FROM "Inventory"`);
  await client.query(`DELETE FROM "Product"`);
  await client.query(`DELETE FROM "Warehouse"`);

  // ─── Warehouses ────────────────────────────────────
  const { rows: [bangalore] } = await client.query(
    `INSERT INTO "Warehouse" (id, name, location, "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, now()) RETURNING id`,
    ["Bangalore Central Warehouse", "Bangalore"]
  );
  const { rows: [mumbai] } = await client.query(
    `INSERT INTO "Warehouse" (id, name, location, "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, now()) RETURNING id`,
    ["Mumbai Fulfillment Hub", "Mumbai"]
  );
  const { rows: [delhi] } = await client.query(
    `INSERT INTO "Warehouse" (id, name, location, "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, now()) RETURNING id`,
    ["Delhi Distribution Center", "Delhi"]
  );

  // ─── Products ──────────────────────────────────────
  const { rows: [iphone] } = await client.query(
    `INSERT INTO "Product" (id, name, description, sku, "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, now()) RETURNING id`,
    ["iPhone 16 Pro", "Apple flagship smartphone", "APL-IP16PRO"]
  );
  const { rows: [macbook] } = await client.query(
    `INSERT INTO "Product" (id, name, description, sku, "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, now()) RETURNING id`,
    ["MacBook Air M4", "Apple lightweight laptop", "APL-MBA-M4"]
  );
  const { rows: [sony] } = await client.query(
    `INSERT INTO "Product" (id, name, description, sku, "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, now()) RETURNING id`,
    ["Sony WH-1000XM5", "Noise cancelling headphones", "SNY-WH1000XM5"]
  );

  // ─── Inventory ─────────────────────────────────────
  // iPhone in 2 warehouses — proves multi-warehouse architecture
  await client.query(
    `INSERT INTO "Inventory" (id, "productId", "warehouseId", "totalStock", "reservedStock", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, 0, now(), now())`,
    [iphone.id, bangalore.id, 10]
  );
  await client.query(
    `INSERT INTO "Inventory" (id, "productId", "warehouseId", "totalStock", "reservedStock", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, 0, now(), now())`,
    [iphone.id, mumbai.id, 5]
  );
  await client.query(
    `INSERT INTO "Inventory" (id, "productId", "warehouseId", "totalStock", "reservedStock", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, 0, now(), now())`,
    [macbook.id, bangalore.id, 7]
  );
  await client.query(
    `INSERT INTO "Inventory" (id, "productId", "warehouseId", "totalStock", "reservedStock", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, 0, now(), now())`,
    [sony.id, delhi.id, 15]
  );

  console.log("✅ Seed completed successfully");
  console.log(`   Warehouses : 3 (Bangalore, Mumbai, Delhi)`);
  console.log(`   Products   : 3 (iPhone, MacBook, Sony)`);
  console.log(`   Inventory  : 4 rows (iPhone split across 2 warehouses)`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => client.end());
