import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.7.0/dist/ethers.min.js";

const provider = new ethers.JsonRpcProvider("https://network.ambrosus.io/");

// -------------------------
// Utility: Get on-chain Tx count
// -------------------------
async function logOnChainTxCount(walletAddress) {
  try {
    const txCount = await provider.getTransactionCount(walletAddress);
    console.log(`On-chain transaction count for ${walletAddress}:`, txCount);
  } catch (err) {
    console.error("Failed to fetch on-chain transaction count:", err);
  }
}

// -------------------------
// 0. TOKEN CONFIGURATION
// -------------------------
const knownTokens = {
  "0x5cecbde7811ac0ed86be11827ae622b89bc429df": { symbol: "AST", decimals: 18 },
  "0xd09270e917024e75086e27854740871f1c8e0e10": { symbol: "HBR", decimals: 18 },
  "0xff9f502976e7bd2b4901ad7dd1131bb81e5567de": { symbol: "USDC", decimals: 6 }
};

// Treat native AMB as such:
const NATIVE_SYMBOL = "AMB";
const NATIVE_DECIMALS = 18;

// For price fetching we create a TOKEN_CONFIG and a mapping from our symbol to CoinGecko id:
const TOKEN_CONFIG = {
  AMB: {
    type: "native",
    priceFeed: "https://api.coingecko.com/api/v3/simple/price?ids=amber&vs_currencies=usd"
  },
  AST: {
    type: "erc20",
    address: "0x5cecbde7811ac0ed86be11827ae622b89bc429df",
    priceFeed: "https://api.coingecko.com/api/v3/simple/price?ids=astra-2&vs_currencies=usd"
  },
  HBR: {
    type: "erc20",
    address: "0xd09270e917024e75086e27854740871f1c8e0e10",
    priceFeed: "https://api.coingecko.com/api/v3/simple/price?ids=harbor-4&vs_currencies=usd"
  },
  USDC: {
    type: "erc20",
    address: "0xff9f502976e7bd2b4901ad7dd1131bb81e5567de",
    priceFeed: "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd"
  }
};
// Map our token symbols to CoinGecko ids:
const tokenIds = {
  AMB: "amber",
  AST: "astra-2",
  HBR: "harbor-4",
  USDC: "usd-coin"
};

// Set up a simple cache for prices (TTL = 5 minutes)
const priceCache = {
  data: null,
  timestamp: 0,
  ttl: 300000 // 300,000 ms = 5 minutes
};

// Helper function to fetch prices from your backend proxy
async function getTokenPrices() {
  try {
    if (Date.now() - priceCache.timestamp < priceCache.ttl && priceCache.data) {
      return priceCache.data;
    }
    // Your backend proxy URL for prices (adjust as needed)
    const backendUrl = "http://localhost:3000/api/prices";
    const response = await fetch(backendUrl, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      }
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error("Failed to fetch data from backend");
    }
    priceCache.data = data.data; // assume data.data is an object keyed by CoinGecko ids (e.g., { amber: { usd: 0.5 }, ... })
    priceCache.timestamp = Date.now();
    return data.data;
  } catch (error) {
    console.error("Error fetching token prices:", error);
    return {};
  }
}

// -------------------------
// 1. FETCH TRANSACTIONS
// -------------------------
async function fetchTransactions(walletAddress) {
  try {
    const response = await fetch(
      `http://localhost:3000/api/transactions?address=${walletAddress}`
    );
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || "Failed to fetch transactions");
    }
    return data.data || [];
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return [];
  }
}

// -------------------------
// 2. HELPER FUNCTIONS (decoding, formatting)
// -------------------------

// (A) decodeERC20Transfer: 0xa9059cbb => transfer(address,uint256)
function decodeERC20Transfer(inputHex) {
  const toHex = "0x" + inputHex.slice(8, 8 + 64).slice(24);
  const valueHex = "0x" + inputHex.slice(8 + 64, 8 + 128);
  const toAddress = ethers.getAddress(toHex);
  const rawValue = BigInt(valueHex);
  return { methodName: "transfer", toAddress, rawValue };
}

