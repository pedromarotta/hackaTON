# MP-TONRamp

> **One-tap ARS → TON** gateway for Latin American merchants

## 🚀 Project Overview

MP-TONRamp lets your customers pay in Argentine pesos via Mercado Pago and receive TON (The Open Network) directly in their Telegram wallet—no P2P hassles, no KYC black holes, no pre-owned crypto needed.

Key benefits:
- **Seamless UX**: Pay with a familiar ARS debit/credit card
- **Instant settlement**: TON delivered in seconds via TON HTTP API
- **Plug & play**: Minimal on-chain logic; easy webhook integration
- **Built for growth**: Revenue-positive from day one (0.8 % spread + float yield + staking APR)

## 🧩 Features

- **Mercado Pago Webhook** listener for payment notifications  
- **Live ARS→TON price oracle** for fair conversion  
- **Backend signer** calling the TON HTTP API (or TonConnect) to transfer TON  
- Configurable **spread** and yields on idle ARS/TON balances  
- Extensible for **Jetton minting**, multi-sig custody, or on-chain escrow  

## 📦 Tech Stack

- **Runtime:** Node.js (>=16)  
- **Language:** TypeScript  
- **Framework:** Express.js  
- **Mercado Pago SDK:** `mercadopago`  
- **TON integration:** `tonweb` or direct HTTP API calls  
- **Env management:** `dotenv`  

## 🏗️ Architecture
+----------------+ Webhook +-------------+ TON API +-----------+
| Mercado Pago | ------------> | Backend | ------------> | TON Node |
| (ARS payment) | | (Express) | | |
+----------------+ +-------------+ +-----------+
│ │
│ │
└─────────── Rate Oracle (ARS→TON) ─────────────────────────────────────┘


## 🔧 Prerequisites

- Node.js ≥ v16  
- Yarn or npm  
- A TON RPC endpoint (e.g. [toncenter.com](https://toncenter.com))  
- Mercado Pago **Access Token** & **Webhook Key**  
- A custodial TON **private key** with some initial balance for gas  
- (Optional) Price Oracle URL or API key

🚧 Roadmap
 Jetton-based ARS-stablecoin with on-chain mint/burn

 Multi-sig treasury contract in Tact

 Auto-hedging module against ARS volatility

 Telegram Mini-App frontend

 CNV VASP compliance workflows

🤝 Contributing
Fork the repo

Create a feature branch (git checkout -b feature/your-feature)

Commit your changes (git commit -m "feat: add awesome feature")

Push to your branch (git push origin feature/your-feature)

Open a Pull Request

Please follow the Conventional Commits spec.

📄 License
This project is licensed under the MIT License. See LICENSE.md for details.

📬 Contact
Pedro Marotta • @pedromarotta
Project repository: https://github.com/your-org/paydex


::contentReference[oaicite:0]{index=0}

