import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.7.0/dist/ethers.min.js";

// Price caching for API requests
const priceCache = {
    data: null,
    timestamp: 0,
    ttl: 300000 // 5 minutes
};

let walletAddress = null;
let chartInstance = null;

// Configure token types
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

// Balance formatter
function truncateStringToTwoDecimals(str) {
    return Number(str).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

const provider = new ethers.JsonRpcProvider('https://network.ambrosus.io/');

// Fetch token price with caching
async function fetchTokenPrice(tokenKey) {
    try {
        // Return cached data if still valid
        if (Date.now() - priceCache.timestamp < priceCache.ttl && priceCache.data) {
            return priceCache.data[TOKEN_CONFIG[tokenKey].priceFeed.split('ids=')[1].split('&')[0]]?.usd || 0;
        }

        // Use your backend proxy
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

        // Update cache
        priceCache.data = data.data; // Store the parsed data
        priceCache.timestamp = Date.now();

        return data.data[TOKEN_CONFIG[tokenKey].priceFeed.split('ids=')[1].split('&')[0]]?.usd || 0;
    } catch (error) {
        console.error(`Price fetch failed for ${tokenKey}:`, error);
        return 0;
    }
}

// Fetch token data (balance and USD value)
async function fetchTokenData(tokenKey) {
    try {
        if (!walletAddress || !ethers.isAddress(walletAddress)) {
            return { balance: "0", usdValue: 0 };
        }

        const config = TOKEN_CONFIG[tokenKey]; // Get token config
        let balance, usdValue;

        // Get raw balance
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

        // Get USD value for chart only
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

// Fetch portfolio data (all tokens)
async function fetchPortfolioData() {
    setLoadingState(true); // Start loading
    const dataPromises = Object.keys(TOKEN_CONFIG).map(tokenKey =>
        fetchTokenData(tokenKey)
    );
    const results = await Promise.all(dataPromises);
    setLoadingState(false); // End loading

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

// Update pie chart with USD values
function updatePieChart(usdValues) {
    const options = {
        series: Object.values(usdValues),
        chart: { type: 'pie', width: 380 },
        labels: Object.keys(usdValues).map(t => `${t.toUpperCase()} ($${usdValues[t].toFixed(2)})`), // Include USD value
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

// Handle wallet connection
async function handleWalletConnection() {
    const connectButton = document.getElementById('connectWallet');
    const walletDisplay = document.getElementById('walletDisplay');

    if (!walletAddress) {
        if (!window.ethereum) return alert("Install MetaMask!");

        try {
            const walletProvider = new ethers.BrowserProvider(window.ethereum);
            [walletAddress] = await walletProvider.send("eth_requestAccounts", []);

            // Persist connection
            localStorage.setItem('walletAddress', walletAddress);
            walletDisplay.textContent = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
            connectButton.textContent = "Disconnect";

            walletAddress = "0x8861186D9513cFD5d1bEb199355448Ce5E96F105"

            // Initial data load
            const portfolioData = await fetchPortfolioData();
            updateUI(portfolioData);

            // Set up periodic refresh
            setInterval(async () => {
                const freshData = await fetchPortfolioData();
                updateUI(freshData);
            }, 30000);
        } catch (error) {
            console.error("Connection error:", error);
            walletAddress = null;
        }
    } else {
        // Disconnect logic
        walletAddress = null;
        localStorage.removeItem('walletAddress');
        connectButton.textContent = "Connect Wallet";
        walletDisplay.textContent = "";
        if (chartInstance) chartInstance.destroy();
    }
}

// Update UI with portfolio data
function updateUI(data) {
    try {
        document.getElementById('netWalletBalance').textContent = data.balances.amb;
        document.getElementById('tbAst').textContent = data.balances.ast;
        document.getElementById('tbHbr').textContent = data.balances.hbr;
        document.getElementById('tbUsdc').textContent = data.balances.usdc;

        // Wrap chart update in try/catch
        try {
            updatePieChart(data.usdValues);
        } catch (error) {
            console.error('Chart update failed:', error);
        }
    } catch (error) {
        console.error('UI update failed:', error);
    }
}

// Set loading state
function setLoadingState(isLoading) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.textContent = isLoading ? 'Loading...' : '';
    }
}

// Event listeners
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

        // Start polling
        balancePoll = setInterval(async () => {
            const balances = await fetchPortfolioData();
            updateUI(balances);
        }, 60000);
    }
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    clearInterval(balancePoll);
    if (chartInstance) chartInstance.destroy();
});