// (B) decodeERC20Approve: 0x095ea7b3 => approve(address,uint256)
function decodeERC20Approve(inputHex) {
  const spenderHex = "0x" + inputHex.slice(8, 8 + 64).slice(24);
  const amountHex = "0x" + inputHex.slice(8 + 64, 8 + 128);
  const spender = ethers.getAddress(spenderHex);
  const rawValue = BigInt(amountHex);
  return { methodName: "approve", spender, rawValue };
}

// (C) decodeFunctionsMap: recognized signatures
const decodeFunctionsMap = {
  "0xa9059cbb": decodeERC20Transfer,
  "0x095ea7b3": decodeERC20Approve
  // Add more signatures if needed
};

// (D) decodeTransactionData:
function decodeTransactionData(rawInput) {
  if (!rawInput || rawInput.length < 10) return null;
  const noPrefix = rawInput.startsWith("0x") ? rawInput.slice(2) : rawInput;
  const methodSig = "0x" + noPrefix.slice(0, 8).toLowerCase();
  const decodeFn = decodeFunctionsMap[methodSig];
  if (!decodeFn) return null;
  return decodeFn(noPrefix);
}

// (E) Format native AMB (from wei)
function formatAMB(valueInWei) {
  try {
    return ethers.formatEther(valueInWei);
  } catch {
    return "0";
  }
}

// (F) Truncate addresses/hashes
function truncateHash(hash, front = 10, back = 6) {
  if (!hash || hash.length < front + back) return hash;
  return `${hash.slice(0, front)}...${hash.slice(-back)}`;
}

// (G) Format date string
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

// -------------------------
// 3. BUILD TABLE ROW
// -------------------------
function buildTableRow(tx, index) {
  const fromHash = tx.from?.hash || "N/A";
  const toHash = tx.to?.hash || "Contract Creation";
  const dateString = formatDate(tx.timestamp);

  // If native AMB transfer:
  if (Number(tx.value) > 0) {
    const amtAMB = formatAMB(tx.value);
    return [
      index + 1,
      tx.hash,
      fromHash,
      toHash,
      `${amtAMB} ${NATIVE_SYMBOL}`,
      dateString
    ];
  }

  // Otherwise, if a contract call with a method field exists, try to decode it.
  if (tx.method) {
    const decoded = decodeTransactionData(tx.raw_input || "");
    if (decoded) {
      const contractAddr = (tx.to?.hash || "").toLowerCase();
      const tokenInfo = knownTokens[contractAddr];
      if (decoded.methodName === "transfer") {
        if (tokenInfo) {
          const amount = ethers.formatUnits(decoded.rawValue, tokenInfo.decimals);
          return [
            index + 1,
            tx.hash,
            fromHash,
            decoded.toAddress,
            `${amount} ${tokenInfo.symbol}`,
            dateString
          ];
        } else {
          return [
            index + 1,
            tx.hash,
            fromHash,
            decoded.toAddress,
            "(Unknown token) transfer",
            dateString
          ];
        }
      } else if (decoded.methodName === "approve") {
        if (tokenInfo) {
          const amount = ethers.formatUnits(decoded.rawValue, tokenInfo.decimals);
          return [
            index + 1,
            tx.hash,
            fromHash,
            decoded.spender,
            `approve: ${amount} ${tokenInfo.symbol}`,
            dateString
          ];
        } else {
          return [
            index + 1,
            tx.hash,
            fromHash,
            decoded.spender,
            "(Unknown token) approve",
            dateString
          ];
        }
      }
      // Fallback for recognized but not specifically handled signatures:
      return [
        index + 1,
        tx.hash,
        fromHash,
        toHash,
        `contractCall (unhandled)`,
        dateString
      ];
    } else {
      // If we cannot decode, display the method signature.
      return [
        index + 1,
        tx.hash,
        fromHash,
        toHash,
        `contractCall: ${tx.method}`,
        dateString
      ];
    }
  }

  // Fallback if no method and no native value.
  return [
    index + 1,
    tx.hash,
    fromHash,
    toHash,
    "0 (No AMB)",
    dateString
  ];
}

