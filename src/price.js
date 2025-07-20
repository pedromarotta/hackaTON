// src/price.js
const axios = require('axios');

let cachedPrice = null;
let lastFetched = 0;
const TTL_MS    = 60_000;  // 1 minute

// 1) Try CoinGecko ARS directly for TON
async function fetchFromCoinGecko() {
  const { data } = await axios.get(
    'https://api.coingecko.com/api/v3/simple/price',
    { params: { ids: 'ton', vs_currencies: 'ars' } }
  );
  if (!data || !data.ton || typeof data.ton.ars !== 'number') {
    throw new Error('Unexpected CoinGecko response');
  }
  return data.ton.ars;
}

// 2) Fallback: TON→USD then USD→ARS
async function fetchFromFallback() {
  // TON→USD
  const { data: cg } = await axios.get(
    'https://api.coingecko.com/api/v3/simple/price',
    { params: { ids: 'ton', vs_currencies: 'usd' } }
  );
  if (!cg || !cg.ton || typeof cg.ton.usd !== 'number') {
    throw new Error('Unexpected CoinGecko USD response');
  }

  // USD→ARS
  const { data: fx } = await axios.get(
    'https://api.exchangerate.host/latest',
    { params: { base: 'USD', symbols: 'ARS' } }
  );
  if (!fx || !fx.rates || typeof fx.rates.ARS !== 'number') {
    throw new Error('Unexpected FX response');
  }

  return cg.ton.usd * fx.rates.ARS;
}

// 3) Cached “get” with TTL, fallback, and stale‑cache rescue
async function getTonPriceARS() {
  const now = Date.now();
  if (cachedPrice !== null && now - lastFetched < TTL_MS) {
    return cachedPrice;
  }

  // try primary
  try {
    const price = await fetchFromCoinGecko();
    cachedPrice = price;
    lastFetched = now;
    return price;
  } catch (err) {
    console.warn('⚠️ CoinGecko ARS lookup failed:', err.message);
  }

  // try fallback
  try {
    const price = await fetchFromFallback();
    cachedPrice = price;
    lastFetched = now;
    return price;
  } catch (err) {
    console.warn('⚠️ Fallback USD→ARS failed:', err.message);
  }

  // rescue with stale cache
  if (cachedPrice !== null) {
    console.warn('ℹ️ Serving last cached price:', cachedPrice);
    return cachedPrice;
  }

  throw new Error('All price sources failed');
}

module.exports = { getTonPriceARS };
