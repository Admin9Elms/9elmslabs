/**
 * POST /api/content-generate
 * Generates AI-optimised content for all tiers.
 * Called by cron on 1st of month, or manually from dashboard.
 *
 * Body: { clientId, businessName, industry, count, type }
 *   type: "recommendations" (starter — short topic briefs) or "articles" (growth/scale — full 600-800 word pieces)
 * Generates `count` items, stores in KV via _db.js, emails notification.
 */
import { Resend } from 'resend';
import { getClient, addContent } from './_db.js';

const resend = new Resend(process.env.RESEND_API_KEY);

const TOPIC_BANK = {
  dental: [
    { topic: 'Modern Dental Implant Options', type: 'blog-post' },
    { topic: 'FAQ: Invisalign Treatment Process', type: 'faq' },
    { topic: 'How to Choose the Right Dentist', type: 'blog-post' },
    { topic: 'Teeth Whitening: What Actually Works', type: 'blog-post' },
    { topic: 'Emergency Dental Care Guide', type: 'service-page' },
    { topic: 'Children\'s Dentistry FAQ', type: 'faq' },
    { topic: 'Dental Crown vs Veneer Comparison', type: 'blog-post' },
    { topic: 'Root Canal Treatment: What to Expect', type: 'blog-post' },
  ],
  saas: [
    { topic: 'How to Choose the Right Software Platform', type: 'blog-post' },
    { topic: 'Product Comparison Guide', type: 'service-page' },
    { topic: 'Getting Started FAQ', type: 'faq' },
    { topic: 'Integration Guide and API Documentation', type: 'blog-post' },
    { topic: 'ROI Calculator for Your Business', type: 'blog-post' },
    { topic: 'Customer Success Story Template', type: 'blog-post' },
    { topic: 'Security and Compliance FAQ', type: 'faq' },
    { topic: 'Migration Guide from Competitors', type: 'service-page' },
  ],
  restaurant: [
    { topic: 'Our Chef\'s Story and Philosophy', type: 'about-page' },
    { topic: 'Seasonal Menu Guide', type: 'blog-post' },
    { topic: 'Dietary Requirements and Allergen Information', type: 'faq' },
    { topic: 'Private Dining and Events', type: 'service-page' },
    { topic: 'Wine Pairing Guide', type: 'blog-post' },
    { topic: 'Reservation and Booking FAQ', type: 'faq' },
    { topic: 'Sustainable Sourcing Practices', type: 'blog-post' },
    { topic: 'Cooking Tips from Our Kitchen', type: 'blog-post' },
  ],
  ecommerce: [
    { topic: 'Buying Guide for Top Products', type: 'blog-post' },
    { topic: 'Shipping and Returns FAQ', type: 'faq' },
    { topic: 'Product Care and Maintenance', type: 'blog-post' },
    { topic: 'Why Choose Us Over Competitors', type: 'service-page' },
    { topic: 'Gift Guide for Every Occasion', type: 'blog-post' },
    { topic: 'Size Guide and Fitting FAQ', type: 'faq' },
    { topic: 'Customer Reviews and Testimonials', type: 'blog-post' },
    { topic: 'Sustainability Commitment', type: 'about-page' },
  ],
  default: [
    { topic: 'Why Choose Our Services', type: 'service-page' },
    { topic: 'Frequently Asked Questions', type: 'faq' },
    { topic: 'Industry Trends and Insights', type: 'blog-post' },
    { topic: 'Our Approach and Methodology', type: 'about-page' },
    { topic: 'Client Success Stories', type: 'blog-post' },
    { topic: 'Getting Started Guide', type: 'blog-post' },
    { topic: 'Common Problems and Solutions', type: 'faq' },
    { topic: 'Expert Tips and Best Practices', type: 'blog-post' },
  ],
};

function generateRecommendation(businessName, industry, topicInfo) {
  const { topic, type } = topicInfo;
  const html = `<div class="recommendation">
<h3>${topic}</h3>
<p><strong>Why:</strong> This topic is highly relevant for ${industry} businesses and frequently surfaces in AI-generated answers. Writing about it positions ${businessName} as an authority.</p>
<p><strong>Key points to include:</strong></p>
<ul>
  <li>Address the most common questions your audience asks about ${topic.toLowerCase()}</li>
  <li>Include specific facts, figures, or examples from your experience</li>
  <li>Add structured data markup (${type === 'faq' ? 'FAQPage schema' : 'Article schema'})</li>
  <li>Write in an authoritative but approachable tone, 600-800 words</li>
</ul>
<p><strong>Format:</strong> ${type}</p>
</div>`;

  return {
    title: topic,
    type: 'recommendation',
    html,
    schema: '',
    wordCount: html.split(/\s+/).length,
  };
}

