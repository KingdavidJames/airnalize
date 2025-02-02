import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.7.0/dist/ethers.min.js";

let walletAddress = null; // To store the connected wallet address
let chartInstance = null; // To store the ApexCharts instance

const TOKEN_ADDRESSES = {
    AMB: "0xf4fb9bf10e489ea3edb03e094939341399587b0c", 
    ASTRA: "0x5cecbde7811ac0ed86be11827ae622b89bc429df",
    HBR: "0xd09270e917024e75086e27854740871f1c8e0e10", 
    USDC: "0xff9f502976e7bd2b4901ad7dd1131bb81e5567de",
};

// ABI for ERC-20 tokens
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)", // Optional: Fetch decimals if needed
];

function truncateStringToTwoDecimals(str) {
    let num = parseFloat(str); // Convert string to number
    return (Math.floor(num * 100) / 100).toFixed(2);
}

async function fetchTokenBalance(tokenAddress, walletAddress) {
    try {
        const provider = new ethers.JsonRpcProvider('https://network.ambrosus.io/');
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

        // Fetch balance
        const balance = await contract.balanceOf(walletAddress);

        // Fetch decimals (if needed)
        const decimals = await contract.decimals().catch(() => 18); // Default to 18 if decimals() is not available
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error("Error fetching token balance for address:", tokenAddress, error);
        return "0"; // Return 0 if there's an error
    }
}

async function fetchTransactionCount(walletAddress) {
    const provider = new ethers.JsonRpcProvider('https://network.ambrosus.io/');
    const txCount = await provider.getTransactionCount(walletAddress);
    console.log("Transaction Count:", txCount);
}

function chartPie() {
    // Get token balances from the DOM
    const netWalletBalance = parseFloat(document.getElementById("netWalletBalance").textContent) || 0;
    const tbAst = parseFloat(document.getElementById("tbAst").textContent) || 0;
    const tbHbr = parseFloat(document.getElementById("tbHbr").textContent) || 0;
    const tbUsdc = parseFloat(document.getElementById("tbUsdc").textContent) || 0;

    // Pie chart options
    var options = {
        series: [netWalletBalance, tbAst, tbHbr, tbUsdc],
        chart: {
            width: 380,
            type: 'pie',
        },
        labels: ['$AMB', '$AST', '$HBR', '$USDC'],
        responsive: [{
            breakpoint: 480,
            options: {
                chart: {
                    width: 200
                },
                legend: {
                    position: 'bottom'
                }
            }
        }]
    };

    // If a chart instance already exists, update it
    if (chartInstance) {
        chartInstance.updateSeries([netWalletBalance, tbAst, tbHbr, tbUsdc]);
    } else {
        // Otherwise, create a new chart instance
        chartInstance = new ApexCharts(document.querySelector("#idChartPie"), options);
        chartInstance.render();
    }
}

async function connectWallet() {
    const connectButton = document.getElementById('connectWallet');
    const walletDisplay = document.getElementById('walletDisplay');

    if (window.ethereum) {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.send("eth_requestAccounts", []);
            walletAddress = accounts[0];
            console.log("Connected:", walletAddress);
 
            // Save wallet address to localStorage
            localStorage.setItem('walletAddressM', walletAddress);

            walletAddress = "0x8861186D9513cFD5d1bEb199355448Ce5E96F105"; // trying with funded wallet, remove when done
            console.log("testAddr:", walletAddress);
            
            // Display sliced wallet address
            const slicedAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
            walletDisplay.textContent = slicedAddress;

            // Change button text to "Disconnect"
            connectButton.textContent = "Disconnect";

            // Fetch and display token balances
            await updateTokenBalances();

            // Fetch transaction count
            await fetchTransactionCount(walletAddress);

            // Fetch transaction data
            const transactions = await fetchTransactions(walletAddress);

            // Update charts and table
            updateCharts(transactions);
            updateTable(transactions);
        } catch (error) {
            console.error("Error connecting wallet:", error);
        }
    } else {
        alert("Please install MetaMask!");
    }
}

async function updateTokenBalances() {
    if (walletAddress) {
        const ambBalance = await fetchTokenBalance(TOKEN_ADDRESSES.AMB, walletAddress);
        const astraBalance = await fetchTokenBalance(TOKEN_ADDRESSES.ASTRA, walletAddress);
        const hbrBalance = await fetchTokenBalance(TOKEN_ADDRESSES.HBR, walletAddress);
        const usdcBalance = await fetchTokenBalance(TOKEN_ADDRESSES.USDC, walletAddress);

        // Update DOM with truncated balances
        document.getElementById('netWalletBalance').textContent = truncateStringToTwoDecimals(ambBalance);
        document.getElementById('tbAst').textContent = truncateStringToTwoDecimals(astraBalance);
        document.getElementById('tbHbr').textContent = truncateStringToTwoDecimals(hbrBalance);
        document.getElementById('tbUsdc').textContent = truncateStringToTwoDecimals(usdcBalance);

        // Update the pie chart
        chartPie();
    }
}

// Poll every 10 seconds (adjust as needed)
setInterval(updateTokenBalances, 10000);

document.getElementById('connectWallet').addEventListener('click', async () => {
    if (!walletAddress) {
        await connectWallet();
    } else {
        // Disconnect Wallet
        walletAddress = null; // Reset wallet address
        localStorage.removeItem('walletAddress'); // Remove saved wallet address
        document.getElementById('walletDisplay').textContent = ""; // Clear displayed address
        document.getElementById('connectWallet').textContent = "Connect Wallet"; // Reset button text
        console.log("Wallet disconnected.");
    }
});

// Restore wallet connection on page load
window.addEventListener('load', async () => {
    const savedWalletAddress = localStorage.getItem('walletAddress');
    if (savedWalletAddress) {
        walletAddress = savedWalletAddress;
        await connectWallet(); // Reconnect the wallet
    }
});

async function fetchTransactions(walletAddress) {
    // Fetch data from Ambrosus API
    const response = await fetch(`https://api.ambrosus.com/transactions?address=${walletAddress}`);
    const data = await response.json();
    return data;
}

function updateCharts(transactions) {
    // Update pie and line charts with real data
    const pieData = [/* Process transactions for pie chart */];
    const lineData = [/* Process transactions for line chart */];
    updatePieChart(pieData);
    updateLineChart(lineData);
}

function updateTable(transactions) {
    // Update GridJS table with real data
    const tableData = transactions.map(tx => [tx.block, tx.hash, tx.from, tx.to, tx.amount, tx.date]);
    grid.updateConfig({ data: tableData }).forceRender();
}