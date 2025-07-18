// index.js
console.log('🚨 HOT CODE RELOAD — this is running YOUR index.js');

require('dotenv').config();
const express   = require('express');
const bodyParser= require('body-parser');
const axios     = require('axios');
const { TonClient, WalletContractV4, internal, toNano } = require('@ton/ton');
const { mnemonicToPrivateKey } = require('@ton/crypto');

//
// –––––– TON SETUP ––––––
//
const client = new TonClient({
  endpoint: 'https://toncenter.com/api/v2/jsonRPC',
  apiKey: process.env.TONCENTER_API_KEY
});

// Convert your mnemonic to a key pair once at startup
let keyPair;
(async () => {
  const words = process.env.MNEMONIC.trim().split(/\s+/); // turns the 24-word string into an array
  keyPair = await mnemonicToPrivateKey(words);
  console.log('🔑 TON keyPair loaded');
})();


//
// –––––– EXPRESS SETUP ––––––
const app = express();
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
        items:[{
          title: description||'TON Deposit',
          quantity:1,
          currency_id:'ARS',
          unit_price: amount||1000
        }],
        back_urls:{
          success: `${process.env.BASE_URL}/success`,
          failure: `${process.env.BASE_URL}/failure`,
          pending: `${process.env.BASE_URL}/pending`
        },
        auto_return: 'approved'
      },
      { headers:{ Authorization:`Bearer ${process.env.MP_ACCESS_TOKEN}` } }
    );
    // use sandbox link in TEST mode
    const url = mpRes.data.init_point;
    console.log('✅ Payment link:', url);
    res.json({ url });
  } catch(err) {
    console.error('❌ MP Error:', err.response?.data||err.message);
    res.status(500).json({ error:'Failed to create payment' });
  }
});

//
const crypto = require('crypto');

app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-signature'];
  const rawBody = JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.warn('❌ Invalid webhook signature');
    return res.sendStatus(401);
  }

  console.log('✅ Verified webhook:', JSON.stringify(req.body, null, 2));

  const paymentId = req.body.data?.id || req.body.id;
  if (!paymentId) return res.sendStatus(400);

  try {
    // 1) Check payment status
    const { data: payment } = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
    );
    console.log('📄 Payment status:', payment.status);

    // 2) If approved, send TON
    if (payment.status === 'approved') {
      const toAddress = process.env.TEST_RECIPIENT_ADDRESS;
      console.log(`🚀 Sending 1 TON to ${toAddress}`);
      await sendTon(toAddress, '0.1'); // sends 1 TON
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
async function sendTon(to, amount) {
  // 1) build your wallet contract instance
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey
  });
  const contract = client.open(wallet);

  // 2) fetch seqno
  const { seqno } = await contract.getSeqno();

  // 3) send the internal message
  const transfer = await contract.sendTransfer({
    secretKey: keyPair.secretKey,
    messages: [ internal({
      to,
      value: toNano(amount),    // convert TON to nanotons
      body: ''                  // no payload
    })],
    seqno,
    sendMode: 3
  });

  // 4) broadcast BOC
  const result = await client.sendBoc(transfer.boc);
  console.log('✅ TON transfer sent, tx_id:', result.transaction_id);
}

// Serve tiny confirmation pages
app.get('/success', (req, res) => 
    res.send('<h1>🎉 Payment succeeded!</h1><p>Your TON is on the way.</p>')
  );
  app.get('/failure', (req, res) => 
    res.send('<h1>❌ Payment failed.</h1><p>Please try again.</p>')
  );
  app.get('/pending', (req, res) => 
    res.send('<h1>⏳ Payment pending.</h1><p>Check back soon.</p>')
  );
  
// –––––– START SERVER ––––––
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