async function generateArticle(businessName, industry, topicInfo, perplexityKey) {
  const { topic, type } = topicInfo;

  let content = '';
  let schema = '';

  if (perplexityKey) {
    try {
      const resp = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${perplexityKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'sonar',
          messages: [{
            role: 'user',
            content: `Write a comprehensive, SEO-optimised ${type} about "${topic}" for a ${industry} business called "${businessName}".
            Include: clear headings (H2, H3), specific facts and figures, actionable advice, and a compelling conclusion.
            Format as clean HTML with semantic tags. Make it 600-800 words.
            Write in an authoritative but approachable British English tone.`,
          }],
          max_tokens: 2000,
          temperature: 0.4,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        content = data.choices[0]?.message?.content || '';
      }
    } catch (e) {
      console.error('Perplexity content gen failed:', e.message);
    }
  }

  // Fallback content if API failed
  if (!content) {
    content = generateFallbackContent(businessName, topic, type, industry);
  }

  // Generate schema markup
  if (type === 'faq') {
    schema = generateFAQSchema(topic, content);
  } else if (type === 'blog-post') {
    schema = generateArticleSchema(businessName, topic, content);
  }

  return {
    title: topic,
    type,
    html: content,
    schema,
    wordCount: content.split(/\s+/).length,
  };
}

function generateFallbackContent(businessName, topic, type, industry) {
  return `<article>
<h1>${topic}</h1>
<p>At ${businessName}, we understand the importance of ${topic.toLowerCase()} in the ${industry} sector. This guide provides comprehensive insights to help you make informed decisions.</p>
<h2>Key Points</h2>
<p>Our team of experts has compiled the most relevant and up-to-date information on this topic. Whether you're looking for practical advice or detailed analysis, you'll find valuable insights here.</p>
<h2>Why This Matters</h2>
<p>In today's competitive landscape, staying informed about ${topic.toLowerCase()} can make a significant difference to your business outcomes. Here's what the latest research tells us.</p>
<h2>Our Recommendation</h2>
<p>Based on our extensive experience in the ${industry} industry, we recommend taking a strategic approach. Contact ${businessName} to discuss how we can help you implement these insights.</p>
<h2>Next Steps</h2>
<p>Ready to take action? Get in touch with our team for a personalised consultation tailored to your specific needs.</p>
</article>`;
}

function generateFAQSchema(topic, content) {
  return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "${topic}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Please see our comprehensive guide above for detailed information."
      }
    }
  ]
}
</script>`;
}

function generateArticleSchema(businessName, topic, content) {
  return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${topic}",
  "author": { "@type": "Organization", "name": "${businessName}" },
  "datePublished": "${new Date().toISOString().split('T')[0]}",
  "publisher": { "@type": "Organization", "name": "${businessName}" }
}
</script>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { clientId, businessName, industry, count, type } = req.body || {};
  if (!clientId || !businessName) return res.status(400).json({ error: 'clientId and businessName required' });

  const contentType = type || 'articles'; // "recommendations" for starter, "articles" for growth/scale
  const articleCount = Math.min(count || 4, 8);
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  const topics = (TOPIC_BANK[industry] || TOPIC_BANK.default).slice(0, articleCount);

  const results = [];

  for (const topicInfo of topics) {
    try {
      const item = contentType === 'recommendations'
        ? generateRecommendation(businessName, industry || 'other', topicInfo)
        : await generateArticle(businessName, industry || 'other', topicInfo, perplexityKey);
      await addContent(clientId, item);
      results.push({ title: item.title, type: item.type, wordCount: item.wordCount });
    } catch (e) {
      console.error('Content generation failed:', topicInfo.topic, e.message);
    }
  }

  // Notify client that content is ready
  const client = await getClient(clientId);
  if (client && client.email) {
    try {
      await resend.emails.send({
        from: '9 Elms Labs <reports@9elmslabs.co.uk>',
        to: client.email,
        subject: `${results.length} New ${contentType === 'recommendations' ? 'Content Recommendations' : 'Content Pieces'} Ready — ${businessName}`,
        html: `<!DOCTYPE html><html><body style="font-family:'Segoe UI',sans-serif;color:#333;max-width:600px;margin:0 auto;">
          <div style="background:#0a0e27;color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0;">
            <div style="font-size:28px;font-weight:bold;">9EL</div>
            <div style="font-size:14px;color:#00d4ff;">Content Delivery</div>
          </div>
          <div style="background:#f9f9f9;padding:30px;border-radius:0 0 8px 8px;">
            <h2>New content is ready for ${businessName}</h2>
            <p>${results.length} ${contentType === 'recommendations' ? 'content recommendations have' : 'AI-optimised articles have'} been prepared and are waiting in your dashboard:</p>
            ${results.map(r => `<div style="background:white;padding:12px;margin:8px 0;border-radius:6px;border-left:3px solid #00d4ff;"><strong>${r.title}</strong><br><span style="font-size:12px;color:#666;">${r.type} — ${r.wordCount} words</span></div>`).join('')}
            <div style="text-align:center;margin:24px 0;">
              <a href="https://9elmslabs.co.uk/login.html" style="display:inline-block;background:#00d4ff;color:#0a0e27;padding:14px 36px;text-decoration:none;border-radius:6px;font-weight:bold;">View in Dashboard</a>
            </div>
            <p style="font-size:13px;color:#666;">Each article includes SEO-optimised HTML and schema markup. Copy the HTML directly into your website.</p>
          </div></body></html>`,
      });
    } catch (e) { console.error('Content notification email failed:', e); }
  }

  return res.status(200).json({ success: true, generated: results.length, articles: results });
}
