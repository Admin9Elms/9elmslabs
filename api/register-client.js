/**
 * POST /api/register-client
 * Called from onboard.html after payment.
 * Creates client in KV, triggers first scan, sends magic link email.
 *
 * GET /api/register-client?email=xxx
 * Looks up existing client by email.
 */
import { Resend } from 'resend';
import { createClient, getClientByEmail, createAuthToken } from './_db.js';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — lookup by email
  if (req.method === 'GET') {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Email required' });
    try {
      const client = await getClientByEmail(email);
      if (!client) return res.status(404).json({ error: 'Client not found' });
      return res.status(200).json({
        success: true,
        clientId: client.clientId,
        businessName: client.businessName,
        plan: client.plan,
        industry: client.industry,
      });
    } catch (err) {
      console.error('Client lookup error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { businessName, email, contactName, websiteUrl, industry, plan, phone } = req.body || {};

  if (!businessName || !email || !plan) {
    return res.status(400).json({ error: 'Missing required fields: businessName, email, plan' });
  }

  try {
    // Check if already registered
    const existing = await getClientByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'This email is already registered. Please log in instead.', redirect: '/login.html' });
    }

    // Create client in KV
    const client = await createClient({
      businessName,
      email,
      contactName,
      websiteUrl,
      industry: industry || 'other',
      plan,
      phone,
    });

    // Generate magic link for dashboard access
    const token = await createAuthToken(client.clientId, client.email);
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://9elmslabs.co.uk';
    const loginUrl = `${baseUrl}/api/auth-verify?token=${token}`;

    // Send welcome email with dashboard link
    try {
      await resend.emails.send({
        from: '9 Elms Labs <reports@9elmslabs.co.uk>',
        to: client.email,
        subject: `Welcome to 9 Elms Labs — Your ${capitalize(plan)} Plan is Active`,
        html: getWelcomeEmail(client, loginUrl),
      });
    } catch (emailErr) {
      console.error('Welcome email failed:', emailErr);
      // Don't block registration if email fails
    }

    // Notify team
    try {
      await resend.emails.send({
        from: '9 Elms Labs <reports@9elmslabs.co.uk>',
        to: 'hello@9elmslabs.co.uk',
        subject: `New ${capitalize(plan)} Client: ${businessName}`,
        html: `<h2>New client registered</h2>
          <p><strong>Business:</strong> ${businessName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Plan:</strong> ${plan}</p>
          <p><strong>Industry:</strong> ${industry}</p>
          <p><strong>URL:</strong> ${websiteUrl}</p>
          <p><strong>Client ID:</strong> ${client.clientId}</p>`,
      });
    } catch (e) {}

    // Fire first monitoring scan in background (non-blocking)
    try {
      fetch(`${baseUrl}/api/monitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.clientId,
          businessName,
          email,
          industry: industry || 'other',
          plan,
          url: websiteUrl,
        }),
      }).catch(e => console.error('First monitor check failed:', e));
    } catch (e) {}

    return res.status(200).json({
      success: true,
      clientId: client.clientId,
      message: 'Account created. Check your email for dashboard access.',
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Failed to create account. Please contact hello@9elmslabs.co.uk' });
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getWelcomeEmail(client, loginUrl) {
  const planFeatures = {
    starter: [
      'Monthly AI visibility scan across all platforms',
      'Monthly performance report',
      'Dashboard access',
      '2 content recommendations per month',
      'Conversion tracking snippet',
    ],
    growth: [
      'Weekly AI visibility scan across all platforms',
      'Weekly performance report',
      '4 AI-optimised articles per month',
      'Competitor tracking',
      'A/B testing',
      'Performance alerts',
    ],
    scale: [
      'Daily AI visibility scan across all platforms',
      'Weekly performance report',
      '8 AI-optimised articles per month',
      'Daily competitor intelligence',
      'Instant performance alerts',
      'Priority support',
    ],
  };

  const features = planFeatures[client.plan] || planFeatures.starter;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Tahoma,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#0a0e27;color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0;">
    <div style="font-size:28px;font-weight:bold;">9EL</div>
    <div style="font-size:14px;color:#00d4ff;">9 Elms Labs</div>
    <p style="margin-top:15px;font-size:18px;">Welcome to your ${capitalize(client.plan)} Plan</p>
  </div>
  <div style="background:#f9f9f9;padding:30px;border-radius:0 0 8px 8px;">
    <h2>Hi ${client.contactName || 'there'},</h2>
    <p>Your account is now active and your first AI visibility scan is running. Here's what you get:</p>
    <ul style="padding-left:20px;">
      ${features.map(f => `<li style="margin-bottom:8px;">${f}</li>`).join('')}
    </ul>
    <div style="text-align:center;margin:30px 0;">
      <a href="${loginUrl}" style="display:inline-block;background:#00d4ff;color:#0a0e27;padding:15px 40px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">Open My Dashboard</a>
    </div>
    <p style="font-size:13px;color:#666;">This login link expires in 1 hour. After that, visit <a href="https://9elmslabs.co.uk/login.html" style="color:#00d4ff;">9elmslabs.co.uk/login</a> to get a new one.</p>
    <div style="background:white;padding:20px;border-radius:8px;margin-top:24px;border-left:4px solid #00d4ff;">
      <h4 style="margin:0 0 8px 0;">Your first scan is running now</h4>
      <p style="margin:0;font-size:14px;color:#666;">We're analysing <strong>${client.businessName}</strong> across ChatGPT, Perplexity, Google AI, and more. Results will be in your dashboard within minutes.</p>
    </div>
  </div>
  <div style="text-align:center;font-size:11px;color:#999;margin-top:20px;">
    &copy; ${new Date().getFullYear()} 9 Elms Labs Ltd. | <a href="mailto:hello@9elmslabs.co.uk" style="color:#999;">hello@9elmslabs.co.uk</a>
  </div>
</body>
</html>`;
}
