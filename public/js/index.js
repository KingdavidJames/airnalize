import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.7.0/dist/ethers.min.js";

let walletAddress = null;
let chartInstance = null;

// Configure token types
const TOKEN_CONFIG = {
    AMB: { type: 'native' },
    ASTRA: { 
        type: 'erc20',
        address: "0x5cecbde7811ac0ed86be11827ae622b89bc429df"
    },
    HBR: {
        type: 'erc20',
        address: "0xd09270e917024e75086e27854740871f1c8e0e10"
    },
    USDC: {
        type: 'erc20',
        address: "0xff9f502976e7bd2b4901ad7dd1131bb81e5567de"
    }
};

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

// balance formatter
function truncateStringToTwoDecimals(str) {
    return Number(str).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

const provider = new ethers.JsonRpcProvider('https://network.ambrosus.io/');

async function fetchTokenBalance(tokenKey) {
    try {
        const config = TOKEN_CONFIG[tokenKey];
        
        if (config.type === 'native') {
            // Fetch native AMB balance
            const balance = await provider.getBalance(walletAddress);
            return ethers.formatEther(balance);
        } else {
            // Fetch ERC-20 token balance
            const contract = new ethers.Contract(config.address, ERC20_ABI, provider);
            const [balance, decimals] = await Promise.all([
                contract.balanceOf(walletAddress),
                contract.decimals().catch(() => 18)
            ]);
            return ethers.formatUnits(balance, decimals);
        }
    } catch (error) {
        console.error(`Error fetching ${tokenKey} balance:`, error);
        return "0";
    }
}

async function fetchAllBalances() {
    const balancePromises = Object.keys(TOKEN_CONFIG).map(token => 
        fetchTokenBalance(token)
    );
    const balances = await Promise.all(balancePromises);
    
    return {
        amb: balances[0],
        ast: balances[1],
        hbr: balances[2],
        usdc: balances[3]
    };
}
//Chart handling with destroy/recreate pattern
function updatePieChart(balances) {
    const options = {
        series: [balances.amb, balances.ast, balances.hbr, balances.usdc].map(Number),
        chart: { type: 'pie', width: 380 },
        labels: ['$AMB', '$AST', '$HBR', '$USDC'],
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

//connection handler
async function handleWalletConnection() {
    const connectButton = document.getElementById('connectWallet');
    const walletDisplay = document.getElementById('walletDisplay');

    if (!walletAddress) {
        if (!window.ethereum) return alert("Install MetaMask!");
        
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            [walletAddress] = await provider.send("eth_requestAccounts", []);
            
            // Persist connection
            localStorage.setItem('walletAddress', walletAddress);
            walletDisplay.textContent = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
            connectButton.textContent = "Disconnect";

            walletAddress = "0x8861186D9513cFD5d1bEb199355448Ce5E96F105"
            // Initial data load
            const balances = await fetchAllBalances();
            updateUI(balances);
            
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

// 6. Central UI updater
function updateUI(balances) {
    document.getElementById('netWalletBalance').textContent = truncateStringToTwoDecimals(balances.amb);
    document.getElementById('tbAst').textContent = truncateStringToTwoDecimals(balances.ast);
    document.getElementById('tbHbr').textContent = truncateStringToTwoDecimals(balances.hbr);
    document.getElementById('tbUsdc').textContent = truncateStringToTwoDecimals(balances.usdc);
    updatePieChart(balances);
}

// 7. Optimized polling with cleanup
let balancePoll;
document.getElementById('connectWallet').addEventListener('click', handleWalletConnection);

window.addEventListener('load', async () => {
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedAddress) {
        walletAddress = savedAddress;
        const balances = await fetchAllBalances();
        updateUI(balances);
        document.getElementById('walletDisplay').textContent = 
            `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
        document.getElementById('connectWallet').textContent = "Disconnect";
        
        // Start polling
        balancePoll = setInterval(async () => {
            const balances = await fetchAllBalances();
            updateUI(balances);
        }, 10000);
    }
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    clearInterval(balancePoll);
    if (chartInstance) chartInstance.destroy();
});