/**
 * manage-subscription.js — Authenticated subscription management endpoint
 *
 * GET  /api/manage-subscription  → Current subscription status + billing portal URL
 * POST /api/manage-subscription  → Cancel, reactivate, or change plan
 *
 * POST actions:
 *   { action: 'cancel' }                  — Cancel at period end
 *   { action: 'reactivate' }              — Undo pending cancellation
 *   { action: 'change-plan', newPlan: 'growth' } — Redirect to Stripe billing portal
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   REDIS_URL
 */

import Stripe from 'stripe';
import { authenticateRequest, updateClient } from './_db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const VALID_PLANS = ['starter', 'growth', 'scale'];

const PLAN_DISPLAY = {
  starter: { name: 'Starter', price: '£199/mo' },
  growth: { name: 'Growth', price: '£499/mo' },
  scale: { name: 'Scale', price: '£999/mo' },
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://9elmslabs.co.uk');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ——— Authentication ———
  const client = await authenticateRequest(req);
  if (!client) {
    return res.status(401).json({ error: 'Not authenticated. Please log in.' });
  }

  if (!client.stripeSubscriptionId) {
    return res.status(400).json({ error: 'No active subscription found for this account.' });
  }

  try {
    // ——— GET: Return subscription status ———
    if (req.method === 'GET') {
      let subscription;
      try {
        subscription = await stripe.subscriptions.retrieve(client.stripeSubscriptionId);
      } catch (stripeErr) {
        console.error('Failed to retrieve subscription from Stripe:', stripeErr.message);
        // Fall back to cached data if Stripe is unreachable
        return res.status(200).json({
          plan: client.plan,
          planDisplay: PLAN_DISPLAY[client.plan] || { name: client.plan, price: 'N/A' },
          subscriptionStatus: client.subscriptionStatus || 'unknown',
          currentPeriodEnd: client.currentPeriodEnd || null,
          cancelAtPeriodEnd: false,
          billingPortalUrl: null,
          error: 'Could not retrieve live subscription data.',
        });
      }

      // Create a billing portal session for the customer
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: client.stripeCustomerId,
        return_url: 'https://9elmslabs.co.uk/dashboard.html',
      });

      return res.status(200).json({
        plan: client.plan,
        planDisplay: PLAN_DISPLAY[client.plan] || { name: client.plan, price: 'N/A' },
        subscriptionStatus: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        billingPortalUrl: portalSession.url,
      });
    }

    // ——— POST: Subscription actions ———
    const { action, newPlan } = req.body || {};

    if (!action) {
      return res.status(400).json({ error: 'Missing "action" in request body.' });
    }

    switch (action) {
      // ——— Cancel subscription at period end ———
      case 'cancel': {
        const subscription = await stripe.subscriptions.update(
          client.stripeSubscriptionId,
          { cancel_at_period_end: true }
        );

        await updateClient(client.clientId, {
          subscriptionStatus: 'cancelling',
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        });

        return res.status(200).json({
          success: true,
          message: 'Subscription will be cancelled at the end of the current billing period.',
          cancelAt: new Date(subscription.current_period_end * 1000).toISOString(),
        });
      }

      // ——— Reactivate a cancelling subscription ———
      case 'reactivate': {
        // Check if subscription is actually pending cancellation
        const current = await stripe.subscriptions.retrieve(client.stripeSubscriptionId);

        if (!current.cancel_at_period_end) {
          return res.status(400).json({
            error: 'Subscription is not pending cancellation.',
          });
        }

        if (current.status === 'canceled') {
          return res.status(400).json({
            error: 'Subscription has already been cancelled. Please create a new subscription.',
          });
        }

        const subscription = await stripe.subscriptions.update(
          client.stripeSubscriptionId,
          { cancel_at_period_end: false }
        );

        await updateClient(client.clientId, {
          subscriptionStatus: 'active',
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        });

        return res.status(200).json({
          success: true,
          message: 'Subscription has been reactivated. You will continue to be billed.',
        });
      }

      // ——— Change plan via Stripe billing portal ———
      case 'change-plan': {
        if (!newPlan || !VALID_PLANS.includes(newPlan)) {
          return res.status(400).json({
            error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}`,
          });
        }

        if (newPlan === client.plan) {
          return res.status(400).json({
            error: `You are already on the ${newPlan} plan.`,
          });
        }

        // Create a billing portal session configured for plan changes
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: client.stripeCustomerId,
          return_url: 'https://9elmslabs.co.uk/dashboard.html',
        });

        return res.status(200).json({
          success: true,
          url: portalSession.url,
          message: `Redirecting to billing portal to change to the ${newPlan} plan.`,
        });
      }

      default:
        return res.status(400).json({
          error: `Unknown action "${action}". Supported actions: cancel, reactivate, change-plan`,
        });
    }
  } catch (err) {
    console.error('manage-subscription error:', err);

    if (err.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({ error: 'An error occurred. Please try again or contact support.' });
  }
}
