/**
 * webhook-stripe.js — Stripe webhook handler for subscription lifecycle events
 *
 * POST /api/webhook-stripe
 * Receives Stripe webhook events with raw body for signature verification.
 *
 * Handled events:
 *   checkout.session.completed
 *   invoice.payment_succeeded
 *   invoice.payment_failed
 *   customer.subscription.deleted
 *   customer.subscription.updated
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   REDIS_URL
 *   RESEND_API_KEY
 */

import Stripe from 'stripe';
import Redis from 'ioredis';
import { Resend } from 'resend';
import { createClient, getClient, updateClient, createAuthToken } from './_db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const redis = new Redis(process.env.REDIS_URL, {
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

async function kvGet(key) {
  const val = await redis.get(key);
  if (val === null) return null;
  try { return JSON.parse(val); } catch { return val; }
}

async function kvSet(key, value, options) {
  const str = JSON.stringify(value);
  if (options?.ex) {
    await redis.set(key, str, 'EX', options.ex);
  } else {
    await redis.set(key, str);
  }
}

async function kvDel(key) {
  await redis.del(key);
}

// ——— Vercel: disable automatic body parsing so we can verify the webhook signature ———
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Read raw body from the request stream (required for Stripe signature verification).
 */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Look up a client by their Stripe customer ID using the index key.
 */
async function getClientByStripeCustomerId(stripeCustomerId) {
  const clientId = await kvGet(`client:stripe:${stripeCustomerId}`);
  if (!clientId) return null;
  return await getClient(clientId);
}

/**
 * Determine which plan a price ID corresponds to.
 */
function planFromPriceId(priceId) {
  if (priceId === process.env.STRIPE_PRICE_STARTER) return 'starter';
  if (priceId === process.env.STRIPE_PRICE_GROWTH) return 'growth';
  if (priceId === process.env.STRIPE_PRICE_SCALE) return 'scale';
  return 'unknown';
}

// ——— Event Handlers ———

async function handleCheckoutCompleted(session) {
  const pendingData = await kvGet(`pending:${session.id}`);
  if (!pendingData) {
    console.error(`No pending data found for checkout session ${session.id}`);
    return;
  }

  const subscriptionId = session.subscription;
  const customerId = session.customer;

  // Retrieve the subscription to get period end
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Create client record with Stripe fields
  const client = await createClient({
    businessName: pendingData.businessName,
    email: pendingData.email,
    plan: pendingData.plan,
    industry: pendingData.industry,
    websiteUrl: pendingData.websiteUrl,
    contactName: pendingData.contactName,
    phone: pendingData.phone,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    subscriptionStatus: 'active',
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
  });

  // Create Stripe customer → clientId index for future lookups
  await kvSet(`client:stripe:${customerId}`, client.clientId);

  // Generate a magic link auth token for the welcome email
  const token = await createAuthToken(client.clientId, client.email);
  const magicLink = `https://9elmslabs.co.uk/api/auth-verify?token=${token}`;

  // Send welcome email
  try {
    await resend.emails.send({
      from: '9 Elms Labs <reports@9elmslabs.co.uk>',
      to: client.email,
      subject: `Welcome to 9 Elms Labs, ${client.contactName || client.businessName}!`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a2e;">Welcome to 9 Elms Labs</h1>
          <p>Hi ${client.contactName || 'there'},</p>
          <p>Thank you for subscribing to the <strong>${client.plan.charAt(0).toUpperCase() + client.plan.slice(1)}</strong> plan. We're excited to help <strong>${client.businessName}</strong> dominate AI search.</p>
          <p>Your first monitoring scan is running now. Access your dashboard to see the results:</p>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${magicLink}" style="background: #6c5ce7; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Open Your Dashboard
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">This link expires in 1 hour. You can request a new one anytime from the login page.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
          <p style="color: #999; font-size: 12px;">9 Elms Labs — AI Search Optimisation<br/>London, UK</p>
        </div>
      `,
    });
  } catch (emailErr) {
    console.error('Failed to send welcome email:', emailErr);
    // Don't fail the webhook — the subscription is still valid
  }

  // Trigger first monitoring scan (fire-and-forget)
  try {
    fetch(`https://9elmslabs.co.uk/api/monitor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.clientId, businessName: client.businessName, email: client.email, industry: client.industry, plan: client.plan, url: client.url || client.websiteUrl }),
    }).catch((err) => console.error('First scan trigger failed:', err));
  } catch (scanErr) {
    console.error('Failed to trigger first scan:', scanErr);
  }

  // Clean up pending data
  await kvDel(`pending:${session.id}`);

  console.log(`Client created: ${client.clientId} (${client.email}) — plan: ${client.plan}`);
}

