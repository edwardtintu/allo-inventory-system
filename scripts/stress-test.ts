import axios from "axios";

const API_URL = "http://localhost:3000/api/reservations";

// We will test by attempting to reserve 10 items concurrently 
// when the inventory only has 3 available.
const PRODUCT_ID = "99d0474d-2cff-4905-aa20-dfb020c49c95"; // MacBook Air M4
const WAREHOUSE_ID = "d09e7e10-e7e3-436f-8a00-bcdbd835d1cd"; // Bangalore Central Warehouse
const CONCURRENT_REQUESTS = 10;

async function runStressTest() {
  console.log(`Starting concurrency stress test...`);
  console.log(`Attempting ${CONCURRENT_REQUESTS} simultaneous reservations.`);

  const requests = Array.from({ length: CONCURRENT_REQUESTS }).map(async (_, index) => {
    try {
      const response = await axios.post(API_URL, {
        productId: PRODUCT_ID,
        warehouseId: WAREHOUSE_ID,
        quantity: 1, // Reserving 1 unit per request
      });
      return { index, status: response.status, success: true, id: response.data.id };
    } catch (error: any) {
      return { 
        index, 
        status: error?.response?.status || 500, 
        success: false,
        error: error?.response?.data?.error || "Unknown Error" 
      };
    }
  });

  const results = await Promise.all(requests);
  
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const conflicts = failed.filter((r) => r.status === 409);

  console.log("\n=== TEST RESULTS ===");
  console.log(`✅ Successful Reservations: ${successful.length}`);
  console.log(`❌ Failed Reservations: ${failed.length} (409 Conflicts: ${conflicts.length})`);
  
  console.log("\nDetailed Response Log:");
  results.forEach(r => {
    if (r.success) {
      console.log(`Request ${r.index}: 201 Created (ID: ${r.id})`);
    } else {
      console.log(`Request ${r.index}: ${r.status} Failed (${r.error})`);
    }
  });

  console.log("\nIf the number of successful requests matches the exact available stock,");
  console.log("and all other requests returned 409 Conflict, then row-level locking works perfectly!");
}

runStressTest();
