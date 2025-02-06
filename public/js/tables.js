import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.7.0/dist/ethers.min.js";

const provider = new ethers.JsonRpcProvider("https://network.ambrosus.io/");

async function logOnChainTxCount(walletAddress) {
  try {
    // getTransactionCount => number of transactions this address has sent
    const txCount = await provider.getTransactionCount(walletAddress);
    console.log(`On-chain transaction count for ${walletAddress}:`, txCount);
  } catch (err) {
    console.error("Failed to fetch on-chain transaction count:", err);
  }
}

// =========================
// 0. TOKEN CONFIG
// =========================
const knownTokens = {
  "0x5cecbde7811ac0ed86be11827ae622b89bc429df": { symbol: "AST", decimals: 18 },
  "0xd09270e917024e75086e27854740871f1c8e0e10": { symbol: "HBR", decimals: 18 },
  "0xff9f502976e7bd2b4901ad7dd1131bb81e5567de": { symbol: "USDC", decimals: 6 }
};

// We’ll treat native AMB as symbol "AMB" with decimals = 18 (for convenience)
const NATIVE_SYMBOL = "AMB";
const NATIVE_DECIMALS = 18;

// =========================
// 1. FETCH TRANSACTIONS
// =========================
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

// =========================
// 2. HELPER FUNCTIONS
// =========================