// -------------------------
// 4. INITIALIZE THE TABLE
// -------------------------
async function initializeTable(walletAddress) {
  const tableContainer = document.getElementById("tables");
  tableContainer.innerHTML = "<p>Loading transactions...</p>";
  const transactions = await fetchTransactions(walletAddress);
  if (!transactions || transactions.length === 0) {
    tableContainer.innerHTML = "<p>No transactions found for this wallet.</p>";
    return;
  }
  // Optionally update total Tx count in your UI (if you have an element for that)
  // document.getElementById("txTotalCount").textContent = transactions.length;

  const tableData = transactions.map((tx, i) => buildTableRow(tx, i));
  tableContainer.innerHTML = "";
  new gridjs.Grid({
    columns: [
      "S/N",
      {
        name: "Hash",
        formatter: (cell) => gridjs.html(`
          <a href="https://airdao.io/explorer/tx/${cell}"
             title="${cell}"
             style="font-weight:bold; text-decoration:underline; color:#000;">
            ${truncateHash(cell, 10, 10)}
          </a>
        `)
      },
      {
        name: "From",
        formatter: (cell) => gridjs.html(`
          <span title="${cell}">${truncateHash(cell, 10, 10)}</span>
        `)
      },
      {
        name: "To",
        formatter: (cell) => gridjs.html(`
          <span title="${cell}">${truncateHash(cell, 10, 10)}</span>
        `)
      },
      "Amount",
      "Date"
    ],
    pagination: true,
    data: tableData,
    style: {
      table: { border: "none" },
      th: {
        "background-color": "#031835",
        "text-align": "center",
        color: "#E3EFFF",
        border: "none"
      },
      td: {
        "text-align": "center",
        "background-color": "#E3EFFF"
      },
      tbody: {
        "background-color": "#E6E6E6"
      }
    }
  }).render(tableContainer);

  // IMPORTANT: update other dashboard sections (benefactors/beneficiaries) and include USD equivalents.
  await updateOtherSections(transactions, walletAddress);
}

