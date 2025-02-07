// tables.js
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.7.0/dist/ethers.min.js";

// ----------------------------
// Global Variables & Configs
// ----------------------------
let walletAddress = null;
let chartInstance = null;
let balancePoll = null;
let transactionsPoll = null;

const TOKEN_CONFIG = {
  AMB: {
    type: 'native',
    priceFeed: 'https://api.coingecko.com/api/v3/simple/price?ids=amber&vs_currencies=usd'
  },
  ASTRA: {
    type: 'erc20',
    address: "0x5cecbde7811ac0ed86be11827ae622b89bc429df",
    priceFeed: 'https://api.coingecko.com/api/v3/simple/price?ids=astra-2&vs_currencies=usd'
  },
  HBR: {
    type: 'erc20',
    address: "0xd09270e917024e75086e27854740871f1c8e0e10",
    priceFeed: 'https://api.coingecko.com/api/v3/simple/price?ids=harbor-4&vs_currencies=usd'
  },
  USDC: {
    type: 'erc20',
    address: "0xff9f502976e7bd2b4901ad7dd1131bb81e5567de",
    priceFeed: 'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd'
  }
};

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

// ----------------------------
// Utility Functions
// ----------------------------

// Format numbers with exactly two decimals
function truncateStringToTwoDecimals(str) {
  return Number(str).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

const provider = new ethers.JsonRpcProvider('https://network.ambrosus.io/');

// ----------------------------
// Price Caching with localStorage
// ----------------------------

/**
 * Fetch the price for a token.
 * - First checks localStorage for a cached price object (with a 5‑minute TTL).
 * - If the cache is stale or missing, fetch fresh prices from the backend.
 */
async function fetchTokenPrice(tokenKey) {
  try {
    const tokenId = TOKEN_CONFIG[tokenKey].priceFeed.split('ids=')[1].split('&')[0];
    const now = Date.now();
    const cached = localStorage.getItem('priceCache');
    let cacheData = cached ? JSON.parse(cached) : null;

    // If cache exists and is fresh (5 minutes = 300,000 ms), use it.
    if (cacheData && (now - cacheData.timestamp < 300000)) {
      return cacheData.data[tokenId]?.usd || 0;
    }

    // Otherwise, fetch fresh prices from your backend
    const backendUrl = 'http://localhost:3000/api/prices';
    const response = await fetch(backendUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();

    if (!data.success) {
      throw new Error('Failed to fetch data from backend');
    }

    // Save new price data along with the current timestamp in localStorage
    localStorage.setItem('priceCache', JSON.stringify({
      data: data.data,
      timestamp: now
    }));

    return data.data[tokenId]?.usd || 0;
  } catch (error) {
    console.error(`Price fetch failed for ${tokenKey}:`, error);
    return 0;
  }
}

// ----------------------------
// Token Data Fetching Functions
// ----------------------------

async function fetchTokenData(tokenKey) {
  try {
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return { balance: "0", usdValue: 0 };
    }

    const config = TOKEN_CONFIG[tokenKey];
    let balance, usdValue;

    if (config.type === 'native') {
      const rawBalance = await provider.getBalance(walletAddress);
      balance = ethers.formatEther(rawBalance);
    } else {
      const contract = new ethers.Contract(config.address, ERC20_ABI, provider);
      const [rawBalance, decimals] = await Promise.all([
        contract.balanceOf(walletAddress),
        contract.decimals().catch(() => 18)
      ]);
      balance = ethers.formatUnits(rawBalance, decimals);
    }

    // Calculate USD value using the (cached or freshly fetched) price
    const price = await fetchTokenPrice(tokenKey);
    usdValue = Number(balance) * Number(price);

    return {
      balance: truncateStringToTwoDecimals(balance),
      usdValue: usdValue
    };
  } catch (error) {
    console.error(`Data fetch failed for ${tokenKey}:`, error);
    return { balance: "0", usdValue: 0 };
  }
}

async function fetchPortfolioData() {
  setLoadingState(true);
  const dataPromises = Object.keys(TOKEN_CONFIG).map(tokenKey => fetchTokenData(tokenKey));
  const results = await Promise.all(dataPromises);
  setLoadingState(false);

  return {
    balances: {
      amb: results[0].balance,
      ast: results[1].balance,
      hbr: results[2].balance,
      usdc: results[3].balance
    },
    usdValues: {
      amb: results[0].usdValue,
      ast: results[1].usdValue,
      hbr: results[2].usdValue,
      usdc: results[3].usdValue
    }
  };
}

// ----------------------------
// Chart Update
// ----------------------------

function updatePieChart(usdValues) {
  const options = {
    series: Object.values(usdValues),
    chart: { type: 'pie', width: 380 },
    labels: Object.keys(usdValues).map(t => `${t.toUpperCase()} ($${usdValues[t].toFixed(2)})`),
    tooltip: {
      y: {
        formatter: (value) => value.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD'
        })
      }
    },
    responsive: [{
      breakpoint: 480,
      options: { chart: { width: 200 } }
    }]
  };

  if (chartInstance) {
    chartInstance.destroy();
  }
  chartInstance = new ApexCharts(document.querySelector("#idChartPie"), options);
  chartInstance.render();
}

// ----------------------------
// Transactions Polling (Every 10 Seconds)
// ----------------------------

