// verifyContracts.js

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const Diff = require('diff');
const { execSync } = require('child_process');

// Configuration
const REPO_URL = 'https://github.com/revert-finance/lend.git';
const COMMIT_HASH = 'da1b1a2458666db01ee2fb98be190a70de16468b';
const LOCAL_REPO_DIR = path.join(__dirname, 'lend-verify'); // Directory to clone the repo into

// Replace with your Arbitrum contract addresses
const contractAddresses = [
  '0x4f8629c1056d7c7fc7e132ad2234761488baa9be',
  '0xd0186335f7b7c390b6d6c0c021212243ed297dda',
  '0x9d97c76102e72883cd25fa60e0f4143516d5b6db',
  '0xcfd55ac7647454ea0f7c4c9ec231e0a282b30980',
  '0x74e6afef5705beb126c6d3bf46f8fad8f3e07825',
  '0x9F703BFccd04389725FbaD7Bc50F2E345583d506',
  '0xe5047b321071b939d48ae8aa34770c9838bb25e8',
  '0x18616c0a8389a2cabf596f91d3e6ccc626e58997'
];

// Arbiscan API configuration
const ETHERSCAN_API_URL = 'https://api.arbiscan.io/api';
const ETHERSCAN_API_KEY = ''; // Replace with your Arbiscan API key

// Helper function to sleep
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main function to perform the entire process
async function main() {
  try {
    // Step 1: Clone the repository
    console.log('Cloning repository...');
    execSync(`git clone ${REPO_URL} ${LOCAL_REPO_DIR}`, { stdio: 'inherit' });

    // Step 2: Checkout the specific commit
    console.log(`Checking out commit ${COMMIT_HASH}...`);
    execSync(`git checkout ${COMMIT_HASH}`, { cwd: LOCAL_REPO_DIR, stdio: 'inherit' });


    console.log('Installing dependencies using Forge...');
    try {
      execSync('forge install', { cwd: LOCAL_REPO_DIR, stdio: 'inherit' });
    } catch (error) {
      console.error('Error installing dependencies with forge:', error.message);
      throw error;
    }

    // Step 4: Update PoolAddress.sol with Arbitrum-specific POOL_INIT_CODE_HASH
    console.log('Updating PoolAddress.sol with Arbitrum-specific POOL_INIT_CODE_HASH...');
    updatePoolAddress();

    // Step 5: Run the verification process
    console.log('Starting verification process...');
    await verifyContracts();

    // Step 6: Clean up (delete the cloned repository)
    console.log('Cleaning up...');
    fs.removeSync(LOCAL_REPO_DIR);
    console.log('Done.');
  } catch (error) {
    console.error('An error occurred:', error.message);
    // Clean up even if there's an error
    if (fs.existsSync(LOCAL_REPO_DIR)) {
      fs.removeSync(LOCAL_REPO_DIR);
    }
  }
}

// Function to update PoolAddress.sol
function updatePoolAddress() {
  const poolAddressPath = path.join(
    LOCAL_REPO_DIR,
    'lib',
    'v3-periphery',
    'contracts',
    'libraries',
    'PoolAddress.sol'
  );

  if (!fs.existsSync(poolAddressPath)) {
    console.error('PoolAddress.sol not found at expected path:', poolAddressPath);
    process.exit(1);
  }

  let content = fs.readFileSync(poolAddressPath, 'utf8');

  // Replace the POOL_INIT_CODE_HASH value with the Arbitrum-specific hash
  const arbitrumInitCodeHash = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54';
  const regex = /bytes32\s+internal\s+constant\s+POOL_INIT_CODE_HASH\s*=\s*0x[0-9a-fA-F]+;/;

  if (!regex.test(content)) {
    console.error('Unable to find POOL_INIT_CODE_HASH in PoolAddress.sol');
    process.exit(1);
  }

  content = content.replace(
    regex,
    `bytes32 internal constant POOL_INIT_CODE_HASH = ${arbitrumInitCodeHash};`
  );

  fs.writeFileSync(poolAddressPath, content, 'utf8');

  console.log('PoolAddress.sol updated successfully.');
}

// Main function to verify contracts
async function verifyContracts() {
  for (const address of contractAddresses) {
    await verifyContract(address);
    // Add a delay to prevent exceeding the rate limit
    await sleep(250); // 250 milliseconds delay
  }
}

// Function to verify a single contract
async function verifyContract(address) {
  console.log(`\nVerifying contract at address: ${address}`);

  const result = await fetchSourceCode(address);
  if (!result) {
    console.log(`Failed to fetch source code for address: ${address}`);
    return;
  }

  const { sources: remoteSources, contractName } = result;

  const allMatched = compareSourceFiles(remoteSources, LOCAL_REPO_DIR);

  if (allMatched) {
    console.log(`All source files match for contract ${contractName} at address ${address}.`);
  } else {
    console.log(
      `Differences found in source files for contract ${contractName} at address ${address}.`
    );
  }
}

