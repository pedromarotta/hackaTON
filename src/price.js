// src/price.js
console.log('💲 [price.js] loaded — using CoinGecko ARS only');
const axios = require('axios');

let cachedPrice = null;
let lastFetched = 0;
const TTL_MS    = 60_000;  // 1 minute cache

// Fetch TON→ARS directly from CoinGecko
async function fetchTonArs() {
  console.log('🔄 fetchTonArs(): calling CoinGecko (the-open-network→ARS)');
  const { data } = await axios.get(
    'https://api.coingecko.com/api/v3/simple/price',
    { params: { ids: 'the-open-network', vs_currencies: 'ars' } }
  );
  console.log('   CoinGecko response:', data);
  const price = data['the-open-network']?.ars;
  if (typeof price !== 'number') {
    throw new Error('Invalid ARS price from CoinGecko');
  }
  return price;
}

// Cached getter
async function getTonPriceARS() {
  const now = Date.now();
  if (cachedPrice !== null && now - lastFetched < TTL_MS) {
    console.log('ℹ️ Returning cached price:', cachedPrice);
    return cachedPrice;
  }

  try {
    const price = await fetchTonArs();
    console.log(`✅ Fetched ARS price: 1 TON = ${price} ARS`);
    cachedPrice = price;
    lastFetched = now;
    return price;
  } catch (err) {
    console.warn('⚠️ getTonPriceARS error:', err.message);
    if (cachedPrice !== null) {
      console.warn('ℹ️ Falling back to stale cache:', cachedPrice);
      return cachedPrice;
    }
    throw new Error('All price sources failed');
  }
}

module.exports = { getTonPriceARS };
