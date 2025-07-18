require('dotenv').config();
const { TonClient } = require('@ton/ton');

const tonClient = new TonClient({
  endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
  apiKey: process.env.TONCENTER_API_KEY || undefined,
});

module.exports = tonClient;