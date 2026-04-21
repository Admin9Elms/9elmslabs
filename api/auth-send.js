/**
 * POST /api/auth-send
 * Sends a magic login link to a registered client's email.
 * Body: { email }
 */
import { Resend } from 'resend';
import { getClientByEmail, createAuthToken } from './_db.js';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // No wildcard CORS on auth endpoints — same-origin only
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const client = await getClientByEmail(email);
    if (!client) {
      // Don't reveal whether email exists — always say "sent"
      return res.status(200).json({ success: true, message: 'If this email is registered, a login link has been sent.' });
    }

    const token = await createAuthToken(client.clientId, client.email);
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://9elmslabs.co.uk';
    const loginUrl = `${baseUrl}/api/auth-verify?token=${token}`;

    await resend.emails.send({
      from: '9 Elms Labs <reports@9elmslabs.co.uk>',
      to: client.email,
      subject: 'Your 9 Elms Labs Dashboard Login',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: 'Segoe UI', Tahoma, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #0a0e27; color: white; padding: 30px; text-align: center; border-radius: 8px;">
            <div style="font-size: 28px; font-weight: bold;">9EL</div>
            <div style="font-size: 14px; color: #00d4ff;">9 Elms Labs</div>
          </div>
          <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
            <h2>Hi ${client.contactName || 'there'},</h2>
            <p>Click the button below to access your dashboard. This link expires in 1 hour.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="display: inline-block; background: #00d4ff; color: #0a0e27; padding: 15px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Open My Dashboard</a>
            </div>
            <p style="font-size: 13px; color: #666;">If you didn't request this link, you can safely ignore this email.</p>
            <p style="font-size: 13px; color: #666;">Link: ${loginUrl}</p>
          </div>
          <div style="text-align: center; font-size: 11px; color: #999; margin-top: 20px;">
            &copy; ${new Date().getFullYear()} 9 Elms Labs Ltd. All rights reserved.
          </div>
        </body>
        </html>
      `,
    });

    return res.status(200).json({ success: true, message: 'If this email is registered, a login link has been sent.' });
  } catch (err) {
    console.error('Auth send error:', err);
    return res.status(500).json({ error: 'Failed to send login link' });
  }
}
