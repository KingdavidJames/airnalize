// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors'); // Enable CORS for frontend access
const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // Allow requests from your frontend
app.use(express.json()); // Parse JSON requests

// Endpoint to fetch token prices from CoinGecko
app.get('/api/prices', async (req, res) => {
    try {
        // CoinGecko API URL
        const apiUrl = 'https://api.coingecko.com/api/v3/simple/price';
        const tokenIds = 'amber,astra-2,harbor-4,usd-coin'; // Token IDs
        const vsCurrencies = 'usd'; // Currency
        //const apiKey = 'CG-aUU3nwamSNv3izAsd1MkG5tD'; // Your CoinGecko API key

        // Make the request to CoinGecko
        const response = await axios.get(apiUrl, {
            params: {
                ids: tokenIds,
                vs_currencies: vsCurrencies
                //x_cg_pro_api_key: apiKey
            }
        });

        // Parse the data
        const data = response.data;

        // Send the parsed data back to the frontend
        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Error fetching data from CoinGecko:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch data from CoinGecko',
            error: error.message
        });
    }
});

// Endpoint to fetch transactions from Blockscout
app.get('/api/transactions', async (req, res) => {
    try {
        const walletAddress = req.query.address; // Wallet address from query params
        const apiUrl = `https://blockscout-explorer.airdao.io/api/v2/addresses/${walletAddress}/transactions?filter=to%20%7C%20from`;
        const response = await axios.get(apiUrl);
        console.log('Blockscout API Response:', response.data); // Log the Blockscout API response
        res.json({
            success: true,
            data: response.data.items,
        });
        console.log('Transactions fetched successfully:', response.data.items);
    } catch (error) {
        console.error('Error fetching transactions:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transactions',
            error: error.message
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});