// (A) decodeERC20Transfer: 0xa9059cbb => transfer(address,uint256)
function decodeERC20Transfer(inputHex) {
  // next 32 bytes => to, next 32 => value
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

// (C) decodeFunctionsMap: recognized signatures => decode function
const decodeFunctionsMap = {
  "0xa9059cbb": decodeERC20Transfer, // transfer
  "0x095ea7b3": decodeERC20Approve // approve
  // Add more if needed
};

// (D) decodeTransactionData:
function decodeTransactionData(rawInput) {
  if (!rawInput || rawInput.length < 10) {
    return null;
  }
  const noPrefix = rawInput.startsWith("0x") ? rawInput.slice(2) : rawInput;
  const methodSig = "0x" + noPrefix.slice(0, 8).toLowerCase();

  const decodeFn = decodeFunctionsMap[methodSig];
  if (!decodeFn) return null;

  return decodeFn(noPrefix);
}

// (E) Format AMB from wei
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

// (G) Format date
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

// =========================
// 3. BUILD TABLE ROW
// =========================
function buildTableRow(tx, index) {
  const fromHash = tx.from?.hash || "N/A";
  const toHash = tx.to?.hash || "Contract Creation";
  const dateString = formatDate(tx.timestamp);

  // 1) If there's native AMB
  if (Number(tx.value) > 0) {
    const amtAMB = formatAMB(tx.value);
    return [
      index + 1,
      tx.hash,
      fromHash,
      toHash,
      `${amtAMB} AMB`,
      dateString
    ];
  }

  // 2) If "method" is present => attempt decode
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

      // fallback if recognized signature not handled
      return [
        index + 1,
        tx.hash,
        fromHash,
        toHash,
        `contractCall (unhandled)`,
        dateString
      ];
    } else {
      // can't decode => show method
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

  // 3) Fallback if no method, no AMB
  return [
    index + 1,
    tx.hash,
    fromHash,
    toHash,
    "0 (No AMB)",
    dateString
  ];
}

// =========================
// 4. INITIALIZE THE TABLE
// =========================
async function initializeTable(walletAddress) {
  const tableContainer = document.getElementById("tables");
  tableContainer.innerHTML = "<p>Loading transactions...</p>";

  const transactions = await fetchTransactions(walletAddress);
  if (!transactions || transactions.length === 0) {
    tableContainer.innerHTML = "<p>No transactions found for this wallet.</p>";
    return;
  }

  // --- NEW: update total Tx count
  // Suppose you have an element with ID "txTotalCount" in your HTML
  // document.getElementById("txTotalCount").textContent = transactions.length;

  const tableData = transactions.map((tx, i) => buildTableRow(tx, i));
  tableContainer.innerHTML = ""; // clear

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
        `),
      },
      {
        name: "From",
        formatter: (cell) => gridjs.html(`
          <span title="${cell}">${truncateHash(cell, 10, 10)}</span>
        `),
      },
      {
        name: "To",
        formatter: (cell) => gridjs.html(`
          <span title="${cell}">${truncateHash(cell, 10, 10)}</span>
        `),
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
        border: "none",
      },
      td: {
        "text-align": "center",
        "background-color": "#E3EFFF",
      },
      tbody: {
        "background-color": "#E6E6E6",
      },
    },
  }).render(tableContainer);

  updateOtherSections(transactions, walletAddress);
}

// =========================
// 5. UPDATE OTHER SECTIONS
// =========================
function updateOtherSections(transactions, walletAddress) {
  //
  // Instead of a single totalCredited/totalDebited, we track by token symbol
  //
  // We'll store data in an object keyed by symbol (lowercase or uppercase).
  // For example:
  //   totals["AMB"] = { credited: 0, debited: 0 }
  //   totals["HBR"] = { credited: 0, debited: 0 }
  //   ...
  // We'll fill them up as we parse each transaction.
  //
  const totals = {
    AMB: { credited: 0, debited: 0 },
    AST: { credited: 0, debited: 0 },
    HBR: { credited: 0, debited: 0 },
    USDC: { credited: 0, debited: 0 }
  };

  // We also track top addresses if needed
  const beneficiariesMap = {};
  const benefactorsMap = {};

  transactions.forEach((tx) => {
    let amt = 0;
    let symbol = null;

    const fromAddr = (tx.from?.hash || "").toLowerCase();
    let toAddr = (tx.to?.hash || "ContractCreation").toLowerCase();

    // 1) Check if it's native AMB
    if (Number(tx.value) > 0) {
      amt = parseFloat(formatAMB(tx.value));
      symbol = NATIVE_SYMBOL; // "AMB"
    } else if (tx.method) {
      // decode ERC-20
      const decoded = decodeTransactionData(tx.raw_input || "");
      if (decoded && decoded.methodName === "transfer") {
        // which token contract is this?
        const contractAddr = toAddr; // the tx.to (the token contract)
        const tokenInfo = knownTokens[contractAddr];
        if (tokenInfo) {
          amt = parseFloat(ethers.formatUnits(decoded.rawValue, tokenInfo.decimals));
          symbol = tokenInfo.symbol.toUpperCase();
        }
        toAddr = decoded.toAddress.toLowerCase();
      } else if (decoded && decoded.methodName === "approve") {
        // typically no token movement, so skip
      }
    }

    // If we recognized a symbol and amt
    if (symbol) {
      // inbound if (to == wallet)
      if (toAddr === walletAddress.toLowerCase()) {
        totals[symbol].credited += amt;
        benefactorsMap[fromAddr] = (benefactorsMap[fromAddr] || 0) + amt;
      } 
      // outbound if (from == wallet)
      else if (fromAddr === walletAddress.toLowerCase()) {
        totals[symbol].debited += amt;
        beneficiariesMap[toAddr] = (beneficiariesMap[toAddr] || 0) + amt;
      }
    }
  });

  // --- Now update DOM elements
  // For AMB
  document.getElementById("ttcAmb").textContent = totals.AMB.credited.toFixed(2);
  document.getElementById("ttdAmb").textContent = totals.AMB.debited.toFixed(2);

  // For HBR
  // (You need HTML IDs: ttcHbr, ttdHbr)
  // document.getElementById("ttcHbr").textContent = totals.HBR.credited.toFixed(2);
  // document.getElementById("ttdHbr").textContent = totals.HBR.debited.toFixed(2);

  // For AST
  // (HTML IDs: ttcAst, ttdAst)
  // document.getElementById("ttcAst").textContent = totals.AST.credited.toFixed(2);
  // document.getElementById("ttdAst").textContent = totals.AST.debited.toFixed(2);

  // For USDC
  // (HTML IDs: ttcUsdc, ttdUsdc)
  // document.getElementById("ttcUsdc").textContent = totals.USDC.credited.toFixed(2);
  // document.getElementById("ttdUsdc").textContent = totals.USDC.debited.toFixed(2);

  //
  // If you previously had "ttcAmb" and "ttdAmb" for everything,
  // now each token has its own pair of IDs. The code above updates them.
  //


  // Log to console: total credit/debit for HBR, USDC, AST
  console.log(`Total credited HBR: ${totals.HBR.credited}`);
  console.log(`Total debited HBR:  ${totals.HBR.debited}`);

  console.log(`Total credited AST: ${totals.AST.credited}`);
  console.log(`Total debited AST:  ${totals.AST.debited}`);

  console.log(`Total credited USDC: ${totals.USDC.credited}`);
  console.log(`Total debited USDC:  ${totals.USDC.debited}`);


  // You can also gather top beneficiaries/benefactors if you want
  const topBeneficiaries = Object.entries(beneficiariesMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topBenefactors = Object.entries(benefactorsMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const beneContainer = document.querySelector(".bene-data");
  beneContainer.innerHTML = topBeneficiaries
    .map(
      ([address, val]) => `
      <p class="fs-6 ms-4 fw-medium top-beneficiaries">
        ${truncateHash(address, 6, 4)} - ${val.toFixed(2)}
      </p>`
    )
    .join("");

  const benefactorsContainer = document.querySelector(".benef-data");
  benefactorsContainer.innerHTML = topBenefactors
    .map(
      ([address, val]) => `
      <p class="fs-6 ms-4 fw-medium top-benefactors">
        ${truncateHash(address, 6, 4)} - ${val.toFixed(2)}
      </p>`
    )
    .join("");
}

// ============================
// 6. EXAMPLE USAGE / EXPORTS
// ============================
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
