import { ethers } from "ethers";
// Create a provider to connect to AirDAO
// (Replace with an actual AirDAO RPC endpoint if needed.)
const provider = new ethers.JsonRpcProvider("https://network.ambrosus.io/");

// Example function that logs the "on-chain" tx count
async function logOnChainTxCount(walletAddress) {
  try {
    // getTransactionCount => number of transactions this address has sent
    const txCount = await provider.getTransactionCount(walletAddress);
    console.log(`On-chain transaction count for ${walletAddress}:`, txCount);
  } catch (err) {
    console.error("Failed to fetch on-chain transaction count:", err);
  }
}

// Example usage:
const walletAddress = "0x8861186D9513cFD5d1bEb199355448Ce5E96F105";
logOnChainTxCount(walletAddress);