async function handlePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  const client = await getClientByStripeCustomerId(customerId);
  if (!client) {
    console.warn(`invoice.payment_succeeded: No client found for customer ${customerId}`);
    return;
  }

  const subscriptionId = invoice.subscription;
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await updateClient(client.clientId, {
      subscriptionStatus: 'active',
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    });
  }

  console.log(`Payment succeeded for client ${client.clientId}`);
}

async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;
  const client = await getClientByStripeCustomerId(customerId);
  if (!client) {
    console.warn(`invoice.payment_failed: No client found for customer ${customerId}`);
    return;
  }

  await updateClient(client.clientId, {
    subscriptionStatus: 'past_due',
  });

  // Send payment failed notification
  try {
    await resend.emails.send({
      from: '9 Elms Labs <reports@9elmslabs.co.uk>',
      to: client.email,
      subject: 'Action required: Payment failed for your 9 Elms Labs subscription',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #e74c3c;">Payment Failed</h1>
          <p>Hi ${client.contactName || 'there'},</p>
          <p>We were unable to process the payment for your <strong>${client.plan.charAt(0).toUpperCase() + client.plan.slice(1)}</strong> subscription.</p>
          <p>Please update your payment method to keep your AI search monitoring active:</p>
          <p style="text-align: center; margin: 32px 0;">
            <a href="https://9elmslabs.co.uk/dashboard.html" style="background: #e74c3c; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Update Payment Method
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">If payment continues to fail, your subscription will be cancelled and monitoring will stop.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
          <p style="color: #999; font-size: 12px;">9 Elms Labs — AI Search Optimisation<br/>London, UK</p>
        </div>
      `,
    });
  } catch (emailErr) {
    console.error('Failed to send payment failed email:', emailErr);
  }

  console.log(`Payment failed for client ${client.clientId}`);
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;
  const client = await getClientByStripeCustomerId(customerId);
  if (!client) {
    console.warn(`subscription.deleted: No client found for customer ${customerId}`);
    return;
  }

  await updateClient(client.clientId, {
    subscriptionStatus: 'cancelled',
    status: 'inactive',
  });

  console.log(`Subscription cancelled for client ${client.clientId}`);
}

async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;
  const client = await getClientByStripeCustomerId(customerId);
  if (!client) {
    console.warn(`subscription.updated: No client found for customer ${customerId}`);
    return;
  }

  const updates = {
    currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
  };

  // Check if plan changed
  if (subscription.items?.data?.length > 0) {
    const priceId = subscription.items.data[0].price.id;
    const newPlan = planFromPriceId(priceId);
    if (newPlan !== 'unknown' && newPlan !== client.plan) {
      updates.plan = newPlan;
      console.log(`Plan changed for client ${client.clientId}: ${client.plan} → ${newPlan}`);
    }
  }

  // Update status based on subscription state
  if (subscription.status === 'active') {
    updates.subscriptionStatus = 'active';
  } else if (subscription.status === 'past_due') {
    updates.subscriptionStatus = 'past_due';
  } else if (subscription.cancel_at_period_end) {
    updates.subscriptionStatus = 'cancelling';
  }

  await updateClient(client.clientId, updates);

  console.log(`Subscription updated for client ${client.clientId}`);
}

// ——— Main Handler ———

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing Stripe signature header.' });
    }

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(`Error processing webhook event ${event.type}:`, err);
    // Return 200 to prevent Stripe from retrying on application errors
    // (Stripe will retry on 5xx, which could cause duplicate processing)
    return res.status(200).json({ received: true, error: 'Processing error logged.' });
  }
}
