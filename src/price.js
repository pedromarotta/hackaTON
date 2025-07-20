// src/price.js
const axios = require('axios');

let cachedPrice = null;
let lastFetched = 0;
const TTL_MS    = 60_000;  // 1 minute cache

// 1) Get TON→USD from Binance
async function fetchTonUsd() {
  const { data } = await axios.get(
    'https://api.binance.com/api/v3/ticker/price',
    { params: { symbol: 'TONUSDT' } }
  );
  const p = parseFloat(data.price);
  if (isNaN(p)) throw new Error('Unexpected Binance response');
  return p;
}

// 2) Get USD→ARS from exchangerate‑api.com
async function fetchUsdArs() {
  const { data } = await axios.get(
    'https://api.exchangerate-api.com/v4/latest/USD'
  );
  const r = data.rates?.ARS;
  if (typeof r !== 'number') throw new Error('Unexpected FX response');
  return r;
}

// 3) Cached getter with fallback & stale‑cache rescue
async function getTonPriceARS() {
  const now = Date.now();
  if (cachedPrice !== null && now - lastFetched < TTL_MS) {
    return cachedPrice;
  }

  try {
    const usd  = await fetchTonUsd();
    const fx   = await fetchUsdArs();
    const ars  = usd * fx;
    cachedPrice = ars;
    lastFetched = now;
    return ars;
  } catch (err) {
    console.warn('⚠️ Price lookup failed:', err.message);
    if (cachedPrice !== null) {
      console.warn('ℹ️ Serving stale cached price:', cachedPrice);
      return cachedPrice;
    }
    throw new Error('All price sources failed');
  }
}

module.exports = { getTonPriceARS };
