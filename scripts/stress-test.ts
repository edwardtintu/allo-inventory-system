import axios from "axios";

const API_URL = "http://localhost:3000/api/reservations";

// We will test by attempting to reserve 10 items concurrently 
// when the inventory only has 3 available.
const PRODUCT_ID = "de01dd4d-ac26-40da-af1d-1a57dc582bf7"; // Replace with actual ID
const WAREHOUSE_ID = "6cfd78fc-94f8-413b-93c2-836ec6d74d3c"; // Replace with actual ID
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