// Fetch contract source code from Arbiscan
async function fetchSourceCode(address) {
  try {
    const response = await axios.get(ETHERSCAN_API_URL, {
      params: {
        module: 'contract',
        action: 'getsourcecode',
        address: address,
        apikey: ETHERSCAN_API_KEY,
      },
    });

    if (response.data.status !== '1') {
      throw new Error(`Arbiscan API error: ${response.data.result}`);
    }

    const result = response.data.result[0];
    let sourceCode = result.SourceCode;
    const contractName = result.ContractName;

    // Check if sourceCode is empty or undefined
    if (!sourceCode || sourceCode.trim() === '') {
      throw new Error(
        `No source code found for address ${address}. The contract may not be verified on Arbiscan.`
      );
    }

    // Handle possible Solidity files wrapped in JSON (multi-part files)
    let parsedSources = null;

    if (sourceCode.startsWith('{{') && sourceCode.endsWith('}}')) {
      // Remove extra braces and parse JSON
      const parsed = JSON.parse(sourceCode.slice(1, -1));
      if (parsed.sources) {
        parsedSources = parsed.sources;
      } else {
        throw new Error(`Unable to find 'sources' key in SourceCode for address ${address}`);
      }
    } else if (sourceCode.startsWith('{') && sourceCode.endsWith('}')) {
      // Handle single-brace JSON structures
      const parsed = JSON.parse(sourceCode);
      if (parsed.sources) {
        parsedSources = parsed.sources;
      } else {
        throw new Error(`Unable to find 'sources' key in SourceCode for address ${address}`);
      }
    } else {
      throw new Error(`SourceCode format not recognized for address ${address}`);
    }

    // Optional: Save the remote sources for inspection
    saveRemoteSources(parsedSources, contractName, address);

    return { sources: parsedSources, contractName };
  } catch (error) {
    console.error(`Error fetching source code for address ${address}:`, error.message);
    return null;
  }
}

// Save remote source files to disk for inspection
function saveRemoteSources(sources, contractName, address) {
  const outputDir = path.join(__dirname, 'remote_sources', `${contractName}_${address}`);
  fs.ensureDirSync(outputDir);

  for (const filePath in sources) {
    const fileContent = sources[filePath].content;
    const outputFilePath = path.join(outputDir, filePath);

    // Ensure the directory exists
    fs.ensureDirSync(path.dirname(outputFilePath));

    fs.writeFileSync(outputFilePath, fileContent, 'utf8');
  }

  console.log(`Remote source files saved to: ${outputDir}`);
}

// Compare remote and local source files
function compareSourceFiles(remoteSources, localSourceDir) {
  let allMatched = true;

  for (const filePath in remoteSources) {
    const remoteContent = remoteSources[filePath].content;

    const localFilePath = path.join(localSourceDir, filePath);
    if (!fs.existsSync(localFilePath)) {
      console.log(`Local file not found: ${localFilePath}`);
      allMatched = false;
      continue;
    }

    const localContent = fs.readFileSync(localFilePath, 'utf8');

    const normalizedRemote = normalizeSourceCode(remoteContent);
    const normalizedLocal = normalizeSourceCode(localContent);
    
    if (normalizedRemote !== normalizedLocal) {
      const diff = Diff.createPatch(filePath, localContent, remoteContent);
      
      // Split the diff into lines
      const diffLines = diff.split('\n');
      
      // Check if the diff ONLY contains the removal of SequencerUptimeFeedInvalid
      // 
      const acceptableDiff = diffLines.length === 15 && 
                             diffLines[0] === 'Index: src/utils/Constants.sol' && 
                             diffLines[4] === '@@ -27,9 +27,8 @@' && 
                             diffLines[9] === '-    error SequencerUptimeFeedInvalid();'

      const acceptableDiffContracts = ["0xd0186335f7b7c390b6d6c0c021212243ed297dda",
                                       "0x9d97c76102e72883cd25fa60e0f4143516d5b6db",
                                       "0xcfd55ac7647454ea0f7c4c9ec231e0a282b30980"]
      
      if (!acceptableDiff and acceptableDiffContracts) {
        console.log(`Mismatch in file: ${filePath}`);
        console.log(diff);
        allMatched = false;
      } else {
        console.log(`Acceptable difference found in file: ${filePath}`);
        console.log('The SequencerUptimeFeedInvalid error was removed, which is allowed.');
      }
    } else {
      console.log(`File matches: ${filePath}`);
    }
  }

  return allMatched;
}

// Normalize source code to reduce formatting differences
function normalizeSourceCode(code) {
  // Remove comments
  code = code.replace(/\/\/.*$/gm, ''); // Single-line comments
  code = code.replace(/\/\*[\s\S]*?\*\//g, ''); // Multi-line comments

  // Remove carriage returns and normalize line endings
  code = code.replace(/\r/g, '');

  // Remove extra whitespace
  code = code.replace(/\s+/g, ' ');

  // Remove SPDX License Identifiers and Pragma statements
  code = code.replace(/SPDX-License-Identifier:.*?(\n|$)/g, '');
  code = code.replace(/pragma solidity.*?;/g, '');

  return code.trim();
}

// Start the process
main();

