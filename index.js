// index.js
console.log('🚨 HOT CODE RELOAD — this is running YOUR index.js');
require('dotenv').config();
console.log('🔐 MP_WEBHOOK_SECRET is set:', typeof process.env.MP_WEBHOOK_SECRET === 'string');

const express                 = require('express');
const bodyParser              = require('body-parser');
const axios                   = require('axios');
const { TonClient, WalletContractV4, internal, toNano } = require('@ton/ton');
const { mnemonicToPrivateKey } = require('@ton/crypto');

//
// –––––– TON SETUP ––––––
const client = new TonClient({
  endpoint: process.env.TONCENTER_RPC,
  apiKey:    process.env.TONCENTER_API_KEY
});

let keyPair;
(async () => {
  const words = process.env.MNEMONIC.trim().split(/\s+/);
  keyPair = await mnemonicToPrivateKey(words);
  console.log('🔑 TON keyPair loaded');
})();

//
// –––––– EXPRESS SETUP ––––––
const app  = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

//
// –––––– CREATE MERCADO PAGO CHECKOUT ––––––
app.post('/create-payment', async (req, res) => {
  console.log('🔥 create-payment called');
  const { amount, description } = req.body;

  try {
    const mpRes = await axios.post(
      'https://api.mercadopago.com/checkout/preferences',
      {
        items: [{
          title:       description || 'TON Deposit',
          quantity:    1,
          currency_id: 'ARS',
          unit_price:  amount || 1000
        }],
        back_urls: {
          success: `${process.env.BASE_URL}/success`,
          failure: `${process.env.BASE_URL}/failure`,
          pending: `${process.env.BASE_URL}/pending`
        },
        auto_return: 'approved'
      },
      { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
    );

    const url = mpRes.data.init_point;
    console.log('✅ Payment link:', url);
    res.json({ url });
  } catch (err) {
    console.error('❌ MP Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create payment' });
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

    // 2) If approved, send TON
    if (payment.status === 'approved') {
      const toAddress = process.env.TEST_RECIPIENT_ADDRESS;
      console.log(`🚀 Sending 0.1 TON to ${toAddress}`);
      await sendTon(toAddress, '0.1');
    } else {
      console.log('⚠️ Payment not approved – no TON sent');
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Webhook handler error:', err.response?.data || err.message);
    res.sendStatus(500);
  }
});

//
// –––––– TON SEND FUNCTION ––––––
async function sendTon(to, amount = '0.1') {
    +  console.log('💸 sendTon() args →', { to, amount });
       const wallet   = WalletContractV4.create({
         workchain: 0,
         publicKey: keyPair.publicKey
       });
       const contract = client.open(wallet);
    
       const { seqno } = await contract.getSeqno();
    +  const nanotons = toNano(amount);   // amount is guaranteed by the default param
       const transfer = await contract.sendTransfer({
         secretKey: keyPair.secretKey,
         messages: [ internal({
           to,
           value: nanotons,
           body: ''
         })],
         seqno,
         sendMode: 3
       });
    
       const result = await client.sendBoc(transfer.boc);
       console.log('✅ TON transfer sent, tx_id:', result.transaction_id);
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
