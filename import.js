require('dotenv').config();
const actual = require('@actual-app/api');
const { fetchTransactions } = require('./fetcher');

// --- CONFIGURATION ---
const SERVER_URL = process.env.ACTUAL_SERVER_URL;
const PASSWORD = process.env.ACTUAL_PASSWORD;
const SYNC_ID = process.env.ACTUAL_SYNC_ID;
const ACCOUNT_ID = process.env.ACTUAL_ACCOUNT_ID;

// 📅 DATE RANGE FILTER (YYYY-MM-DD)
// Transactions BEFORE this date are ignored (protects your manual history).
const START_DATE = '2026-01-08'; 

// Transactions AFTER this date are ignored (leaves data for testing).
// Set to null to import everything up to today.
const END_DATE = '2026-01-31'; 

async function runImport() {
  try {
    console.log(`🚀 Starting Import Run...`);
    console.log(`📅 Date Range: ${START_DATE} to ${END_DATE || 'TODAY'}`);

    console.log("📡 Fetching data from Viseca...");
    const allTransactions = await fetchTransactions();
    
    if (allTransactions.length === 0) {
      console.log("⚠️ No transactions found from Viseca.");
      return;
    }

    // --- FILTER BY DATE RANGE ---
    const newTransactions = allTransactions.filter(t => {
      // Viseca Date format: 2025-12-23T18:11:23 -> "2025-12-23"
      const tDate = t.Date.split('T')[0];

      // Check Start Date
      if (tDate < START_DATE) return false;

      // Check End Date (if set)
      if (END_DATE && tDate > END_DATE) return false;

      return true;
    });

    if (newTransactions.length === 0) {
      console.log("✅ No transactions found in this date range.");
      return;
    }

    console.log(`✅ Found ${newTransactions.length} transactions to import.`);

    // Connect to Actual
    console.log("🔌 Connecting to Actual Budget...");
    await actual.init({ serverURL: SERVER_URL, password: PASSWORD });
    await actual.downloadBudget(SYNC_ID);

    // --- MAPPING LOGIC ---
    const mappedTransactions = newTransactions.map(t => {
      // 1. Handle Amount (Flip sign logic)
      let amountCents = Math.round(parseFloat(t.Amount) * 100);
      
      // If Viseca shows spending as positive (30.00), make it negative (-30.00)
      // If Viseca shows payment as negative (-1000.00), make it positive (1000.00)
      amountCents = -amountCents; 

      // 2. Handle Date
      const dateOnly = t.Date.split('T')[0];

      return {
        date: dateOnly,
        amount: amountCents,
        payee_name: t.Merchant,
        notes: t.PFMCategoryName || "",
        imported_id: t.TransactionID,
        cleared: true
      };
    });

    // Import
    console.log(`📥 Importing into Actual Account ID: ${ACCOUNT_ID}...`);
    await actual.importTransactions(ACCOUNT_ID, mappedTransactions);

    console.log("✅ Import Complete!");
    await actual.shutdown();

  } catch (error) {
    console.error("❌ ERROR:", error);
    try { await actual.shutdown(); } catch (e) { }
  }
}

runImport();