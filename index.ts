import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
const web3 = require('@solana/web3.js');

const { autoDetectPayments } = require('./lib/payment-tracker');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = 3001;

let pendingMints: any[] = [];

setInterval(async () => {
  const connection = new web3.Connection(
    web3.clusterApiUrl('devnet')
  );

  const payments = await autoDetectPayments(connection);

  pendingMints = payments
    .filter(p => p.tier !== 'unknown')
    .map(p => ({
      id: Date.now().toString(),
      userWallet: p.from,
      tier: p.tier,
      currency: p.currency,
      amount: p.amount,
      signature: p.signature,
      timestamp: p.timestamp.toISOString(),
      status: 'pending',
    }));

  console.log('✅ Pending mints:', pendingMints.length);
}, 30000);

app.get('/payments', (_, res) => res.json(pendingMints));

app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);
