// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Endpoint to fetch token prices from CoinGecko
app.get('/api/prices', async (req, res) => {
    try {
        const apiUrl = 'https://api.coingecko.com/api/v3/simple/price';
        const tokenIds = 'amber,astra-2,harbor-4,usd-coin';
        const vsCurrencies = 'usd';

        const response = await axios.get(apiUrl, {
            params: {
                ids: tokenIds,
                vs_currencies: vsCurrencies
            }
        });

        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error('Error fetching data from CoinGecko:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch data from CoinGecko', error: error.message });
    }
});

// Endpoint to fetch all transactions with pagination from Blockscout
app.get('/api/transactions', async (req, res) => {
    try {
        const walletAddress = req.query.address;
        if (!walletAddress) {
            return res.status(400).json({ success: false, message: 'Wallet address is required' });
        }

        let transactions = [];
        let nextPageUrl = `https://blockscout-explorer.airdao.io/api/v2/addresses/${walletAddress}/transactions?filter=to%20%7C%20from`;

        while (nextPageUrl) {
            const response = await axios.get(nextPageUrl);
            const data = response.data;
            
            if (data.items) {
                transactions = transactions.concat(data.items);
            }

            if (data.next_page_params) {
                const { block_number, index, items_count } = data.next_page_params;
                nextPageUrl = `https://blockscout-explorer.airdao.io/api/v2/addresses/${walletAddress}/transactions?filter=to%20%7C%20from&block_number=${block_number}&index=${index}&items_count=${items_count}`;
            } else {
                nextPageUrl = null;
            }
        }

        res.json({ success: true, data: transactions });
    } catch (error) {
        console.error('Error fetching transactions:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch transactions', error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