// -------------------------
// 5. UPDATE OTHER SECTIONS (with USD value)
// -------------------------
// Make this function async so we can await price fetching.
async function updateOtherSections(transactions, walletAddress) {
  // We'll track totals by token symbol.
  // For example: totals["AMB"] = { credited: 0, debited: 0 }
  const totals = {
    AMB: { credited: 0, debited: 0 },
    AST: { credited: 0, debited: 0 },
    HBR: { credited: 0, debited: 0 },
    USDC: { credited: 0, debited: 0 }
  };

  // For top lists, we’ll track by counterparty address.
  const beneficiariesMap = {}; // Outgoing: tokens you sent (key: recipient address + "-" + symbol)
  const benefactorsMap = {};   // Incoming: tokens you received (key: sender address + "-" + symbol)

  transactions.forEach((tx) => {
    let amt = 0;
    let symbol = null;

    const fromAddr = (tx.from?.hash || "").toLowerCase();
    let toAddr = (tx.to?.hash || "ContractCreation").toLowerCase();

    // Case 1: Native AMB transfer.
    if (Number(tx.value) > 0) {
      amt = parseFloat(formatAMB(tx.value));
      symbol = NATIVE_SYMBOL; // "AMB"
    }
    // Case 2: Token transfer via contract call.
    else if (tx.method) {
      const decoded = decodeTransactionData(tx.raw_input || "");
      if (decoded && decoded.methodName === "transfer") {
        // For token transfers, the token contract is in tx.to.
        const contractAddr = toAddr;
        const tokenInfo = knownTokens[contractAddr];
        if (tokenInfo) {
          amt = parseFloat(ethers.formatUnits(decoded.rawValue, tokenInfo.decimals));
          symbol = tokenInfo.symbol.toUpperCase();
        }
        // Use the actual destination address from the decoded data.
        toAddr = decoded.toAddress.toLowerCase();
      }
      // We skip "approve" calls as they typically do not move tokens.
    }

    if (symbol) {
      // If the destination address (toAddr) equals the wallet address, then you are receiving tokens.
      if (toAddr === walletAddress.toLowerCase()) {
        totals[symbol].credited += amt;
        const key = `${fromAddr}-${symbol}`;
        if (!benefactorsMap[key]) {
          benefactorsMap[key] = { address: fromAddr, symbol, amount: 0 };
        }
        benefactorsMap[key].amount += amt;
      }
      // If the sender (fromAddr) equals the wallet address, then you are sending tokens.
      else if (fromAddr === walletAddress.toLowerCase()) {
        totals[symbol].debited += amt;
        const key = `${toAddr}-${symbol}`;
        if (!beneficiariesMap[key]) {
          beneficiariesMap[key] = { address: toAddr, symbol, amount: 0 };
        }
        beneficiariesMap[key].amount += amt;
      }
    }
  });

  // Fetch current token prices from your backend using the same method as your index.js.
  const prices = await getTokenPrices();

  // Now update the DOM elements for totals.
  // (Here we update only AMB; similar elements can be added for other tokens.)
  document.getElementById("ttcAmb").textContent = totals.AMB.credited.toFixed(2);
  document.getElementById("ttdAmb").textContent = totals.AMB.debited.toFixed(2);

  // Log totals for the tokens.
  console.log(`Total credited HBR: ${totals.HBR.credited}`);
  console.log(`Total debited HBR: ${totals.HBR.debited}`);
  console.log(`Total credited AST: ${totals.AST.credited}`);
  console.log(`Total debited AST: ${totals.AST.debited}`);
  console.log(`Total credited USDC: ${totals.USDC.credited}`);
  console.log(`Total debited USDC: ${totals.USDC.debited}`);
  console.log("Total transactions (from Blockscout):", transactions.length);

  // For the top lists, calculate each entry’s USD equivalent.
  // Use our tokenIds mapping to look up the correct price from the prices object.
  const beneficiariesArr = Object.values(beneficiariesMap).map((entry) => {
    const priceForToken = prices[tokenIds[entry.symbol]]?.usd || 0;
    const usdValue = entry.amount * priceForToken;
    return { ...entry, usdValue };
  });
  const benefactorsArr = Object.values(benefactorsMap).map((entry) => {
    const priceForToken = prices[tokenIds[entry.symbol]]?.usd || 0;
    const usdValue = entry.amount * priceForToken;
    return { ...entry, usdValue };
  });

  // Sort each array descending by USD value.
  beneficiariesArr.sort((a, b) => b.usdValue - a.usdValue);
  benefactorsArr.sort((a, b) => b.usdValue - a.usdValue);

  // Update the DOM for top beneficiaries.
  const beneContainer = document.querySelector(".bene-data");
  beneContainer.innerHTML = beneficiariesArr
    .slice(0, 5)
    .map(
      (entry) => `
      <p class="fs-6 ms-4 fw-medium top-beneficiaries">
        ${truncateHash(entry.address, 6, 4)} - ${entry.amount.toFixed(2)} ${entry.symbol} (${entry.usdValue.toFixed(2)}$)
      </p>`
    )
    .join("");

  // Update the DOM for top benefactors.
  const benefactorsContainer = document.querySelector(".benef-data");
  benefactorsContainer.innerHTML = benefactorsArr
    .slice(0, 5)
    .map(
      (entry) => `
      <p class="fs-6 ms-4 fw-medium top-benefactors">
        ${truncateHash(entry.address, 6, 4)} - ${entry.amount.toFixed(2)} ${entry.symbol} (${entry.usdValue.toFixed(2)}$)
      </p>`
    )
    .join("");
}

// -------------------------
// 6. EXAMPLE USAGE / EXPORTS
// -------------------------
const walletAddress = "0x8861186D9513cFD5d1bEb199355448Ce5E96F105";
initializeTable(walletAddress);
logOnChainTxCount(walletAddress);

export {
  knownTokens,
  fetchTransactions,
  decodeTransactionData,
  initializeTable,
  updateOtherSections
};
