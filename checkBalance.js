require('dotenv').config();

const { TonClient } = require('@ton/ton');
const { WalletContractV4 } = require('@ton/ton');
const { mnemonicToPrivateKey } = require('@ton/crypto');
const { fromNano } = require('@ton/core');

(async () => {
    const client = new TonClient({
        endpoint: process.env.TONCENTER_RPC,
        apiKey: process.env.TONCENTER_API_KEY, // ✅ securely read from .env
      });
      

  const keyPair = await mnemonicToPrivateKey(process.env.MNEMONIC.trim().split(/\s+/));

  const wallet = WalletContractV4.create({
    publicKey: keyPair.publicKey,
    workchain: 0,
  });

  const contract = client.open(wallet);
  const balance = await contract.getBalance();

  console.log('💰 Wallet balance:', fromNano(balance), 'TON');
})();
