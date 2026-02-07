require('dotenv').config();
const actual = require('@actual-app/api');

async function testConnection() {
  console.log("⏳ Connecting to Actual Budget...");

  try {
    // Initialize the API with your server URL and password
    await actual.init({
      serverURL: process.env.ACTUAL_SERVER_URL,
      password: process.env.ACTUAL_PASSWORD,
    });

    console.log("✅ Server connection established.");

    // Try to download your specific budget file
    console.log(`⏳ Downloading budget ID: ${process.env.ACTUAL_SYNC_ID}...`);
    await actual.downloadBudget(process.env.ACTUAL_SYNC_ID);

    console.log("✅ SUCCESS: Budget downloaded successfully!");
    // NEW CODE: List all accounts to find the right ID
    const accounts = await actual.getAccounts();
    console.log("\n📋 YOUR ACCOUNTS:");
    accounts.forEach(acct => {
      console.log(`- Name: "${acct.name}" | ID: ${acct.id}`);
    });
    // Clean up and close connection
    await actual.shutdown();
    
  } catch (error) {
    console.error("❌ CONNECTION FAILED:", error.message);
  }
}

testConnection();