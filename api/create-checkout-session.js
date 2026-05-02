/**
 * create-checkout-session.js — Creates a Stripe Checkout Session for subscription signup
 *
 * POST /api/create-checkout-session
 * Body: { plan, email, businessName, contactName, websiteUrl, industry, phone }
 * Returns: { url } — Stripe Checkout URL to redirect the user to
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_PRICE_STARTER
 *   STRIPE_PRICE_GROWTH
 *   STRIPE_PRICE_SCALE
 *   REDIS_URL
 */

import Stripe from 'stripe';
import Redis from 'ioredis';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const redis = new Redis(process.env.REDIS_URL, {
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

async function kvSet(key, value, options) {
  const str = JSON.stringify(value);
  if (options?.ex) {
    await redis.set(key, str, 'EX', options.ex);
  } else {
    await redis.set(key, str);
  }
}

const PLAN_PRICES = {
  starter: () => process.env.STRIPE_PRICE_STARTER,
  growth: () => process.env.STRIPE_PRICE_GROWTH,
  scale: () => process.env.STRIPE_PRICE_SCALE,
};

const PLAN_NAMES = {
  starter: '9 Elms Labs — Starter (£199/mo)',
  growth: '9 Elms Labs — Growth (£499/mo)',
  scale: '9 Elms Labs — Scale (£999/mo)',
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://9elmslabs.co.uk');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan, email, businessName, contactName, websiteUrl, industry, phone } = req.body || {};

    // ——— Validation ———
    if (!plan || !PLAN_PRICES[plan]) {
      return res.status(400).json({
        error: `Invalid plan. Must be one of: ${Object.keys(PLAN_PRICES).join(', ')}`,
      });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    if (!businessName || businessName.trim().length < 2) {
      return res.status(400).json({ error: 'Business name is required.' });
    }

    const priceId = PLAN_PRICES[plan]();
    if (!priceId) {
      console.error(`Missing env var for plan "${plan}". Check STRIPE_PRICE_* env vars.`);
      return res.status(500).json({ error: 'Server configuration error. Please contact support.' });
    }

    // ——— Create Stripe Checkout Session ———
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email.toLowerCase(),
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          plan,
          businessName,
        },
      },
      metadata: {
        plan,
        businessName,
        source: '9elmslabs-checkout',
      },
      success_url: `https://9elmslabs.co.uk/onboard.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://9elmslabs.co.uk/checkout.html?cancelled=true`,
    });

    // ——— Store form data temporarily for post-payment retrieval ———
    await kvSet(`pending:${session.id}`, {
      plan,
      email: email.toLowerCase(),
      businessName: businessName.trim(),
      contactName: contactName?.trim() || '',
      websiteUrl: websiteUrl?.trim() || '',
      industry: industry?.trim() || 'other',
      phone: phone?.trim() || '',
      createdAt: new Date().toISOString(),
    }, { ex: 86400 }); // 24-hour TTL

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session error:', err);

    if (err.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ error: 'Invalid request to payment processor.' });
    }

    return res.status(500).json({ error: 'Failed to create checkout session. Please try again.' });
  }
}
