import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.7.0/dist/ethers.min.js";

// =========================
// 1. FETCH TRANSACTIONS
// =========================
async function fetchTransactions(walletAddress) {
  try {
    // Call your backend, which queries Blockscout
    const response = await fetch(`http://localhost:3000/api/transactions?address=${walletAddress}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch transactions');
    }
    
    // The raw transaction array is in data.data.items
    return data.data || [];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

// =========================
// 2. FORMAT HELPERS
// =========================

// Convert a big-number string in wei to a “human” AMB value
function formatAMB(valueInWei) {
  try {
    // If valueInWei is "0" or empty, you’ll get "0.0" in many cases
    return ethers.formatEther(valueInWei);
  } catch {
    return "0";
  }
}

// Shorten an address/string to something like 0xabcd...1234
function truncateHash(hash, front = 10, back = 6) {
  if (!hash || hash.length < front + back) {
    return hash;
  }
  return `${hash.slice(0, front)}...${hash.slice(-back)}`;
}

// Convert timestamp string (e.g. "2025-02-03T22:31:35.000000Z") to local date
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(); // e.g. "2/3/2025, 10:31:35 PM"
}

// =========================
// 3. INITIALIZE THE TABLE
// =========================
async function initializeTable(walletAddress) {
  // Show loading state
  const tableContainer = document.getElementById('tables');
  tableContainer.innerHTML = '<p>Loading transactions...</p>';

  // Fetch transactions from your backend
  const transactions = await fetchTransactions(walletAddress);
  if (!transactions || transactions.length === 0) {
    tableContainer.innerHTML = '<p>No transactions found for this wallet.</p>';
    return;
  }

  // Build the table data
  const tableData = transactions.map((tx, index) => {
    // from, to can be null or objects; handle carefully
    const fromHash = tx.from?.hash || "N/A";
    const toHash = tx.to?.hash || "Contract Creation";
    
    // Format the value (AMB)
    // If it's an ERC20 transfer, tx.value might be "0"
    // For actual coin transfers, tx.value in wei
    const amountAMB = formatAMB(tx.value);

    // Format the timestamp
    const dateString = formatDate(tx.timestamp);

    // Return the row data
    return [
      index + 1,  // S/N
      tx.hash,    // Full hash (we’ll truncate it in the GridJS formatter)
      fromHash,
      toHash,
      `${amountAMB} AMB`,
      dateString,
    ];
  });

  tableContainer.innerHTML = ''; // Clear loading text

  // ===============================
  // 4. Initialize GridJS
  // ===============================
  new gridjs.Grid({
    columns: [
      "S/N",
      {
        name: "Hash",
        formatter: (cell) => gridjs.html(`
          <a href="https://explorer.airdao.io/tx/${cell}"
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
      "Date",
    ],
    pagination: true,
    data: tableData,
    style: {
      table: {
        border: "none"
      },
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
  }).render(document.getElementById("tables"));
  
  // Also update the other sections (Top Beneficiaries, Top Benefactors, Income/Expenditure)
  updateOtherSections(transactions, walletAddress);
}

// =========================
// 5. UPDATE OTHER SECTIONS
// =========================
function updateOtherSections(transactions, walletAddress) {
  // These objects will hold the aggregated sums
  const beneficiariesMap = {};
  const benefactorsMap = {};
  let totalCredited = 0;
  let totalDebited = 0;
  let creditCount = 0;
  let debitCount = 0;

  transactions.forEach((tx) => {
    const rawValueAMB = formatAMB(tx.value); 
    const valueAMB = parseFloat(rawValueAMB);

    // “Credit” if your wallet is the “to” => you received
    if (tx.to?.hash && tx.to.hash.toLowerCase() === walletAddress.toLowerCase()) {
      totalCredited += valueAMB;
      creditCount++;
      // The entity that sent you (tx.from) is effectively a “benefactor”
      const fromHash = tx.from?.hash || "Unknown";
      benefactorsMap[fromHash] = (benefactorsMap[fromHash] || 0) + valueAMB;
    }
    // “Debit” if your wallet is the “from” => you sent out
    else if (tx.from?.hash && tx.from.hash.toLowerCase() === walletAddress.toLowerCase()) {
      totalDebited += valueAMB;
      debitCount++;
      // The entity that you sent to (tx.to) is effectively a “beneficiary”
      const toHash = tx.to?.hash || "ContractCreation";
      beneficiariesMap[toHash] = (beneficiariesMap[toHash] || 0) + valueAMB;
    }
  });

  // 5a. Update Income & Expenditure
  document.getElementById('ttcAmb').textContent = totalCredited.toFixed(2);
  document.getElementById('ttdAmb').textContent = totalDebited.toFixed(2);
  document.getElementById('tcc').textContent = creditCount;
  document.getElementById('tcd').textContent = debitCount;

  // 5b. Sort & display Top Beneficiaries (addresses you sent to)
  const topBeneficiaries = Object.entries(beneficiariesMap)
    .sort((a, b) => b[1] - a[1]) // descending by total
    .slice(0, 5);

  // 5c. Sort & display Top Benefactors (addresses that sent to you)
  const topBenefactors = Object.entries(benefactorsMap)
    .sort((a, b) => b[1] - a[1]) // descending
    .slice(0, 5);

  // Update the DOM for top beneficiaries
  const beneContainer = document.querySelector('.bene-data');
  beneContainer.innerHTML = topBeneficiaries
    .map(
      ([address, amt]) =>
        `<p class="fs-6 ms-4 fw-medium top-beneficiaries">
           ${truncateHash(address, 6, 4)} - ${amt.toFixed(2)} AMB
         </p>`
    )
    .join('');

  // Update the DOM for top benefactors
  const benefactorsContainer = document.querySelector('.bene-data + .bene-data'); 
  // ^ If you have two ".bene-data" containers, ensure you're selecting the right element 
  //   or give them unique IDs. Adjust as needed.

  benefactorsContainer.innerHTML = topBenefactors
    .map(
      ([address, amt]) =>
        `<p class="fs-6 ms-4 fw-medium top-benefactors">
           ${truncateHash(address, 6, 4)} - ${amt.toFixed(2)} AMB
         </p>`
    )
    .join('');
}

// ============================
// 6. EXAMPLE USAGE / EXPORTS
// ============================

// Replace `0x8861186D9...F105` with the connected wallet address in your code:
const walletAddress = '0x8861186D9513cFD5d1bEb199355448Ce5E96F105';

initializeTable(walletAddress);

export {
  fetchTransactions,
  initializeTable,
  updateOtherSections
};
