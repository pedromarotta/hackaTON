// src/server.js
console.log('💲 [price.js] module loaded');
console.log('🟢 [server.js] loaded and executing – expect this at startup');
require('dotenv').config();

console.log('🚨 HOT CODE RELOAD — this is running YOUR index.js');
require('dotenv').config();
console.log('🔐 MP_WEBHOOK_SECRET is set:', typeof process.env.MP_WEBHOOK_SECRET === 'string');
// Add these debug lines:
console.log('🔍 Raw TONCENTER_RPC:', JSON.stringify(process.env.TONCENTER_RPC));
console.log('🔍 TONCENTER_RPC type:', typeof process.env.TONCENTER_RPC);
console.log('🔍 TONCENTER_RPC length:', process.env.TONCENTER_RPC?.length);
console.log('🔍 All env keys:', Object.keys(process.env).filter(k => k.includes('TONCENTER')));
console.log('🔗 Using hardcoded TonCenter endpoint');

const express                 = require('express');
const bodyParser              = require('body-parser');
const axios                   = require('axios');
const { TonClient, WalletContractV5R1, internal } = require('@ton/ton');
const { toNano }                             = require('@ton/core');
console.log('🔧 toNano is:', typeof toNano);
const { mnemonicToPrivateKey }        = require('@ton/crypto');

//
// –––––– TON SETUP ––––––
// Hardcoded fix with TonCenter endpoint
const client = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: '100a0f00e722eb48fa6e0349e8bc672f4c62be96b344dc6a3cf5295995a1f5f6'
  });

let keyPair;
(async () => {
  const words = process.env.MNEMONIC.trim().split(/\s+/);
  keyPair = await mnemonicToPrivateKey(words);
  console.log('🔑 TON keyPair loaded');
  
  // Add wallet address debug
  const wallet = WalletContractV5R1.create({
    workchain: 0,
    publicKey: keyPair.publicKey
  });
  console.log('📍 Using wallet address:', wallet.address.toString({ bounceable: false }));
})();

//
// –––––– EXPRESS SETUP ––––––
const app  = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use((req, res, next) => {
    console.log(`➡️ ${req.method} ${req.url}`);
    next();
  });
app.use(express.static('public'));
  
// –––––– LIVE PRICE ––––––
const { getTonPriceARS } = require('./price');

app.get('/ton-price', async (req, res) => {
    console.log('🔍 Received GET /ton-price');
    try {
      const price = await getTonPriceARS();
      console.log('✅ /ton-price →', price);
      return res.json({ price });
    } catch (err) {
      console.error('🔴 /ton-price error:', err.message);
      return res
        .status(500)
        .json({ error: err.message });
    }
  });
  


// –––––– CREATE MERCADO PAGO CHECKOUT ––––––
app.post('/create-payment', async (req, res) => {
    console.log('🔥 create-payment called');
    const { amount, description, wallet, ton_amount } = req.body || {};
    if (typeof ton_amount !== 'string' || isNaN(Number(ton_amount)) || Number(ton_amount) <= 0) {
        return res.status(400).json({ error: 'Invalid or missing TON amount' });
    }

  
    // 1) Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid or missing amount' });
    }
  
    // 2) Determine recipient address (dynamic or fallback)
    const toAddress = wallet || process.env.TEST_RECIPIENT_ADDRESS;
    if (!toAddress) {
      return res.status(400).json({ error: 'Missing recipient wallet address' });
    }
  
    try {
      // 3) Create MP preference
      const mpRes = await axios.post(
        'https://api.mercadopago.com/checkout/preferences',
        {
          items: [{
            title:       description || 'TON Deposit',
            quantity:    1,
            currency_id: 'ARS',
            unit_price:  amount
          }],
          metadata: {
            to_address: toAddress,
            paid_ars:   amount,
            ton_amount
          },
          back_urls: {
            success: `${process.env.BASE_URL}/success`,
            failure: `${process.env.BASE_URL}/failure`,
            pending: `${process.env.BASE_URL}/pending`
          }
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`
          }
        }
      );
  
      // 4) Return the checkout link
      const url = mpRes.data.init_point;
      console.log('✅ Payment link:', url);
      return res.json({ url });
  
    } catch (err) {
      // 5) Log and surface the real error
      console.error('❌ MP Error:', {
        status: err.response?.status,
        data:   err.response?.data,
        msg:    err.message
      });
      return res
        .status(err.response?.status || 500)
        .json(err.response?.data || { error: err.message });
    }
  });
  
  

//
// –––––– HANDLE WEBHOOK ––––––
app.post('/webhook', async (req, res) => {
  console.log('🔔 Webhook received:', JSON.stringify(req.body, null, 2));

  const paymentId = req.body.data?.id || req.body.id;
  if (!paymentId) return res.sendStatus(400);

  try {
    // 1) Verify payment status directly via MP API
    const { data: payment } = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
    );
    console.log('📄 Payment status:', payment.status);
    const toAddress = payment.metadata?.to_address;
    const paidARS   = payment.metadata?.paid_ars;
    const tonAmount = payment.metadata?.ton_amount;

    if (!toAddress || paidARS == null || !tonAmount) {
        console.error('❌ Missing toAddress or paidARS in metadata:', payment.metadata);
        return res.sendStatus(400);
    }

    // 2) If approved, send TON
    if (payment.status === 'approved') {
        console.log(`🚀 Sending ${tonAmount} TON to ${toAddress} (paid ${paidARS} ARS)`);
        await sendTon(toAddress, tonAmount);
    } else {
      console.log('⚠️ Payment not approved – no TON sent');
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Webhook handler error:', err.response?.data || err.message);
    res.sendStatus(500);
  }
});

// –––––– TON SEND FUNCTION ––––––
async function sendTon(to, amount) {
    console.log('💸 sendTon() args →', { to, amount });
  
    if (!to || typeof to !== 'string') {
      throw new Error('Invalid or missing "to" address');
    }
  
    const amountStr = amount || '0.1';
    if (isNaN(Number(amountStr))) {
      throw new Error(`Invalid amount: ${amountStr}`);
    }
  
    const wallet = WalletContractV5R1.create({
      workchain: 0,
      publicKey: keyPair.publicKey
    });
    const contract = client.open(wallet);
  
    // Add debugging
    console.log('🔗 Client endpoint:', client.endpoint);
    const balance = await contract.getBalance();
    console.log('💰 Wallet balance:', balance.toString());
    
    const seqno = await contract.getSeqno();
    console.log('🔢 Seqno result:', seqno);
    console.log('🔢 Seqno type:', typeof seqno);
    
    if (seqno === undefined || seqno === null) {
      throw new Error('Wallet is not deployed yet - seqno is undefined');
    }
    
    const nanotons = toNano(amountStr);
  
    await contract.sendTransfer({
        secretKey: keyPair.secretKey,
        messages: [
          internal({
            to,
            value: nanotons,
            body: ''
          })
        ],
        seqno,
        sendMode: 3
      });
    
      console.log('✅ TON transfer sent');
}

//
// –––––– CONFIRMATION PAGES ––––––
app.get('/success', (req, res) =>
  res.send('<h1>🎉 Payment succeeded!</h1><p>Your TON is on the way.</p>')
);
app.get('/failure', (req, res) =>
  res.send('<h1>❌ Payment failed.</h1><p>Please try again.</p>')
);
app.get('/pending', (req, res) =>
  res.send('<h1>⏳ Payment pending.</h1><p>Check back soon.</p>')
);

//
// –––––– START SERVER ––––––
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});