import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Support both contact form fields and checkout form fields
  const name = req.body.name || req.body.contactName || 'Not provided';
  const email = req.body.email || '';
  const company = req.body.company || req.body.businessName || 'Not provided';
  const message = req.body.message || `New ${req.body.plan || 'inquiry'} registration from checkout`;
  const plan = req.body.plan || '';
  const website = req.body.website || '';
  const phone = req.body.phone || '';
  const industry = req.body.industry || '';

  // Validate required fields
  if (!email) {
    return res.status(400).json({
      error: 'Missing required field: email',
    });
  }

  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Send inquiry email to 9 Elms Labs
    const response = await resend.emails.send({
      from: '9 Elms Labs <reports@9elmslabs.co.uk>',
      to: 'hello@9elmslabs.co.uk',
      subject: `New inquiry from ${company} — ${plan || 'Plan not specified'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">New Inquiry Received</h2>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Contact Information</h3>
            <p style="margin: 8px 0;"><strong>Name:</strong> ${escapeHtml(name)}</p>
            <p style="margin: 8px 0;"><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
            <p style="margin: 8px 0;"><strong>Company:</strong> ${escapeHtml(company)}</p>
            ${website ? `<p style="margin: 8px 0;"><strong>Website:</strong> ${escapeHtml(website)}</p>` : ''}
            ${phone ? `<p style="margin: 8px 0;"><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ''}
            ${industry ? `<p style="margin: 8px 0;"><strong>Industry:</strong> ${escapeHtml(industry)}</p>` : ''}
            ${plan ? `<p style="margin: 8px 0;"><strong>Interest:</strong> ${escapeHtml(plan)}</p>` : ''}
          </div>

          <div style="background: #f9f9f9; padding: 20px; border-left: 4px solid #007bff; border-radius: 4px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Message</h3>
            <p style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(message)}</p>
          </div>

          <div style="color: #666; font-size: 12px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="margin: 5px 0;">
              <strong>Received:</strong> ${new Date().toLocaleString('en-GB')}
            </p>
            <p style="margin: 5px 0;">
              <strong>Timezone:</strong> ${Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
          </div>
        </div>
      `,
      replyTo: email,
    });

    if (response.error) {
      console.error('Resend error:', response.error);
      return res.status(500).json({
        error: 'Failed to send inquiry',
        details: response.error,
      });
    }

    // Optional: Send confirmation email to the inquirer
    await resend.emails.send({
      from: '9 Elms Labs <reports@9elmslabs.co.uk>',
      to: email,
      subject: 'We received your inquiry — 9 Elms Labs',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">Thank You for Your Inquiry</h2>

          <p>Hi ${escapeHtml(name)},</p>

          <p>We've received your message and appreciate your interest in 9 Elms Labs. Our team will review your inquiry and get back to you as soon as possible, typically within 24 business hours.</p>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Quick Next Steps</h3>
            <ul style="line-height: 1.8;">
              <li>Watch for an email from our team with next steps</li>
              <li>Check your spam folder if you don't see it within 24 hours</li>
              <li>Reply directly to our email to add more context</li>
            </ul>
          </div>

          <p>In the meantime, learn more about our services:</p>
          <ul style="line-height: 1.8;">
            <li><a href="https://9elmslabs.co.uk/scanner" style="color: #007bff; text-decoration: none;">AI Visibility Scanner</a> — Free quick scan</li>
            <li><a href="https://9elmslabs.co.uk/audit" style="color: #007bff; text-decoration: none;">Full Audit</a> — Comprehensive analysis (£2,499)</li>
            <li><a href="https://9elmslabs.co.uk/blog" style="color: #007bff; text-decoration: none;">Blog</a> — AI visibility insights</li>
          </ul>

          <p style="margin-top: 30px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px;">
            © 2026 9 Elms Labs. A product of Audley & Oxford Advisory Firm.
          </p>
        </div>
      `,
    }).catch((err) => {
      console.error('Error sending confirmation email:', err);
      // Don't fail the request if confirmation email fails
    });

    return res.status(200).json({
      success: true,
      message: 'Inquiry received successfully',
      messageId: response.data?.id,
      name,
      company,
      email,
    });
  } catch (error) {
    console.error('Contact handler error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
