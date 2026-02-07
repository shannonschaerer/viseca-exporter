require('dotenv').config(); // Load environment variables from .env file
const { execFile: executeExternalFile } = require('child_process');
const createCsvParser = require('csv-parser');
const { Readable } = require('stream');
const pathModule = require('path');

// --- CONFIGURATION ---

// 1. Locate the Go binary file
// __dirname is a Node.js variable that means "the folder this script is in"
const visecaExporterBinaryPath = pathModule.join(__dirname, 'viseca-exporter');

// 2. Load Sensitive Data from Environment
// We will pass these in via the terminal when we run the script
const visecaUsername = process.env.VISECA_CLI_USERNAME;
const visecaPassword = process.env.VISECA_CLI_PASSWORD;
const visecaCardId = process.env.VISECA_CARD_ID;

/**
 * Main function to coordinate the fetching and parsing of transactions.
 */
async function fetchTransactions() {
  console.log("⏳ Starting Viseca Export Process...");

  // 1. Validation: Ensure all credentials are present in the "backpack"
  if (!visecaUsername || !visecaPassword || !visecaCardId) {
    throw new Error("Missing required credentials! Please set your username, password, and card ID environment variables.");
  }

  // 2. Execution: Run the external Go binary (Function defined next step)
  const rawCsvOutput = await runVisecaProcess();

  // 3. Parsing: Convert CSV text to JavaScript Objects (Function defined next step)
  const parsedTransactions = await parseCsvData(rawCsvOutput);

  return parsedTransactions;
}

// --- SELF-TEST BLOCK ---
// This allows you to run this file directly (node fetcher.js) to test it.
if (require.main === module) {
  fetchTransactions()
    .then((data) => {
      console.log(`✅ Successfully fetched ${data.length} transactions.`);
      console.log(data); // Print the results to see them
    })
    .catch((error) => {
      console.error("❌ Failed:", error.message);
    });
}


/**
 * Executes the Viseca Exporter binary and returns the raw CSV string.
 */
function runVisecaProcess() {
  return new Promise((resolve, reject) => {
    
    // Arguments to pass to the binary: "transactions" "YOUR_CARD_ID"
    const commandArguments = ['transactions', visecaCardId];

    // Options for the execution environment
    const executionOptions = {
      env: {
        ...process.env, // Keep existing environment variables (PATH, etc.)
        VISECA_CLI_USERNAME: visecaUsername, // Inject our specific vars
        VISECA_CLI_PASSWORD: visecaPassword
      },
      maxBuffer: 1024 * 1024 * 5 // Increase buffer to 5MB (prevents crash on large data)
    };

    // The actual command execution
    executeExternalFile(
      visecaExporterBinaryPath, 
      commandArguments, 
      executionOptions, 
      (error, stdout, stderr) => {
        if (error) {
          // If the binary crashes or exits with an error code
          reject(new Error(`Exporter failed: ${stderr || error.message}`));
          return;
        }
        // If successful, resolve with the standard output (the CSV data)
        resolve(stdout);
      }
    );
  });
}

/**
 * Converts a raw CSV string into an array of JavaScript objects.
 */
function parseCsvData(csvString) {
  return new Promise((resolve, reject) => {
    const transactions = [];

    // Create a "Stream" from the string so the parser can read it line-by-line
    Readable.from(csvString)
      .pipe(createCsvParser()) // Pipe the data into the parser tool
      .on('data', (row) => {
        // This fires for every single row found in the CSV
        transactions.push(row);
      })
      .on('end', () => {
        // This fires when the entire string has been read
        resolve(transactions);
      })
      .on('error', (error) => {
        // This fires if the CSV format is broken
        reject(error);
      });
  });
}

module.exports = { fetchTransactions };
