// backend/lib/payment-tracker.ts
const web3 = require('@solana/web3.js');

const {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
} = web3;

// ================= CONFIG =================

// Admin wallet (SOL payments)
const ADMIN_WALLET = new PublicKey(
  '7ALEjJAikbPcRcTRT6722UEa18tHLf5cnz72SABy5NUg'
);

// Token accounts (SPL)
const USDC_RECIPIENT = new PublicKey(
  'CsiQk66yE5xWgjw948gfYCP1RJCJQb2wJB4QhTvkUCt4'
);

const GORILLA_RECIPIENT = new PublicKey(
  'G4DMJcRVeUp7ET5MgoWFuQGg4KZbj6NZZXeV55hj6ghs'
);

// ================= TYPES =================

/**
 * @typedef {Object} DetectedPayment
 * @property {string} signature
 * @property {string} from
 * @property {number} amount
 * @property {'sol' | 'usdc' | 'gorilla'} currency
 * @property {'starter' | 'classic' | 'king' | 'unknown'} tier
 * @property {Date} timestamp
 * @property {number} blockTime
 */

// ================= CORE =================

async function fetchRecentPayments(connection, limit = 20) {
  const signatures = await connection.getSignaturesForAddress(
    ADMIN_WALLET,
    { limit }
  );

  const payments = [];

  for (const sig of signatures) {
    const tx = await connection.getParsedTransaction(
      sig.signature,
      { maxSupportedTransactionVersion: 0 }
    );

    if (!tx) continue;

    const payment = parseTransaction(tx, sig.signature);
    if (payment) payments.push(payment);
  }

  return payments;
}

function parseTransaction(tx, signature) {
  const instructions = tx.transaction.message.instructions;

  for (const ix of instructions) {
    if (!('parsed' in ix)) continue;

    // -------- SOL TRANSFER --------
    if (ix.parsed?.type === 'transfer') {
      const info = ix.parsed.info;

      if (info.destination === ADMIN_WALLET.toString()) {
        const amount = info.lamports / LAMPORTS_PER_SOL;

        return {
          signature,
          from: info.source,
          amount,
          currency: 'sol',
          tier: detectTierFromAmount(amount, 'sol'),
          timestamp: new Date((tx.blockTime || 0) * 1000),
          blockTime: tx.blockTime || 0,
        };
      }
    }

    // -------- SPL TOKEN TRANSFER --------
    if (ix.parsed?.type === 'transferChecked') {
      const info = ix.parsed.info;
      const amount = Number(info.tokenAmount.uiAmount);

      if (info.destination === USDC_RECIPIENT.toString()) {
        return {
          signature,
          from: info.authority || info.source,
          amount,
          currency: 'usdc',
          tier: detectTierFromAmount(amount, 'usdc'),
          timestamp: new Date((tx.blockTime || 0) * 1000),
          blockTime: tx.blockTime || 0,
        };
      }

      if (info.destination === GORILLA_RECIPIENT.toString()) {
        return {
          signature,
          from: info.authority || info.source,
          amount,
          currency: 'gorilla',
          tier: detectTierFromAmount(amount, 'gorilla'),
          timestamp: new Date((tx.blockTime || 0) * 1000),
          blockTime: tx.blockTime || 0,
        };
      }
    }
  }

  return null;
}

// ================= TIERS =================

function detectTierFromAmount(amount, currency) {
  const prices = {
    sol: { starter: 0.5, classic: 1.25, king: 2.5 },
    usdc: { starter: 99, classic: 249, king: 499 },
    gorilla: { starter: 990, classic: 2490, king: 4990 },
  };

  const tolerance = 0.01;
  const tiers = prices[currency];

  for (const tier in tiers) {
    const price = tiers[tier];
    if (Math.abs(amount - price) / price < tolerance) {
      return tier;
    }
  }

  return 'unknown';
}

// ================= AUTO =================

async function autoDetectPayments(connection) {
  return await fetchRecentPayments(connection, 50);
}

// ================= EXPORTS =================

module.exports = {
  fetchRecentPayments,
  autoDetectPayments,
};
