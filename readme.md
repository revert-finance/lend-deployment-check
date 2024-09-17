# Contract Verification Script

## Purpose

This script is designed to provide transparency and assurance that the deployed smart contracts on the Arbitrum blockchain match the audited codebase from the latest audit conducted by PeckShield. Since the contracts are **non-upgradable**, verifying that the deployed code is identical to the audited code is crucial for trust and security within the community.

By automating the verification process, anyone can independently confirm that the contracts running on the blockchain are the same as those reviewed during the audit, ensuring no malicious alterations have been made post-audit.

## What This Script Does

The script performs the following steps:

1. **Clone the GitHub Repository**

   - It clones the repository from [https://github.com/revert-finance/lend](https://github.com/revert-finance/lend) into a local directory.
   - This repository contains the source code of the smart contracts as audited by PeckShield.

2. **Checkout the Specific Commit**

   - It checks out the commit with hash `da1b1a2458666db01ee2fb98be190a70de16468b`.
   - This commit corresponds to the exact codebase that was [audited by PeckShield](https://github.com/peckshield/publications/blob/master/audit_reports/PeckShield-Audit-Report-Revert-Lend-v1.0.pdf).
   - Ensuring the code matches the audited version is essential for accurate verification.

3. **Install Dependencies**

   - It installs all necessary dependencies using `forge install`.
   - Dependencies are required for the contracts to compile and for the code comparison to be accurate.

4. **Update `PoolAddress.sol` with Arbitrum-Specific `POOL_INIT_CODE_HASH`**

   - We use the periphery contracts for Solidity 0.8, so we need to change the `POOL_INIT_CODE_HASH` to match the deployment.
   - The script modifies the `PoolAddress.sol` file to set the `POOL_INIT_CODE_HASH` constant to the Arbitrum deployment value:

     ```solidity
     bytes32 internal constant POOL_INIT_CODE_HASH = 0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54;
     ```

5. **Download Verified Deployed Source Code from Arbiscan**

   - For each specified contract address on Arbitrum, the script fetches the verified source code from [Arbiscan](https://arbiscan.io/).
   - The source code is downloaded and saved locally for comparison.

6. **Compare Local and Deployed Source Code**

   - The script compares each remote source file with the corresponding local file from the cloned repository.
   - It normalizes the code by removing comments, extra whitespace, and other non-functional differences to ensure an accurate comparison.

7. **Handle Special Cases**

   - There is **one acceptable difference** in `src/utils/Constants.sol` for specific contracts.
   - The script allows for this specific known difference:

     ```diff
     -    error SequencerUptimeFeedInvalid();
     ```

   - **No other differences are considered acceptable**. If any other diffs are found, they will be reported.

8. **Print Differences or Verification Success**

   - If differences are found that are not part of the known exception, the script prints the diffs for inspection.
   - If no relevant diffs are found, it prints that the contract verification has passed for that contract.

9. **Clean Up**

   - After the verification process is complete, the script deletes the cloned repository and any temporary files to clean up the workspace.

## Why This Matters

- **Transparency:** Allows anyone to verify that the deployed contracts are exactly the ones that were audited, fostering trust in the protocol.
- **Security:** Ensures that no unauthorized changes have been made to the contracts since the audit, which could introduce vulnerabilities or malicious code.
- **Community Confidence:** Provides the community with tools to independently verify the integrity of the contracts they interact with.

## How to Use the Script

### Prerequisites

- **Node.js and npm:** Ensure you have Node.js installed on your system.
- **Git:** Required for cloning the repository.
- **Foundry:** Install Foundry by following the instructions at [Foundry Book - Installation](https://book.getfoundry.sh/getting-started/installation).
- **Arbiscan API Key:** Obtain an API key from [Arbiscan](https://arbiscan.io/myapikey) and replace `'YOUR_ARBISCAN_API_KEY'` in the script with your actual API key.

### Steps

1. **Install Required npm Packages**

   ```bash
   npm install axios fs-extra diff

2. **Update the Script with Your API Key**

   In the script, replace `'YOUR_ARBISCAN_API_KEY'` with your actual Arbiscan API key:

   ```javascript
   const ETHERSCAN_API_KEY = 'YOUR_ACTUAL_ARBISCAN_API_KEY

3. **Run the Script**

   ```bash
   node verifyContracts.js

### Expected Output

- The script will output logs indicating the progress of each step.
- It will notify you if all source files match or if any differences are found.
- If differences are found, it will print the diffs for you to inspect.


## Understanding the Verification Process

- **Normalization of Source Code:**

  - The script normalizes both local and remote source code by removing comments, whitespace, and other non-functional differences.
  - This ensures that the comparison focuses on meaningful code differences.

- **Handling Special Cases:**

  - There is one acceptable difference in `src/utils/Constants.sol` for specific contracts. The script accounts for this known exception.

  - **Acceptable Diff:**

    ```diff
    -    error SequencerUptimeFeedInvalid();
    ```

  - **Affected Contracts:**

    - `0xd0186335f7b7c390b6d6c0c021212243ed297dda`
    - `0x9d97c76102e72883cd25fa60e0f4143516d5b6db`
    - `0xcfd55ac7647454ea0f7c4c9ec231e0a282b30980`

  - **Note:** **No other differences are considered acceptable**. If any other diffs are found, they will be reported for inspection.

- **Reporting Differences:**

  - If the script finds differences that are not part of the known exception, it reports them.
  - This allows for manual inspection and further investigation.

## Security Considerations

- **Non-Upgradable Contracts:**

  - Since the contracts are non-upgradable, verifying the deployed code matches the audited code is critical.
  - Any discrepancy could indicate unauthorized changes or potential vulnerabilities.

- **Independent Verification:**

  - By using this script, anyone can independently verify the integrity of the deployed contracts.
  - This reduces reliance on third-party assurances and increases trust in the protocol.

## Conclusion

This script serves as a tool for transparency and security within the DeFi community. By automating the verification process, it empowers users, developers, and auditors to ensure that the deployed smart contracts are exactly those that were audited and intended for deployment. This helps maintain trust, security, and integrity in the ecosystem.

---

**Note:** Always make sure to understand and verify scripts before running them, especially when they interact with external systems or handle critical data.
