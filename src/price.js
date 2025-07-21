// src/price.js
const axios = require('axios');

let cachedPrice = null;
let lastFetched = 0;
const TTL_MS    = 60_000;  // cache for 1 minute

// 1) TON→USD via Binance
async function fetchTonUsd() {
  console.log('🔄 fetchTonUsd(): calling Binance TONUSDT');
  const { data } = await axios.get(
    'https://api.binance.com/api/v3/ticker/price',
    { params: { symbol: 'TONUSDT' } }
  );
  console.log('   Binance response:', data);
  const p = parseFloat(data.price);
  if (isNaN(p)) throw new Error('Unexpected Binance response');
  return p;
}

// 2) USD→ARS via exchangerate‑api.com v4 (no key needed)
async function fetchUsdArs() {
  console.log('🔄 fetchUsdArs(): calling exchangerate‑api.com');
  const { data } = await axios.get(
    'https://api.exchangerate-api.com/v4/latest/USD'
  );
  console.log('   FX response:', data);
  const r = data.rates?.ARS;
  if (typeof r !== 'number') throw new Error('Unexpected FX response');
  return r;
}

// 3) Cached getter with fallback + stale‐cache rescue
async function getTonPriceARS() {
  const now = Date.now();
  if (cachedPrice !== null && now - lastFetched < TTL_MS) {
    console.log('ℹ️ Returning cached price:', cachedPrice);
    return cachedPrice;
  }

  try {
    const usd = await fetchTonUsd();
    const fx  = await fetchUsdArs();
    const ars = usd * fx;
    console.log(`✅ Computed ARS price: ${usd} USD × ${fx} ARS/USD = ${ars} ARS`);
    cachedPrice = ars;
    lastFetched = now;
    return ars;
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