/**
 * Fetch wallet transactions from the backend.
 * The backend endpoint expects a query parameter "address" and returns paginated results.
 */
async function fetchWalletTransactions() {
  if (!walletAddress) return;
  try {
    const txUrl = `http://localhost:3000/api/transactions?address=${walletAddress}`;
    const response = await fetch(txUrl);
    const data = await response.json();
    if (!data.success) {
      throw new Error('Failed to fetch transactions');
    }
    updateTransactionsUI(data.data);
  } catch (error) {
    console.error('Transaction fetch error:', error);
  }
}

/**
 * Update the transactions UI.
 * This example assumes you have a list element with the ID "transactionsList" in your HTML.
 */
function updateTransactionsUI(transactions) {
  const txListElem = document.getElementById('transactionsList');
  if (!txListElem) return;
  txListElem.innerHTML = ''; // Clear previous transactions

  if (transactions.length === 0) {
    txListElem.innerHTML = '<li>No transactions found.</li>';
    return;
  }

  transactions.forEach(tx => {
    const li = document.createElement('li');
    // Customize the displayed fields as needed.
    li.textContent = `Hash: ${tx.hash} | From: ${tx.from} | To: ${tx.to} | Value: ${tx.value}`;
    txListElem.appendChild(li);
  });
}

// ----------------------------
// Wallet Connection & UI Updates
// ----------------------------

async function handleWalletConnection() {
  const connectButton = document.getElementById('connectWallet');
  const walletDisplay = document.getElementById('walletDisplay');

  if (!walletAddress) {
    // Connect wallet branch
    if (!window.ethereum) return alert("Install MetaMask!");

    try {
      const walletProvider = new ethers.BrowserProvider(window.ethereum);
      [walletAddress] = await walletProvider.send("eth_requestAccounts", []);

      // Persist the connection in localStorage
      localStorage.setItem('walletAddress', walletAddress);
      walletDisplay.textContent = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
      connectButton.textContent = "Disconnect";

      // (Optional) Uncomment the next line to use a hard-coded address for testing
      // walletAddress = "0x8861186D9513cFD5d1bEb199355448Ce5E96F105";

      // Initial data load
      const portfolioData = await fetchPortfolioData();
      updateUI(portfolioData);

      // Fetch transactions immediately, then start polling every 10 seconds
      fetchWalletTransactions();
      transactionsPoll = setInterval(fetchWalletTransactions, 10000);

      // Start polling portfolio data every 30 seconds
      balancePoll = setInterval(async () => {
        const freshData = await fetchPortfolioData();
        updateUI(freshData);
      }, 30000);
    } catch (error) {
      console.error("Connection error:", error);
      walletAddress = null;
    }
  } else {
    // Disconnect branch: clear all data and stop polling
    walletAddress = null;
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('priceCache'); // Clear cached prices
    connectButton.textContent = "Connect Wallet";
    walletDisplay.textContent = "";
    clearUIData();

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    if (balancePoll) {
      clearInterval(balancePoll);
      balancePoll = null;
    }
    if (transactionsPoll) {
      clearInterval(transactionsPoll);
      transactionsPoll = null;
    }
  }
}

function updateUI(data) {
  try {
    document.getElementById('netWalletBalance').textContent = data.balances.amb;
    document.getElementById('tbAst').textContent = data.balances.ast;
    document.getElementById('tbHbr').textContent = data.balances.hbr;
    document.getElementById('tbUsdc').textContent = data.balances.usdc;

    try {
      updatePieChart(data.usdValues);
    } catch (error) {
      console.error('Chart update failed:', error);
    }
  } catch (error) {
    console.error('UI update failed:', error);
  }
}

function clearUIData() {
  try {
    document.getElementById('netWalletBalance').textContent = '';
    document.getElementById('tbAst').textContent = '';
    document.getElementById('tbHbr').textContent = '';
    document.getElementById('tbUsdc').textContent = '';
    const txListElem = document.getElementById('transactionsList');
    if (txListElem) {
      txListElem.innerHTML = '';
    }
  } catch (error) {
    console.error('Error clearing UI data:', error);
  }
}

function setLoadingState(isLoading) {
  const loadingIndicator = document.getElementById('loadingIndicator');
  if (loadingIndicator) {
    loadingIndicator.textContent = isLoading ? 'Loading...' : '';
  }
}

// ----------------------------
// Event Listeners & Initialization
// ----------------------------

document.getElementById('connectWallet').addEventListener('click', handleWalletConnection);

window.addEventListener('load', async () => {
  const savedAddress = localStorage.getItem('walletAddress');
  if (savedAddress) {
    walletAddress = savedAddress;
    const balances = await fetchPortfolioData();
    updateUI(balances);
    document.getElementById('walletDisplay').textContent =
      `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    document.getElementById('connectWallet').textContent = "Disconnect";

    // Start polling for portfolio data and transactions
    balancePoll = setInterval(async () => {
      const balances = await fetchPortfolioData();
      updateUI(balances);
    }, 30000);
    transactionsPoll = setInterval(fetchWalletTransactions, 10000);
  }
});

window.addEventListener('beforeunload', () => {
  if (balancePoll) clearInterval(balancePoll);
  if (transactionsPoll) clearInterval(transactionsPoll);
  if (chartInstance) {
    chartInstance.destroy();
  }
});
