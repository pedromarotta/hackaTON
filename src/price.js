// src/price.js
const axios = require('axios');

let cachedPrice = null;
let lastFetched = 0;
const TTL_MS    = 60_000;

async function fetchFromCoinGecko() {
  const { data } = await axios.get(
    'https://api.coingecko.com/api/v3/simple/price',
    { params: { ids: 'toncoin', vs_currencies: 'ars' } }
  );
  return data.toncoin.ars;
}

async function fetchFromFallback() {
  // 1) TON→USD
  const { data: cg } = await axios.get(
    'https://api.coingecko.com/api/v3/simple/price',
    { params: { ids: 'toncoin', vs_currencies: 'usd' } }
  );
  // 2) USD→ARS
  const { data: fx } = await axios.get(
    'https://api.exchangerate.host/latest',
    { params: { base: 'USD', symbols: 'ARS' } }
  );
  return cg.toncoin.usd * fx.rates.ARS;
}

async function getTonPriceARS() {
  const now = Date.now();
  if (cachedPrice && now - lastFetched < TTL_MS) {
    return cachedPrice;
  }

  try {
    const price = await fetchFromCoinGecko();
    cachedPrice  = price;
    lastFetched  = now;
    return price;
  } catch (err) {
    console.warn('⚠️ CoinGecko failed, falling back:', err.message);
    try {
      const price = await fetchFromFallback();
      cachedPrice = price;
      lastFetched = now;
      return price;
    } catch (err2) {
      console.warn('⚠️ Fallback failed:', err2.message);
      if (cachedPrice != null) {
        return cachedPrice;
      }
      throw new Error('All price sources failed');
    }
  }
}

module.exports = { getTonPriceARS };
