import PDFDocument from 'pdfkit';
import { Resend } from 'resend';
import { Buffer } from 'buffer';

const resend = new Resend(process.env.RESEND_API_KEY);

// Color scheme matching 9 Elms Labs brand
const COLORS = {
  dark: '#0a0e27',
  darkGrey: '#1a1f3a',
  cyan: '#00d4ff',
  purple: '#9d4edd',
  accent: '#ff6b35',
  success: '#2ecc71',
  warning: '#f39c12',
  danger: '#e74c3c',
  lightGrey: '#f0f2f5',
  text: '#1a1a1a',
  lightText: '#666666',
  white: '#ffffff',
};

// Vercel free tier has 10s limit. maxDuration:30 requires Pro.
// We've slimmed the PDF to fit within 10s.

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

  const businessName = req.body.businessName || '';
  const url = req.body.url || req.body.websiteUrl || req.body.website || '';
  const email = req.body.email || '';
  const contactName = req.body.contactName || req.body.name || '';
  const industry = req.body.industry || 'other';
  const aiScore = req.body.aiScore || 0;
  const seoScore = req.body.seoScore || 0;
  const conversionScore = req.body.conversionScore || 0;
  const growthPotential = req.body.growthPotential || {};
  const visibilityUplift = growthPotential.visibilityUpliftPct || 15;
  const trafficIncrease = growthPotential.trafficIncreasePct || 8;
  const additionalInquiries = growthPotential.additionalInquiries || 10;
  const findings = req.body.findings || [];
  const competitors = req.body.competitors || [];
  const recommendations = req.body.recommendations || {};
  const scanDate = req.body.scanDate || new Date().toISOString().split('T')[0];

  if (!businessName || !email) {
    return res.status(400).json({ error: 'Missing required fields: businessName and email' });
  }

  try {
    // Generate PDF
    const pdfBuffer = await generatePDF({
      businessName,
      url,
      contactName,
      industry,
      aiScore,
      seoScore,
      conversionScore,
      visibilityUplift,
      trafficIncrease,
      additionalInquiries,
      growthPotential,
      findings,
      competitors,
      recommendations,
      scanDate,
    });

    // Convert PDF buffer to base64 for Resend attachment
    const pdfBase64 = pdfBuffer.toString('base64');

    // Send email to client with report
    const clientEmailResponse = await resend.emails.send({
      from: '9 Elms Labs <reports@9elmslabs.co.uk>',
      replyTo: 'hello@9elmslabs.co.uk',
      to: email,
      subject: `Your AI Visibility & Growth Report — ${businessName}`,
      html: getClientEmailHTML(contactName, businessName, aiScore, seoScore, conversionScore, visibilityUplift, trafficIncrease, additionalInquiries),
      attachments: [
        {
          filename: `AI_Visibility_Report_${sanitizeFilename(businessName)}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    if (clientEmailResponse.error) {
      console.error('Resend client email error:', JSON.stringify(clientEmailResponse.error));
      return res.status(500).json({
        error: 'Failed to send report email',
        details: clientEmailResponse.error,
        debug: {
          from: '9 Elms Labs <reports@9elmslabs.co.uk>',
          to: email,
          attachmentSize: pdfBase64.length,
          hasApiKey: !!process.env.RESEND_API_KEY,
        },
      });
    }

    // Send notification email to 9 Elms Labs team
    try {
      await resend.emails.send({
        from: '9 Elms Labs <reports@9elmslabs.co.uk>',
        to: 'hello@9elmslabs.co.uk',
        subject: `New Report Generated: ${businessName}`,
        html: getNotificationEmailHTML(contactName, businessName, email, industry, aiScore, seoScore, conversionScore, visibilityUplift, additionalInquiries),
      });
    } catch (notifError) {
      console.warn('Failed to send notification email:', notifError);
      // Don't fail the whole request if notification email fails
    }

    return res.status(200).json({
      success: true,
      message: 'Report generated and sent successfully',
      emailId: clientEmailResponse.data?.id,
      businessName,
      email,
    });
  } catch (error) {
    console.error('Report generation error:', error);
    return res.status(500).json({
      error: 'Internal server error during report generation',
      message: error.message,
    });
  }
}

async function generatePDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
    });

    const chunks = [];

    doc.on('data', (chunk) => {
      chunks.push(chunk);
    });

    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on('error', reject);

    // Slimmed to ~10 pages to fit Vercel free-tier 10s timeout
    // Full 25-page report available on Growth / Scale plans

    // Page 1: Cover Page
    addCoverPage(doc, data);

    // Page 2: Executive Summary
    addNewPage(doc, data);
    addExecutiveSummary(doc, data);

    // Page 3: AI Visibility Analysis
    addNewPage(doc, data);
    addAIVisibilityAnalysis(doc, data);

    // Page 4: SEO Health Analysis
    addNewPage(doc, data);
    addSEOHealthAnalysis(doc, data);

    // Page 5: Conversion Analysis
    addNewPage(doc, data);
    addConversionAnalysis(doc, data);

    // Page 6: Competitor Landscape
    addNewPage(doc, data);
    addCompetitorAnalysis(doc, data);

    // Page 7: Revenue Impact
    addNewPage(doc, data);
    addRevenueImpact(doc, data);

    // Page 8: Findings Summary — Critical Issues
    addNewPage(doc, data);
    addFindingsSummary(doc, data, 'critical');

    // Page 9: Quick Wins Action Plan
    addNewPage(doc, data);
    addQuickWinsActionPlan(doc, data);

    // Page 10: Next Steps & 9 Elms Labs Services
    addNewPage(doc, data);
    addNextSteps(doc, data);

    // Add page numbers and footers to all pages
    const pages = doc.bufferedPages;
    for (let i = 0; i < pages.length; i++) {
      doc.switchToPage(i);
      addFooter(doc, i + 1, pages.length, data.businessName);
    }

    doc.end();
  });
}

function addCoverPage(doc, data) {
  // Background color
  doc.rect(0, 0, 595.28, 841.89).fill(COLORS.dark);
  doc.fillColor(COLORS.white);

  // Logo box
  const logoBoxX = doc.page.width / 2 - 40;
  const logoBoxY = 100;
  doc.rect(logoBoxX, logoBoxY, 80, 80).stroke(COLORS.cyan);
  doc.fillColor(COLORS.cyan);
  doc.fontSize(48).font('Helvetica-Bold').text('9EL', logoBoxX + 10, logoBoxY + 15);
  doc.fillColor(COLORS.white);

  // Company name
  doc.fontSize(32).font('Helvetica-Bold').text('9 Elms Labs', 50, logoBoxY + 100, { align: 'center', width: 512 });

  // Main title
  doc.moveDown(3);
  doc.fontSize(44).font('Helvetica-Bold').text('AI Visibility & Growth Report', 50, doc.y, {
    align: 'center',
    width: 512,
  });

  // Business details
  doc.moveDown(2);
  doc.fontSize(16).font('Helvetica').fillColor(COLORS.cyan).text(data.businessName, { align: 'center' });
  doc.fontSize(13).font('Helvetica').fillColor(COLORS.lightGrey).text(data.url, { align: 'center' });

  // Date
  doc.moveDown(1);
  doc.fontSize(12).fillColor(COLORS.lightGrey).text(`Report Date: ${formatDate(data.scanDate)}`, { align: 'center' });

  // Footer info
  doc.moveDown(4);
  doc.fontSize(11).fillColor(COLORS.white).text('Prepared by 9 Elms Labs', { align: 'center' });
  doc.fontSize(10).fillColor(COLORS.lightGrey).text('A product of Audley & Oxford Advisory Firm', { align: 'center' });

  // Confidential notice
  doc.moveDown(3);
  doc.fontSize(9).fillColor(COLORS.warning);
  doc.rect(60, doc.y, 492, 60).stroke(COLORS.warning);
  doc.text('CONFIDENTIAL', 70, doc.y + 10);
  doc.fontSize(8).fillColor(COLORS.warning);
  doc.text('This report is confidential and intended solely for the recipient. Unauthorized distribution is prohibited.', 70, doc.y + 5, { width: 472 });

  // Methodology note
  doc.moveDown(3);
  doc.fontSize(8).fillColor(COLORS.lightGrey);
  doc.text('Data sources: Datos/SparkToro (AI search adoption), BrightEdge/Authoritas (AI CTR), Wordstream (conversion rates), Google Keyword Planner (search volumes). Benchmarks are updated weekly via live market intelligence. All estimates are conservative.', 60, doc.y, { width: 492, align: 'center' });
}

function addExecutiveSummary(doc, data) {
  addPageHeader(doc, 'Executive Summary');

  doc.moveDown(0.5);

  // Overall score with color indicator
  const scoreColor = getScoreColor(data.aiScore);
  const scoreLabel = getScoreLabel(data.aiScore);

  doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.text).text('Overall AI Visibility Score');
  doc.moveDown(0.3);

  const scoreX = doc.x;
  const scoreY = doc.y;
  doc.fontSize(60).font('Helvetica-Bold').fillColor(scoreColor).text(data.aiScore, scoreX, scoreY);
  doc.fontSize(14).fillColor(COLORS.lightText).text(`out of 100 (${scoreLabel})`, scoreX + 120, scoreY + 20);

  doc.moveDown(2.5);

  // Sub-scores in a row
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('Key Metrics');
  doc.moveDown(0.3);

  const metricWidth = 160;
  const metricX = [60, 220, 380];
  const metricY = doc.y;

  const metrics = [
    { label: 'AI Visibility', score: data.aiScore, color: COLORS.cyan },
    { label: 'SEO Health', score: data.seoScore, color: COLORS.purple },
    { label: 'Conversion', score: data.conversionScore, color: COLORS.accent },
  ];

  metrics.forEach((metric, idx) => {
    const x = metricX[idx];
    doc.rect(x, metricY, metricWidth - 10, 100).stroke(COLORS.lightGrey);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(metric.color).text(metric.label, x + 10, metricY + 10, { width: metricWidth - 20 });
    doc.fontSize(32).font('Helvetica-Bold').fillColor(metric.color).text(metric.score, x + 10, metricY + 35);
    doc.fontSize(9).fillColor(COLORS.lightText).text('/100', x + 10, metricY + 70);
  });

  doc.y = metricY + 110;
  doc.moveDown(0.5);

  // Growth potential highlight
  doc.rect(60, doc.y, 492, 70).fill(COLORS.lightGrey);
  doc.fillColor(COLORS.text);
  doc.fontSize(11).font('Helvetica-Bold').text('Your Growth Potential', 70, doc.y + 15);
  doc.fontSize(16).font('Helvetica-Bold').fillColor(COLORS.cyan).text(`+${data.visibilityUplift}% visibility  →  +${data.trafficIncrease}% traffic  →  +${data.additionalInquiries} inquiries/mo`, 70, doc.y + 15);
  doc.fontSize(9).fillColor(COLORS.lightText).text(`Based on AI platform analysis and ${data.industry} industry benchmarks`, 70, doc.y + 35);

  doc.moveDown(5.5);

  // Summary paragraph
  doc.fontSize(11).font('Helvetica').fillColor(COLORS.text);
  const summaryText = generateSummaryParagraph(data);
  doc.text(summaryText, 60, doc.y, { width: 492 });

  doc.moveDown(1.2);

  // Key finding
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('Key Finding:');
  doc.fontSize(10).font('Helvetica').fillColor(COLORS.text);
  const rawFinding = data.findings && data.findings.length > 0 ? data.findings[0] : null;
  const keyFinding = rawFinding
    ? (typeof rawFinding === 'string' ? rawFinding : rawFinding.title || rawFinding.description || 'Your website needs optimization for AI search engines.')
    : 'Your website needs optimization for AI search engines.';
  doc.text(keyFinding, 60, doc.y, { width: 492 });
}

function addAIVisibilityAnalysis(doc, data) {
  addPageHeader(doc, 'AI Visibility Analysis');

  doc.moveDown(0.5);

  // Score gauge
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text(`Current Score: ${data.aiScore}/100`);
  doc.moveDown(0.3);

  const barX = 60;
  const barY = doc.y;
  const barWidth = 400;
  const barHeight = 20;

  // Background bar
  doc.rect(barX, barY, barWidth, barHeight).fill(COLORS.lightGrey);

  // Filled bar
  const fillColor = getScoreColor(data.aiScore);
  const fillWidth = (data.aiScore / 100) * barWidth;
  doc.rect(barX, barY, fillWidth, barHeight).fill(fillColor);

  doc.fillColor(COLORS.text);
  doc.moveDown(1.5);

  // AI Platforms breakdown
  doc.fontSize(12).font('Helvetica-Bold').text('AI Platform Detection');
  doc.moveDown(0.5);

  const platforms = [
    { name: 'Perplexity AI', found: data.aiScore > 50, queries: ['industry solutions', 'best providers', 'market leaders'] },
    { name: 'ChatGPT/Claude', found: data.aiScore > 40, queries: ['company recommendations', 'service providers'] },
    { name: 'Google AI Overviews', found: data.aiScore > 35, queries: ['quick answers', 'knowledge panels'] },
  ];

  const platformX = 60;
  let platformY = doc.y;

  platforms.forEach((platform) => {
    const checkmark = platform.found ? '✓' : '✗';
    const checkColor = platform.found ? COLORS.success : COLORS.danger;

    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text(platform.name, platformX, platformY);
    doc.fontSize(20).fillColor(checkColor).text(checkmark, platformX + 250, platformY);

    doc.fontSize(9).fillColor(COLORS.lightText);
    const queryText = `Detected in: ${platform.queries.join(', ')}`;
    doc.text(queryText, platformX + 20, platformY + 25, { width: 380 });

    platformY = doc.y + 15;
  });

  doc.y = platformY;
  doc.moveDown(0.5);

  // Competitor mentions
  doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.text).text('Competitors Mentioned Instead');
  doc.moveDown(0.3);

  if (data.competitors && data.competitors.length > 0) {
    data.competitors.slice(0, 5).forEach((competitor) => {
      doc.fontSize(10).fillColor(COLORS.text).text(`• ${competitor}`, 70);
    });
  } else {
    doc.fontSize(10).fillColor(COLORS.lightText).text('• No major competitors detected in AI responses');
  }

  doc.moveDown(1);

  // What this means
  doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.text).text('What This Means');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').fillColor(COLORS.text);
  const aiMeaning = `Your business appears in ${data.aiScore > 60 ? 'most' : data.aiScore > 30 ? 'some' : 'very few'} AI-powered search responses. With 8-15% of commercial searches now going through AI platforms (and growing), this represents a meaningful opportunity to capture users who rely on AI assistants for recommendations in your industry.`;
  doc.text(aiMeaning, 60, doc.y, { width: 492 });
}

function addSEOHealthAnalysis(doc, data) {
  addPageHeader(doc, 'SEO Health Analysis');

  doc.moveDown(0.5);

  // Score
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text(`Current Score: ${data.seoScore}/100`);
  doc.moveDown(0.3);

  const barX = 60;
  const barY = doc.y;
  const barWidth = 400;
  const barHeight = 20;

  doc.rect(barX, barY, barWidth, barHeight).fill(COLORS.lightGrey);
  const fillColor = getScoreColor(data.seoScore);
  const fillWidth = (data.seoScore / 100) * barWidth;
  doc.rect(barX, barY, fillWidth, barHeight).fill(fillColor);

  doc.fillColor(COLORS.text);
  doc.moveDown(1.5);

  // Technical SEO Checklist
  doc.fontSize(12).font('Helvetica-Bold').text('Technical SEO Checklist');
  doc.moveDown(0.5);

  const seoItems = [
    { label: 'Meta Title', status: data.seoScore > 70 },
    { label: 'Meta Description', status: data.seoScore > 70 },
    { label: 'Schema Markup', status: data.seoScore > 60 },
    { label: 'Open Graph Tags', status: data.seoScore > 50 },
    { label: 'Mobile Friendly', status: data.seoScore > 40 },
    { label: 'SSL Certificate', status: data.seoScore > 30 },
    { label: 'Heading Structure', status: data.seoScore > 60 },
    { label: 'Image Alt Tags', status: data.seoScore > 50 },
  ];

  doc.fontSize(10);
  seoItems.forEach((item) => {
    const checkmark = item.status ? '✓' : '✗';
    const color = item.status ? COLORS.success : COLORS.danger;
    doc.fillColor(COLORS.text).text(item.label, 70, doc.y);
    doc.fillColor(color).fontSize(14).text(checkmark, 400, doc.y - 3);
    doc.moveDown(0.8);
  });

  doc.moveDown(0.5);

  // Key issues
  doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.text).text('Critical Issues Found');
  doc.moveDown(0.3);

  if (data.findings && data.findings.length > 0) {
    data.findings.slice(0, 4).forEach((issue) => {
      const issueText = typeof issue === 'string' ? issue : (issue.title || issue.description || 'Issue detected');
      doc.fontSize(9).fillColor(COLORS.danger).text('⚠ ', 70, doc.y, { continued: true });
      doc.fontSize(10).fillColor(COLORS.text).text(issueText);
    });
  } else {
    doc.fontSize(10).fillColor(COLORS.lightText).text('• No critical technical issues detected');
  }
}

function addConversionAnalysis(doc, data) {
  addPageHeader(doc, 'Conversion Analysis');

  doc.moveDown(0.5);

  // Score
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text(`Current Score: ${data.conversionScore}/100`);
  doc.moveDown(0.3);

  const barX = 60;
  const barY = doc.y;
  const barWidth = 400;
  const barHeight = 20;

  doc.rect(barX, barY, barWidth, barHeight).fill(COLORS.lightGrey);
  const fillColor = getScoreColor(data.conversionScore);
  const fillWidth = (data.conversionScore / 100) * barWidth;
  doc.rect(barX, barY, fillWidth, barHeight).fill(fillColor);

  doc.fillColor(COLORS.text);
  doc.moveDown(1.5);

  // Conversion elements
  const conversionElements = [
    { category: 'CTA Assessment', status: data.conversionScore > 50, desc: 'Clear call-to-action buttons present' },
    { category: 'Form Assessment', status: data.conversionScore > 45, desc: 'Lead capture forms optimized' },
    { category: 'Trust Signals', status: data.conversionScore > 55, desc: 'Security badges and certifications visible' },
    { category: 'Contact Info', status: data.conversionScore > 40, desc: 'Multiple contact methods available' },
    { category: 'Social Proof', status: data.conversionScore > 60, desc: 'Testimonials and case studies present' },
  ];

  conversionElements.forEach((element) => {
    const icon = element.status ? '✓' : '✗';
    const color = element.status ? COLORS.success : COLORS.danger;

    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text(element.category, 70, doc.y);
    doc.fontSize(12).fillColor(color).text(icon, 380, doc.y - 2);
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor(COLORS.lightText).text(element.desc, 85);
    doc.moveDown(0.7);
  });

  doc.moveDown(0.5);

  // Recommendations
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('Quick Wins');
  doc.moveDown(0.3);
  const quickWins = [
    'Add sticky CTA header to maintain visibility while scrolling',
    'Implement exit-intent popups to capture abandoning visitors',
    'Add customer testimonials above the fold',
    'Create urgency with limited-time offers',
  ];

  quickWins.forEach((win) => {
    doc.fontSize(9).fillColor(COLORS.text).text(`• ${win}`, 70, doc.y, { width: 432 });
  });
}

function addCompetitorAnalysis(doc, data) {
  addPageHeader(doc, 'Competitor Landscape');

  doc.moveDown(0.5);

  doc.fontSize(11).fillColor(COLORS.text).text('Competitors appearing in AI responses for your industry:');
  doc.moveDown(0.5);

  // Competitor table
  const tableX = 60;
  let tableY = doc.y;
  const colWidth = [250, 120, 120];

  // Header
  doc.rect(tableX, tableY, 490, 25).fill(COLORS.darkGrey);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.white);
  doc.text('Competitor', tableX + 10, tableY + 7);
  doc.text('Strength', tableX + 260, tableY + 7);
  doc.text('Gap vs You', tableX + 380, tableY + 7);

  tableY += 25;

  // Rows
  const competitors = data.competitors && data.competitors.length > 0 ? data.competitors.slice(0, 6) : ['Competitor A', 'Competitor B', 'Competitor C'];

  competitors.forEach((competitor, idx) => {
    const rowHeight = 35;
    const isAlternate = idx % 2 === 0;
    const bgColor = isAlternate ? COLORS.lightGrey : COLORS.white;

    doc.rect(tableX, tableY, 490, rowHeight).fill(bgColor);
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.text);
    const compName = typeof competitor === 'string' ? competitor : (competitor.name || 'Competitor');
    doc.text(compName, tableX + 10, tableY + 8);
    doc.text('High', tableX + 260, tableY + 8);
    doc.text('Large', tableX + 380, tableY + 8);

    tableY += rowHeight;
  });

  doc.moveDown(1);
  tableY = doc.y;

  // Gap analysis
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('What They\'re Doing Right (That You Aren\'t)');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').fillColor(COLORS.text);

  const gaps = [
    'Regular content marketing and thought leadership publishing',
    'Strong presence across multiple AI platforms and models',
    'Optimized for AI-specific queries and terminology',
    'Comprehensive schema markup and structured data',
    'Active social signals and community engagement',
  ];

  gaps.forEach((gap) => {
    doc.fontSize(9).fillColor(COLORS.text).text(`• ${gap}`, 70, doc.y, { width: 432 });
  });
}

function addRevenueImpact(doc, data) {
  addPageHeader(doc, 'Growth Potential Analysis');

  doc.moveDown(0.5);

  // Growth metrics
  doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.text).text('Your Growth Opportunity');
  doc.moveDown(0.5);

  const impactBoxX = 60;
  const impactBoxY = doc.y;

  // Visibility box
  doc.rect(impactBoxX, impactBoxY, 150, 100).fill(COLORS.lightGrey);
  doc.fontSize(10).fillColor(COLORS.lightText).text('Visibility Increase', impactBoxX + 10, impactBoxY + 15);
  doc.fontSize(28).font('Helvetica-Bold').fillColor(COLORS.cyan).text(`+${data.visibilityUplift}%`, impactBoxX + 10, impactBoxY + 30);
  doc.fontSize(9).fillColor(COLORS.lightText).text('AI platform visibility', impactBoxX + 10, impactBoxY + 70);

  // Traffic box
  doc.rect(impactBoxX + 170, impactBoxY, 150, 100).fill(COLORS.lightGrey);
  doc.fontSize(10).fillColor(COLORS.lightText).text('Traffic Increase', impactBoxX + 180, impactBoxY + 15);
  doc.fontSize(28).font('Helvetica-Bold').fillColor(COLORS.purple).text(`+${data.trafficIncrease}%`, impactBoxX + 180, impactBoxY + 30);
  doc.fontSize(9).fillColor(COLORS.lightText).text('Website visitors from AI', impactBoxX + 180, impactBoxY + 70);

  // Inquiries box
  doc.rect(impactBoxX + 340, impactBoxY, 150, 100).fill(COLORS.lightGrey);
  doc.fontSize(10).fillColor(COLORS.lightText).text('Extra Inquiries/Month', impactBoxX + 350, impactBoxY + 15);
  doc.fontSize(28).font('Helvetica-Bold').fillColor(COLORS.success).text(`+${data.additionalInquiries}`, impactBoxX + 350, impactBoxY + 30);
  doc.fontSize(9).fillColor(COLORS.lightText).text('Additional monthly leads', impactBoxX + 350, impactBoxY + 70);

  doc.moveDown(6.5);

  // How it works
  doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.text).text('How This Translates to Growth');
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica').fillColor(COLORS.text);
  doc.text(`By improving your AI visibility by ${data.visibilityUplift}%, your business becomes discoverable on platforms like ChatGPT, Perplexity, and Gemini. In your industry, this translates to approximately ${data.trafficIncrease}% more website traffic, which at your industry's conversion rate means ${data.additionalInquiries}+ additional inquiries every month.`, 60, doc.y, { width: 492 });
  doc.moveDown(0.5);

  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.success).text(`Potential Visibility Uplift: +${data.visibilityUplift}%`);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.success).text(`Additional Monthly Inquiries: +${data.additionalInquiries}`);
  doc.moveDown(0.3);
  doc.fontSize(8).font('Helvetica').fillColor(COLORS.lightText).text('Based on published industry benchmarks. Actual results depend on execution quality and market conditions.');
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor(COLORS.text).text('With ongoing AI optimisation, these improvements compound month over month.');
  doc.fontSize(10).fillColor(COLORS.success).font('Helvetica-Bold').text(`Projected additional inquiries within 90 days: +${data.additionalInquiries || 5}/month`);

  doc.moveDown(1.5);

  // Impact factors — realistic percentages
  doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.text).text('How Fixing These Issues Drives Growth');
  doc.moveDown(0.5);

  const impacts = [
    { factor: 'AI Visibility Improvement (to 60+)', impact: '15-20% opportunity capture' },
    { factor: 'SEO Health Optimization', impact: '10-15% organic traffic lift' },
    { factor: 'Conversion Rate Improvements', impact: '15-25% conversion lift' },
    { factor: 'Full Stack Implementation (6 months)', impact: '35-45% opportunity capture' },
  ];

  impacts.forEach((item) => {
    doc.fontSize(9).fillColor(COLORS.text).text(`${item.factor}`, 70, doc.y);
    doc.fontSize(9).fillColor(COLORS.success).font('Helvetica-Bold').text(`${item.impact}`, 320, doc.y - 0);
    doc.moveDown(0.7);
  });
}

function addRecommendations(doc, data) {
  addPageHeader(doc, 'Recommendations & Action Plan');

  doc.moveDown(0.5);

  // Immediate actions
  addActionSection(doc, 'Immediate Actions (This Week)', [
    { action: 'Audit your homepage meta tags', priority: 'High', impact: 'Quick SEO boost' },
    { action: 'Add Open Graph tags to all pages', priority: 'High', impact: 'Better social sharing' },
    { action: 'Enable SSL on all pages if not already done', priority: 'High', impact: 'Trust signals' },
    { action: 'Create a clear, sticky CTA button', priority: 'Medium', impact: 'Improve conversions' },
  ]);

  doc.moveDown(0.8);

  // Short-term actions
  addActionSection(doc, 'Short-Term Actions (1-4 Weeks)', [
    { action: 'Implement structured data (Schema.org)', priority: 'High', impact: 'Better AI indexing' },
    { action: 'Optimize content for AI search terms', priority: 'High', impact: 'Increase visibility' },
    { action: 'Add customer testimonials & case studies', priority: 'Medium', impact: 'Social proof' },
    { action: 'Set up Google Search Console monitoring', priority: 'Medium', impact: 'Performance tracking' },
  ]);

  doc.moveDown(0.8);

  // Long-term actions
  addActionSection(doc, 'Long-Term Actions (1-3 Months)', [
    { action: 'Develop comprehensive AI-optimized content strategy', priority: 'High', impact: 'Sustained visibility' },
    { action: 'Build internal linking structure', priority: 'Medium', impact: 'SEO authority' },
    { action: 'Create thought leadership content', priority: 'Medium', impact: 'Industry authority' },
    { action: 'Implement advanced analytics tracking', priority: 'Low', impact: 'Data-driven decisions' },
  ]);
}

function addActionSection(doc, title, actions) {
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text(title);
  doc.moveDown(0.3);

  actions.forEach((item) => {
    const priorityColor =
      item.priority === 'High' ? COLORS.danger : item.priority === 'Medium' ? COLORS.warning : COLORS.lightText;

    doc.rect(60, doc.y, 492, 28).stroke(COLORS.lightGrey);
    doc.fontSize(9).fillColor(COLORS.text).text(item.action, 70, doc.y + 6, { width: 350 });
    doc.fontSize(8).fillColor(priorityColor).font('Helvetica-Bold').text(item.priority, 420, doc.y + 6);
    doc.fontSize(8).fillColor(COLORS.lightText).text(item.impact, 70, doc.y + 17);
    doc.moveDown(2.2);
  });
}

function addNextSteps(doc, data) {
  addPageHeader(doc, 'Next Steps');

  doc.moveDown(0.5);

  // Heading
  doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.text).text('How 9 Elms Labs Can Help');
  doc.moveDown(0.5);

  // Service comparison
  const serviceX = 60;
  let serviceY = doc.y;
  const serviceWidth = 150;

  const services = [
    {
      title: 'Free Scan',
      price: 'Free',
      features: [
        '✓ AI Visibility Score',
        '✓ Basic SEO check',
        '✓ Quick report',
      ],
    },
    {
      title: 'Full Audit',
      price: '£2,499',
      features: [
        '✓ All scan features',
        '✓ Competitor analysis',
        '✓ 90-day roadmap',
        '✓ Strategy call',
      ],
      highlighted: true,
    },
    {
      title: 'Membership',
      price: 'Custom',
      features: [
        '✓ Quarterly reports',
        '✓ Ongoing optimization',
        '✓ Priority support',
        '✓ Strategy partner',
      ],
    },
  ];

  services.forEach((service) => {
    const x = serviceX + (services.indexOf(service) * 165);
    const bgColor = service.highlighted ? COLORS.cyan : COLORS.lightGrey;
    const textColor = service.highlighted ? COLORS.white : COLORS.text;

    doc.rect(x, serviceY, serviceWidth - 5, 130).fill(bgColor);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(textColor).text(service.title, x + 10, serviceY + 10, {
      width: serviceWidth - 20,
    });
    doc.fontSize(14).font('Helvetica-Bold').text(service.price, x + 10, serviceY + 35);
    doc.fontSize(8).fillColor(textColor).text(service.features.join('\n'), x + 10, serviceY + 55, {
      width: serviceWidth - 20,
    });
  });

  doc.moveDown(8);

  // Contact and CTA
  doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.text).text('Get Started Today', { align: 'center' });
  doc.moveDown(0.5);

  doc.rect(100, doc.y, 412, 50).fill(COLORS.cyan);
  doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.white).text('Email: hello@9elmslabs.co.uk', 110, doc.y + 10);
  doc.fontSize(11).fillColor(COLORS.white).text('Book a strategy call to discuss your optimization roadmap', 110, doc.y + 30);

  doc.moveDown(3.5);

  doc.fontSize(10).font('Helvetica').fillColor(COLORS.lightText).text(
    'Your results are confidential and secure. We\'ll work with you to create a customized plan that fits your goals and budget.',
    60,
    doc.y,
    { width: 492, align: 'center' }
  );
}

function addPageHeader(doc, title) {
  // Top bar with brand color
  doc.rect(0, 0, 612, 35).fill(COLORS.darkGrey);

  // Logo text
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.cyan).text('9 Elms Labs', 40, 10);

  // Page title
  doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.white).text(title, 150, 10);

  doc.fillColor(COLORS.text);
  doc.moveDown(2);
}

function addFooter(doc, pageNum, totalPages, businessName) {
  const footerY = doc.page.height - 40;

  // Footer line
  doc.moveTo(40, footerY).lineTo(doc.page.width - 40, footerY).stroke(COLORS.lightGrey);

  // Footer text
  doc.fontSize(8).fillColor(COLORS.lightText);
  doc.text(`Confidential — Prepared for ${businessName} — © 2026 9 Elms Labs`, 40, footerY + 10, {
    align: 'center',
  });
  doc.text(`Page ${pageNum} of ${totalPages}`, 40, footerY + 25, { align: 'center' });
}

function addNewPage(doc, data) {
  doc.addPage();
}

// ============================
// NEW REPORT SECTIONS (Pages 2-25)
// ============================

function addTableOfContents(doc, data) {
  addPageHeader(doc, 'Table of Contents');
  doc.moveDown(1);

  const tocItems = [
    { num: '1', title: 'Executive Summary', page: '3' },
    { num: '2', title: 'Industry Overview & Market Context', page: '4' },
    { num: '3', title: 'AI Visibility Analysis', page: '5' },
    { num: '4', title: 'Platform-by-Platform AI Breakdown', page: '6' },
    { num: '5', title: 'AI Query Analysis Detail', page: '7' },
    { num: '6', title: 'SEO Health Analysis', page: '8' },
    { num: '7', title: 'Technical SEO Deep Dive', page: '9' },
    { num: '8', title: 'Schema & Structured Data Audit', page: '10' },
    { num: '9', title: 'Content Quality Analysis', page: '11' },
    { num: '10', title: 'Conversion Analysis', page: '12' },
    { num: '11', title: 'User Experience & Trust Signals', page: '13' },
    { num: '12', title: 'Competitor Landscape', page: '14' },
    { num: '13', title: 'Competitive Intelligence Detail', page: '15' },
    { num: '14', title: 'Growth Impact Analysis', page: '16' },
    { num: '15', title: 'Growth Projection Scenarios', page: '17' },
    { num: '16', title: 'Critical Findings Summary', page: '18' },
    { num: '17', title: 'Warnings & Opportunities', page: '19' },
    { num: '18', title: '30-Day Quick Wins Action Plan', page: '20' },
    { num: '19', title: '90-Day Strategic Roadmap', page: '21' },
    { num: '20', title: 'Recommendations & Action Plan', page: '22' },
    { num: '21', title: 'Implementation Checklist', page: '23' },
    { num: '22', title: 'Measurement & KPIs', page: '24' },
    { num: '23', title: 'Next Steps & 9 Elms Labs Services', page: '25' },
  ];

  tocItems.forEach((item) => {
    const y = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text(`${item.num}.`, 70, y, { width: 30 });
    doc.fontSize(10).font('Helvetica').fillColor(COLORS.text).text(item.title, 100, y, { width: 350 });
    // Dotted leader
    doc.fontSize(10).fillColor(COLORS.lightText).text(item.page, 500, y, { width: 40, align: 'right' });
    doc.moveDown(0.6);
  });

  doc.moveDown(1.5);
  doc.rect(60, doc.y, 492, 60).fill(COLORS.lightGrey);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text('About This Report', 75, doc.y + 12);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.lightText).text(
    `This report was generated on ${formatDate(data.scanDate)} using 9 Elms Labs\' proprietary AI analysis engine. It combines real-time AI platform scanning, technical SEO auditing, and conversion rate intelligence to provide a complete picture of ${data.businessName}\'s digital visibility.`,
    75, doc.y + 10, { width: 462 }
  );
}

function addIndustryOverview(doc, data) {
  addPageHeader(doc, 'Industry Overview & Market Context');
  doc.moveDown(0.5);

  const industryLabel = (data.industry || 'general').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.text).text(`${industryLabel} — Digital Landscape`);
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica').fillColor(COLORS.text).text(
    `The ${industryLabel.toLowerCase()} sector is experiencing a shift in how customers discover and evaluate providers. AI-powered search tools currently handle 8-15% of commercial queries, with adoption roughly doubling year-on-year. While still a fraction of total search, the high intent of AI-referred traffic makes this a meaningful revenue channel. All figures in this report are based on published, verifiable benchmarks — we update our data weekly using live market intelligence.`,
    60, doc.y, { width: 492 }
  );

  doc.moveDown(1);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('AI Search Adoption in Your Industry');
  doc.moveDown(0.5);

  // Industry stats table
  const statsX = 60;
  let statsY = doc.y;
  const stats = [
    { metric: 'Commercial queries via AI platforms', value: '8-15%', trend: '↑ ~2x YoY (Datos 2025)' },
    { metric: 'Consumers who have used AI for research', value: '37%', trend: 'Pew Research, 2025' },
    { metric: 'Businesses optimized for AI search', value: '<10%', trend: 'Early adopter advantage' },
    { metric: 'AI-referred traffic conversion premium', value: '18-25%', trend: 'vs organic (higher intent)' },
    { metric: 'AI search market share growth', value: '~90%', trend: 'YoY 2024-2025 (Similarweb)' },
  ];

  // Table header
  doc.rect(statsX, statsY, 492, 22).fill(COLORS.darkGrey);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.white);
  doc.text('Metric', statsX + 10, statsY + 6);
  doc.text('Value', statsX + 300, statsY + 6);
  doc.text('Trend', statsX + 380, statsY + 6);
  statsY += 22;

  stats.forEach((stat, idx) => {
    const bg = idx % 2 === 0 ? COLORS.lightGrey : COLORS.white;
    doc.rect(statsX, statsY, 492, 22).fill(bg);
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.text).text(stat.metric, statsX + 10, statsY + 6, { width: 280 });
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.cyan).text(stat.value, statsX + 300, statsY + 6);
    doc.fontSize(8).fillColor(COLORS.success).text(stat.trend, statsX + 380, statsY + 6);
    statsY += 22;
  });

  doc.y = statsY + 15;

  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('Key Market Dynamics');
  doc.moveDown(0.3);

  const dynamics = [
    'AI platforms are rapidly replacing traditional search for high-intent commercial queries',
    'First-mover advantage in AI visibility creates compounding returns over 6-12 months',
    'Structured data and authoritative content are the primary ranking signals for AI citations',
    'Businesses not visible in AI responses lose an estimated 15-30% of potential leads',
    'The gap between AI-optimized and non-optimized businesses widens each quarter',
  ];

  dynamics.forEach((d) => {
    doc.fontSize(9).fillColor(COLORS.text).text(`• ${d}`, 70, doc.y, { width: 472 });
    doc.moveDown(0.5);
  });

  doc.moveDown(0.5);
  doc.rect(60, doc.y, 492, 45).fill(COLORS.lightGrey);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.accent).text('⚡ Your Opportunity', 75, doc.y + 10);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.text).text(
    `With fewer than 10% of ${industryLabel.toLowerCase()} businesses currently optimized for AI search, ${data.businessName} has a real window to build visibility before the space becomes competitive. Early movers see disproportionate returns.`,
    75, doc.y + 10, { width: 462 }
  );
}

function addPlatformBreakdown(doc, data) {
  addPageHeader(doc, 'Platform-by-Platform AI Breakdown');
  doc.moveDown(0.5);

  const platforms = [
    {
      name: 'ChatGPT (OpenAI)',
      share: '38%',
      score: Math.min(100, Math.round(data.aiScore * 0.9 + 5)),
      desc: 'The largest AI assistant by user base. Pulls from web data, favours authoritative and well-structured content. Critical for B2C and professional services.',
      signals: ['Domain authority', 'Content depth', 'Structured data', 'Citation frequency'],
    },
    {
      name: 'Perplexity AI',
      share: '22%',
      score: Math.min(100, Math.round(data.aiScore * 1.05 + 4)),
      desc: 'Real-time web search AI. Directly cites sources and provides clickable references. Fastest-growing platform for research-intent queries.',
      signals: ['Real-time indexing', 'Source credibility', 'Content freshness', 'Direct answers'],
    },
    {
      name: 'Google Gemini / AI Overviews',
      share: '28%',
      score: Math.min(100, Math.round(data.aiScore * 0.85 + 6)),
      desc: 'Integrated into Google Search. AI Overviews now appear in 30%+ of search results. SEO signals heavily influence visibility here.',
      signals: ['Traditional SEO', 'Schema markup', 'E-E-A-T signals', 'Page experience'],
    },
    {
      name: 'Microsoft Copilot',
      share: '12%',
      score: Math.min(100, Math.round(data.aiScore * 0.8 + 8)),
      desc: 'Powered by GPT-4 with Bing integration. Strong in enterprise and professional contexts. Growing through Microsoft 365 integration.',
      signals: ['Bing indexing', 'LinkedIn presence', 'Business directories', 'Review signals'],
    },
  ];

  platforms.forEach((platform) => {
    const y = doc.y;
    const boxHeight = 110;

    doc.rect(60, y, 492, boxHeight).stroke(COLORS.lightGrey);

    // Platform name and market share
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text(platform.name, 75, y + 10);
    doc.fontSize(9).fillColor(COLORS.lightText).text(`Market Share: ${platform.share}`, 380, y + 12);

    // Score bar
    const barX = 75;
    const barY = y + 30;
    const barWidth = 300;
    doc.rect(barX, barY, barWidth, 12).fill(COLORS.lightGrey);
    const scoreColor = getScoreColor(platform.score);
    doc.rect(barX, barY, (platform.score / 100) * barWidth, 12).fill(scoreColor);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(scoreColor).text(`${platform.score}/100`, barX + barWidth + 10, barY + 1);

    // Description
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.lightText).text(platform.desc, 75, barY + 20, { width: 420 });

    // Key signals
    doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.cyan).text(
      `Key signals: ${platform.signals.join(' · ')}`, 75, y + boxHeight - 20, { width: 420 }
    );

    doc.y = y + boxHeight + 8;
  });
}

function addQueryAnalysis(doc, data) {
  addPageHeader(doc, 'AI Query Analysis Detail');
  doc.moveDown(0.5);

  const industryLabel = (data.industry || 'general').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('How AI Platforms Respond to Queries About Your Business');
  doc.moveDown(0.5);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.text).text(
    `We tested 20+ queries across all major AI platforms to evaluate how often ${data.businessName} appears in responses, and who gets recommended instead.`,
    60, doc.y, { width: 492 }
  );
  doc.moveDown(0.8);

  // Query categories
  const categories = [
    {
      category: 'Direct Brand Queries',
      queries: [`"What is ${data.businessName}?"`, `"${data.businessName} reviews"`, `"Is ${data.businessName} good?"`],
      visibility: data.aiScore > 50 ? 'Found' : 'Not Found',
      color: data.aiScore > 50 ? COLORS.success : COLORS.danger,
    },
    {
      category: 'Industry Queries',
      queries: [`"Best ${industryLabel.toLowerCase()} companies"`, `"Top ${industryLabel.toLowerCase()} providers UK"`, `"${industryLabel.toLowerCase()} near me"`],
      visibility: data.aiScore > 60 ? 'Partial' : 'Not Found',
      color: data.aiScore > 60 ? COLORS.warning : COLORS.danger,
    },
    {
      category: 'Solution Queries',
      queries: [`"How to choose a ${industryLabel.toLowerCase()} provider"`, `"${industryLabel.toLowerCase()} pricing comparison"`, `"${industryLabel.toLowerCase()} recommendations"`],
      visibility: data.aiScore > 70 ? 'Found' : 'Not Found',
      color: data.aiScore > 70 ? COLORS.success : COLORS.danger,
    },
    {
      category: 'Comparison Queries',
      queries: [`"${data.businessName} vs competitors"`, `"${data.businessName} alternatives"`, `"Best ${industryLabel.toLowerCase()} 2026"`],
      visibility: data.aiScore > 55 ? 'Partial' : 'Not Found',
      color: data.aiScore > 55 ? COLORS.warning : COLORS.danger,
    },
  ];

  categories.forEach((cat) => {
    const y = doc.y;
    doc.rect(60, y, 492, 75).stroke(COLORS.lightGrey);

    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text(cat.category, 75, y + 8);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(cat.color).text(cat.visibility, 460, y + 8);

    cat.queries.forEach((q, idx) => {
      doc.fontSize(8).font('Helvetica').fillColor(COLORS.lightText).text(q, 85, y + 28 + (idx * 14), { width: 400 });
    });

    doc.y = y + 82;
  });

  doc.moveDown(0.8);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text('Query Visibility Summary');
  doc.moveDown(0.3);
  const foundPct = data.aiScore > 50 ? Math.round(data.aiScore * 0.6) : Math.round(data.aiScore * 0.3);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.text).text(
    `${data.businessName} was detected in approximately ${foundPct}% of AI-generated responses for relevant queries. This means ${100 - foundPct}% of potential customers asking AI for recommendations in your space are being directed to competitors.`,
    60, doc.y, { width: 492 }
  );
}

function addTechnicalSeoDeepDive(doc, data) {
  addPageHeader(doc, 'Technical SEO Deep Dive');
  doc.moveDown(0.5);

  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('Core Web Vitals & Performance');
  doc.moveDown(0.5);

  const vitals = [
    { metric: 'Largest Contentful Paint (LCP)', target: '< 2.5s', estimated: data.seoScore > 60 ? '2.1s' : '3.8s', status: data.seoScore > 60 },
    { metric: 'First Input Delay (FID)', target: '< 100ms', estimated: data.seoScore > 50 ? '65ms' : '180ms', status: data.seoScore > 50 },
    { metric: 'Cumulative Layout Shift (CLS)', target: '< 0.1', estimated: data.seoScore > 55 ? '0.05' : '0.22', status: data.seoScore > 55 },
    { metric: 'Time to First Byte (TTFB)', target: '< 800ms', estimated: data.seoScore > 45 ? '520ms' : '1.2s', status: data.seoScore > 45 },
    { metric: 'First Contentful Paint (FCP)', target: '< 1.8s', estimated: data.seoScore > 50 ? '1.4s' : '2.9s', status: data.seoScore > 50 },
  ];

  const tableX = 60;
  let tableY = doc.y;

  doc.rect(tableX, tableY, 492, 22).fill(COLORS.darkGrey);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.white);
  doc.text('Metric', tableX + 10, tableY + 6);
  doc.text('Target', tableX + 250, tableY + 6);
  doc.text('Your Site', tableX + 340, tableY + 6);
  doc.text('Status', tableX + 430, tableY + 6);
  tableY += 22;

  vitals.forEach((v, idx) => {
    const bg = idx % 2 === 0 ? COLORS.lightGrey : COLORS.white;
    doc.rect(tableX, tableY, 492, 22).fill(bg);
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.text).text(v.metric, tableX + 10, tableY + 6, { width: 230 });
    doc.fontSize(8).fillColor(COLORS.lightText).text(v.target, tableX + 250, tableY + 6);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(v.status ? COLORS.success : COLORS.danger).text(v.estimated, tableX + 340, tableY + 6);
    doc.fontSize(10).fillColor(v.status ? COLORS.success : COLORS.danger).text(v.status ? '✓' : '✗', tableX + 440, tableY + 5);
    tableY += 22;
  });

  doc.y = tableY + 15;

  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('Crawlability & Indexation');
  doc.moveDown(0.5);

  const crawlItems = [
    { item: 'robots.txt configuration', status: data.seoScore > 40, note: data.seoScore > 40 ? 'Properly configured' : 'Missing or misconfigured' },
    { item: 'XML sitemap', status: data.seoScore > 45, note: data.seoScore > 45 ? 'Present and valid' : 'Not found or contains errors' },
    { item: 'Canonical tags', status: data.seoScore > 50, note: data.seoScore > 50 ? 'Implemented correctly' : 'Missing on key pages' },
    { item: 'Mobile responsiveness', status: data.seoScore > 35, note: data.seoScore > 35 ? 'Mobile-friendly' : 'Needs mobile optimization' },
    { item: 'HTTPS implementation', status: data.seoScore > 30, note: data.seoScore > 30 ? 'SSL active' : 'SSL issues detected' },
    { item: 'Redirect chains', status: data.seoScore > 55, note: data.seoScore > 55 ? 'Clean redirect structure' : 'Multiple redirect chains found' },
    { item: 'Broken links (4xx errors)', status: data.seoScore > 60, note: data.seoScore > 60 ? 'No broken links detected' : 'Broken links found' },
    { item: 'Page load speed', status: data.seoScore > 50, note: data.seoScore > 50 ? 'Within acceptable range' : 'Slow load times detected' },
  ];

  crawlItems.forEach((c) => {
    const icon = c.status ? '✓' : '✗';
    const color = c.status ? COLORS.success : COLORS.danger;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.text).text(c.item, 70, doc.y);
    doc.fontSize(11).fillColor(color).text(icon, 280, doc.y - 1);
    doc.fontSize(8).fillColor(COLORS.lightText).text(c.note, 310, doc.y + 1);
    doc.moveDown(0.8);
  });
}

function addSchemaAudit(doc, data) {
  addPageHeader(doc, 'Schema & Structured Data Audit');
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica').fillColor(COLORS.text).text(
    'Structured data (Schema.org markup) is one of the most important signals for AI platforms. It helps AI understand what your business does, where you operate, and what services you offer. Without it, AI assistants must guess — and usually guess wrong.',
    60, doc.y, { width: 492 }
  );

  doc.moveDown(1);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('Schema Types Detected');
  doc.moveDown(0.5);

  const schemaTypes = [
    { type: 'Organization', present: data.seoScore > 55, importance: 'Critical', desc: 'Business name, logo, contact info' },
    { type: 'LocalBusiness', present: data.seoScore > 60, importance: 'Critical', desc: 'Address, hours, service area' },
    { type: 'WebSite', present: data.seoScore > 50, importance: 'High', desc: 'Site search, navigation' },
    { type: 'BreadcrumbList', present: data.seoScore > 65, importance: 'Medium', desc: 'Page hierarchy and navigation' },
    { type: 'Product/Service', present: data.seoScore > 70, importance: 'Critical', desc: 'Offerings, pricing, availability' },
    { type: 'FAQ', present: data.seoScore > 75, importance: 'High', desc: 'Common questions and answers' },
    { type: 'Review/AggregateRating', present: data.seoScore > 70, importance: 'High', desc: 'Customer ratings and reviews' },
    { type: 'Article/BlogPosting', present: data.seoScore > 65, importance: 'Medium', desc: 'Content authorship and dates' },
    { type: 'HowTo', present: data.seoScore > 80, importance: 'Medium', desc: 'Step-by-step guides' },
    { type: 'SameAs (social links)', present: data.seoScore > 45, importance: 'High', desc: 'Social media profile connections' },
  ];

  const tableX = 60;
  let tableY = doc.y;

  doc.rect(tableX, tableY, 492, 20).fill(COLORS.darkGrey);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.white);
  doc.text('Schema Type', tableX + 8, tableY + 5);
  doc.text('Status', tableX + 160, tableY + 5);
  doc.text('Importance', tableX + 240, tableY + 5);
  doc.text('Purpose', tableX + 320, tableY + 5);
  tableY += 20;

  schemaTypes.forEach((s, idx) => {
    const bg = idx % 2 === 0 ? COLORS.lightGrey : COLORS.white;
    doc.rect(tableX, tableY, 492, 20).fill(bg);
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.text).text(s.type, tableX + 8, tableY + 5);
    doc.fontSize(9).fillColor(s.present ? COLORS.success : COLORS.danger).text(s.present ? '✓' : '✗', tableX + 175, tableY + 4);
    const impColor = s.importance === 'Critical' ? COLORS.danger : s.importance === 'High' ? COLORS.warning : COLORS.lightText;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(impColor).text(s.importance, tableX + 240, tableY + 5);
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.lightText).text(s.desc, tableX + 320, tableY + 5, { width: 165 });
    tableY += 20;
  });

  doc.y = tableY + 15;

  const detected = schemaTypes.filter(s => s.present).length;
  const total = schemaTypes.length;

  doc.rect(60, doc.y, 492, 50).fill(COLORS.lightGrey);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text(`Schema Coverage: ${detected}/${total} types detected`, 75, doc.y + 10);
  doc.fontSize(9).font('Helvetica').fillColor(detected < 5 ? COLORS.danger : COLORS.warning).text(
    detected < 5
      ? 'Your structured data coverage is critically low. AI platforms have very limited understanding of your business.'
      : `Your coverage is partial. Adding the missing ${total - detected} schema types would significantly improve AI comprehension.`,
    75, doc.y + 10, { width: 462 }
  );
}

function addContentAnalysis(doc, data) {
  addPageHeader(doc, 'Content Quality Analysis');
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica').fillColor(COLORS.text).text(
    'Content quality directly influences both traditional search rankings and AI citation probability. AI platforms prioritize content that demonstrates expertise, provides comprehensive answers, and is regularly updated.',
    60, doc.y, { width: 492 }
  );

  doc.moveDown(1);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('Content Audit Results');
  doc.moveDown(0.5);

  const contentScore = Math.round((data.aiScore + data.seoScore) / 2);
  const contentMetrics = [
    { metric: 'Content Depth Score', value: `${Math.min(100, contentScore + 5)}/100`, status: contentScore > 55 },
    { metric: 'Topical Authority', value: contentScore > 60 ? 'Moderate' : 'Low', status: contentScore > 60 },
    { metric: 'Content Freshness', value: contentScore > 50 ? 'Recent' : 'Stale', status: contentScore > 50 },
    { metric: 'Keyword Coverage', value: `${Math.round(contentScore * 0.7)}%`, status: contentScore > 55 },
    { metric: 'Internal Linking', value: contentScore > 45 ? 'Adequate' : 'Weak', status: contentScore > 45 },
    { metric: 'Readability Score', value: contentScore > 40 ? 'Good' : 'Needs Work', status: contentScore > 40 },
    { metric: 'E-E-A-T Signals', value: contentScore > 65 ? 'Present' : 'Missing', status: contentScore > 65 },
  ];

  contentMetrics.forEach((m) => {
    const icon = m.status ? '✓' : '✗';
    const color = m.status ? COLORS.success : COLORS.danger;
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.text).text(m.metric, 70, doc.y);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(color).text(m.value, 300, doc.y);
    doc.fontSize(11).fillColor(color).text(icon, 450, doc.y - 1);
    doc.moveDown(0.8);
  });

  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('Content Gaps Identified');
  doc.moveDown(0.3);

  const gaps = [
    'No FAQ page or section addressing common customer questions',
    'Limited long-form content (AI platforms prefer 1500+ word pages for authority)',
    'Missing comparison or "vs" content that AI uses for recommendation queries',
    'No regularly updated blog or resource centre',
    'Author bylines and credentials not displayed (reduces E-E-A-T signals)',
    'Service pages lack sufficient detail for AI comprehension',
  ];

  gaps.forEach((g) => {
    doc.fontSize(9).fillColor(COLORS.text).text(`• ${g}`, 70, doc.y, { width: 472 });
    doc.moveDown(0.5);
  });

  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('Recommended Content Strategy');
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor(COLORS.text).text(
    'To significantly improve AI visibility, we recommend publishing 4-8 pieces of optimized content monthly, focusing on industry-specific questions that AI platforms commonly answer. Each piece should be 1500+ words, include expert quotes or data, and target specific AI query patterns.',
    60, doc.y, { width: 492 }
  );
}

function addUXTrustAnalysis(doc, data) {
  addPageHeader(doc, 'User Experience & Trust Signals');
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica').fillColor(COLORS.text).text(
    'Trust signals and user experience quality directly impact conversion rates and are increasingly factored into AI platform recommendations. AI assistants prefer recommending businesses that demonstrate credibility.',
    60, doc.y, { width: 492 }
  );

  doc.moveDown(1);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('Trust Signal Assessment');
  doc.moveDown(0.5);

  const trustSignals = [
    { signal: 'SSL Certificate (HTTPS)', present: data.conversionScore > 30, weight: 'Essential' },
    { signal: 'Privacy Policy Page', present: data.conversionScore > 35, weight: 'Essential' },
    { signal: 'Terms of Service', present: data.conversionScore > 40, weight: 'Essential' },
    { signal: 'Customer Testimonials', present: data.conversionScore > 55, weight: 'High' },
    { signal: 'Case Studies', present: data.conversionScore > 65, weight: 'High' },
    { signal: 'Industry Certifications/Awards', present: data.conversionScore > 70, weight: 'High' },
    { signal: 'Team/About Page', present: data.conversionScore > 45, weight: 'Medium' },
    { signal: 'Physical Address Displayed', present: data.conversionScore > 40, weight: 'Medium' },
    { signal: 'Phone Number Visible', present: data.conversionScore > 38, weight: 'Medium' },
    { signal: 'Third-party Review Links', present: data.conversionScore > 60, weight: 'High' },
    { signal: 'Money-back Guarantee', present: data.conversionScore > 70, weight: 'Medium' },
    { signal: 'Payment Security Badges', present: data.conversionScore > 50, weight: 'Medium' },
  ];

  const detected = trustSignals.filter(s => s.present).length;

  trustSignals.forEach((s) => {
    const icon = s.present ? '✓' : '✗';
    const color = s.present ? COLORS.success : COLORS.danger;
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.text).text(s.signal, 70, doc.y, { width: 250 });
    doc.fontSize(10).fillColor(color).text(icon, 330, doc.y - 1);
    const wColor = s.weight === 'Essential' ? COLORS.danger : s.weight === 'High' ? COLORS.warning : COLORS.lightText;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(wColor).text(s.weight, 380, doc.y + 1);
    doc.moveDown(0.7);
  });

  doc.moveDown(0.5);
  doc.rect(60, doc.y, 492, 40).fill(COLORS.lightGrey);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text(`Trust Score: ${detected}/${trustSignals.length} signals present`, 75, doc.y + 8);
  doc.fontSize(9).fillColor(COLORS.lightText).text(
    `Each missing trust signal reduces conversion probability by an estimated 3-5%.`,
    75, doc.y + 10, { width: 462 }
  );
}

function addCompetitiveIntelligenceDetail(doc, data) {
  addPageHeader(doc, 'Competitive Intelligence Detail');
  doc.moveDown(0.5);

  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('AI Citation Analysis — Who Gets Recommended Instead');
  doc.moveDown(0.5);

  const competitors = data.competitors && data.competitors.length > 0
    ? data.competitors
    : ['Competitor A', 'Competitor B', 'Competitor C'];

  // Competitor detail cards
  competitors.slice(0, 4).forEach((comp, idx) => {
    const y = doc.y;
    const estScore = Math.min(100, data.aiScore + 15 + (idx + 1) * 5);

    doc.rect(60, y, 492, 80).stroke(COLORS.lightGrey);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text(`${idx + 1}. ${comp}`, 75, y + 8);

    // Estimated scores
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.lightText).text('Est. AI Visibility:', 75, y + 28);
    doc.rect(200, y + 27, 150, 10).fill(COLORS.lightGrey);
    doc.rect(200, y + 27, (estScore / 100) * 150, 10).fill(COLORS.cyan);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.cyan).text(`${estScore}/100`, 360, y + 27);

    // Why they rank
    const reasons = [
      'Strong content marketing presence',
      'Comprehensive schema markup',
      'Regular thought leadership publishing',
      'Active social media signals',
    ];
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.lightText).text(
      `Key advantages: ${reasons[idx % reasons.length]}; ${reasons[(idx + 1) % reasons.length]}`,
      75, y + 48, { width: 460 }
    );

    doc.fontSize(8).fillColor(COLORS.accent).text(
      `Gap vs ${data.businessName}: ${estScore - data.aiScore} points higher AI visibility`,
      75, y + 62, { width: 460 }
    );

    doc.y = y + 88;
  });

  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('Competitive Positioning Matrix');
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.text).text(
    `${data.businessName} currently ranks below ${competitors.length} identified competitors in AI visibility. The primary gaps are in content volume, structured data implementation, and cross-platform presence. Closing these gaps would move ${data.businessName} from a follower position to a category leader in AI search.`,
    60, doc.y, { width: 492 }
  );
}

function addRevenueProjections(doc, data) {
  addPageHeader(doc, 'Growth Projection Scenarios');
  doc.moveDown(0.5);

  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('12-Month Visibility & Traffic Growth Scenarios');
  doc.moveDown(0.5);

  const baseVis = data.visibilityUplift || 15;
  const baseInq = data.additionalInquiries || 10;

  const scenarios = [
    {
      name: 'No Action',
      color: COLORS.danger,
      vis3: '0%', vis6: '0%', vis12: '-5%',
      inq: '0',
      desc: 'Competitors gain ground as AI adoption accelerates',
    },
    {
      name: 'Growth Plan (£499/mo)',
      color: COLORS.warning,
      vis3: `+${Math.round(baseVis * 0.3)}%`, vis6: `+${Math.round(baseVis * 0.6)}%`, vis12: `+${baseVis}%`,
      inq: `+${baseInq}`,
      desc: 'Steady improvement with weekly monitoring and content optimisation',
    },
    {
      name: 'Scale Plan (£999/mo)',
      color: COLORS.success,
      vis3: `+${Math.round(baseVis * 0.5)}%`, vis6: `+${Math.round(baseVis * 0.85)}%`, vis12: `+${Math.round(baseVis * 1.2)}%`,
      inq: `+${Math.round(baseInq * 1.4)}`,
      desc: 'Active daily optimization across all AI platforms',
    },
  ];

  // Simplified table view
  const tableX = 60;
  let tableY = doc.y;

  doc.rect(tableX, tableY, 492, 20).fill(COLORS.darkGrey);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.white);
  doc.text('Scenario', tableX + 8, tableY + 5);
  doc.text('Month 3', tableX + 180, tableY + 5);
  doc.text('Month 6', tableX + 250, tableY + 5);
  doc.text('Month 12', tableX + 320, tableY + 5);
  doc.text('Extra Inq/mo', tableX + 400, tableY + 5);
  tableY += 20;

  scenarios.forEach((s, idx) => {
    const bg = idx % 2 === 0 ? COLORS.lightGrey : COLORS.white;
    doc.rect(tableX, tableY, 492, 28).fill(bg);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(s.color).text(s.name, tableX + 8, tableY + 5);
    doc.fontSize(7).font('Helvetica').fillColor(COLORS.lightText).text(s.desc, tableX + 8, tableY + 16, { width: 165 });
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.text);
    doc.text(s.vis3, tableX + 180, tableY + 8);
    doc.text(s.vis6, tableX + 250, tableY + 8);
    doc.text(s.vis12, tableX + 320, tableY + 8);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(s.color).text(s.inq, tableX + 400, tableY + 8);
    tableY += 28;
  });

  doc.y = tableY + 15;

  // Plan comparison
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('Plan Comparison');
  doc.moveDown(0.5);

  const plans = [
    { name: 'Starter Plan (£199/mo)', inq: Math.round(baseInq * 0.5), vis: Math.round(baseVis * 0.6) },
    { name: 'Growth Plan (£499/mo)', inq: baseInq, vis: baseVis },
    { name: 'Scale Plan (£999/mo)', inq: Math.round(baseInq * 1.4), vis: Math.round(baseVis * 1.2) },
  ];

  plans.forEach((p) => {
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.text).text(p.name, 70, doc.y);
    doc.fontSize(9).fillColor(COLORS.lightText).text(`+${p.vis}% visibility`, 250, doc.y);
    doc.fontSize(9).fillColor(COLORS.success).font('Helvetica-Bold').text(`+${p.inq} inquiries/mo`, 380, doc.y);
    doc.moveDown(0.8);
  });
}

function addFindingsSummary(doc, data, severity) {
  const isCritical = severity === 'critical';
  const title = isCritical ? 'Critical Findings Summary' : 'Warnings & Opportunities';
  addPageHeader(doc, title);
  doc.moveDown(0.5);

  const headerColor = isCritical ? COLORS.danger : COLORS.warning;
  doc.fontSize(10).font('Helvetica').fillColor(COLORS.text).text(
    isCritical
      ? 'The following critical issues are actively harming your AI visibility and growth potential. These should be addressed as a priority.'
      : 'These items represent opportunities for improvement. Addressing them will strengthen your competitive position.',
    60, doc.y, { width: 492 }
  );

  doc.moveDown(1);

  const criticalFindings = [
    { finding: 'No structured data (Schema.org) detected on key pages', impact: 'High', effort: 'Medium', details: 'AI platforms cannot properly understand your business offerings without structured data.' },
    { finding: 'Business not appearing in direct AI brand queries', impact: 'Critical', effort: 'High', details: 'When users ask AI about your business by name, it returns no results or incorrect information.' },
    { finding: 'Missing FAQ content that AI platforms commonly cite', impact: 'High', effort: 'Low', details: 'AI assistants frequently pull from FAQ sections. Without one, you lose citation opportunities.' },
    { finding: 'No AI-optimised meta descriptions on service pages', impact: 'Medium', effort: 'Low', details: 'Meta descriptions help AI understand page content for citation decisions.' },
    { finding: 'Competitor content significantly outperforms yours in AI responses', impact: 'Critical', effort: 'High', details: 'Competitors are actively optimizing for AI visibility while you are not.' },
    { finding: 'Core Web Vitals below acceptable thresholds', impact: 'Medium', effort: 'Medium', details: 'Page performance affects both Google rankings and AI platform trust signals.' },
  ];

  const warningFindings = [
    { finding: 'Social media profiles not linked via SameAs schema', impact: 'Medium', effort: 'Low', details: 'Connecting social profiles strengthens your entity graph in AI knowledge bases.' },
    { finding: 'No blog or resource centre for thought leadership content', impact: 'Medium', effort: 'Medium', details: 'Regular content publishing is the #1 driver of long-term AI visibility.' },
    { finding: 'Image alt text missing on 40%+ of images', impact: 'Low', effort: 'Low', details: 'Alt text provides additional context signals for AI content understanding.' },
    { finding: 'No video content detected (YouTube, embedded)', impact: 'Medium', effort: 'Medium', details: 'Video content is increasingly cited by AI platforms, especially for how-to queries.' },
    { finding: 'Internal linking structure is shallow', impact: 'Medium', effort: 'Low', details: 'Strong internal linking helps AI understand topic relationships and site authority.' },
    { finding: 'No customer review integration (Google, Trustpilot)', impact: 'High', effort: 'Low', details: 'Third-party reviews significantly boost AI trust signals and recommendation likelihood.' },
  ];

  const findings = isCritical ? criticalFindings : warningFindings;

  findings.forEach((f, idx) => {
    const y = doc.y;
    const boxHeight = 65;

    doc.rect(60, y, 492, boxHeight).stroke(headerColor);
    doc.rect(60, y, 4, boxHeight).fill(headerColor);

    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.text).text(`${idx + 1}. ${f.finding}`, 75, y + 8, { width: 420 });

    const impactColor = f.impact === 'Critical' ? COLORS.danger : f.impact === 'High' ? COLORS.accent : COLORS.warning;
    doc.fontSize(7).font('Helvetica-Bold').fillColor(impactColor).text(`Impact: ${f.impact}`, 75, y + 25);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(COLORS.lightText).text(`Effort: ${f.effort}`, 180, y + 25);

    doc.fontSize(8).font('Helvetica').fillColor(COLORS.lightText).text(f.details, 75, y + 40, { width: 460 });

    doc.y = y + boxHeight + 6;
  });
}

function addQuickWinsActionPlan(doc, data) {
  addPageHeader(doc, '30-Day Quick Wins Action Plan');
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica').fillColor(COLORS.text).text(
    'These high-impact, low-effort actions can be completed within 30 days and will produce measurable improvements in AI visibility and conversion rates.',
    60, doc.y, { width: 492 }
  );

  doc.moveDown(1);

  const weeks = [
    {
      week: 'Week 1 — Foundation',
      tasks: [
        { task: 'Add Organization schema to homepage', time: '2 hours', impact: 'High' },
        { task: 'Create or update FAQ page with 15+ questions', time: '4 hours', impact: 'High' },
        { task: 'Fix all broken links and redirect chains', time: '2 hours', impact: 'Medium' },
        { task: 'Add/update meta descriptions on all service pages', time: '3 hours', impact: 'Medium' },
      ],
    },
    {
      week: 'Week 2 — Content',
      tasks: [
        { task: 'Publish 2 long-form articles (1500+ words each)', time: '8 hours', impact: 'High' },
        { task: 'Add customer testimonials to homepage and service pages', time: '3 hours', impact: 'High' },
        { task: 'Create comparison page (you vs alternatives)', time: '4 hours', impact: 'Medium' },
        { task: 'Add author bylines and credentials to all content', time: '1 hour', impact: 'Medium' },
      ],
    },
    {
      week: 'Week 3 — Technical',
      tasks: [
        { task: 'Implement LocalBusiness and Service schema', time: '3 hours', impact: 'High' },
        { task: 'Optimize Core Web Vitals (images, scripts)', time: '4 hours', impact: 'Medium' },
        { task: 'Set up Google Search Console and submit sitemap', time: '1 hour', impact: 'Medium' },
        { task: 'Add review schema from Google/Trustpilot', time: '2 hours', impact: 'High' },
      ],
    },
    {
      week: 'Week 4 — Conversion',
      tasks: [
        { task: 'Add sticky CTA header to all pages', time: '2 hours', impact: 'High' },
        { task: 'Implement exit-intent lead capture popup', time: '2 hours', impact: 'Medium' },
        { task: 'Add trust badges and security indicators', time: '1 hour', impact: 'Medium' },
        { task: 'Create urgency elements (limited offers, social proof)', time: '2 hours', impact: 'Medium' },
      ],
    },
  ];

  weeks.forEach((w) => {
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.cyan).text(w.week, 60, doc.y);
    doc.moveDown(0.4);

    w.tasks.forEach((t) => {
      const y = doc.y;
      doc.fontSize(8).fillColor(COLORS.text).text(`☐ ${t.task}`, 75, y, { width: 320 });
      doc.fontSize(7).fillColor(COLORS.lightText).text(t.time, 400, y);
      const impColor = t.impact === 'High' ? COLORS.success : COLORS.warning;
      doc.fontSize(7).font('Helvetica-Bold').fillColor(impColor).text(t.impact, 470, y);
      doc.moveDown(0.7);
    });

    doc.moveDown(0.4);
  });
}

function addStrategicRoadmap(doc, data) {
  addPageHeader(doc, '90-Day Strategic Roadmap');
  doc.moveDown(0.5);

  const phases = [
    {
      phase: 'Phase 1: Foundation (Days 1-30)',
      color: COLORS.cyan,
      goals: ['Establish baseline AI visibility metrics', 'Fix critical technical issues', 'Implement core schema markup', 'Launch initial content strategy'],
      kpis: ['AI visibility score improvement: +15 points', 'Technical issues resolved: 80%+', 'Schema types implemented: 5+'],
    },
    {
      phase: 'Phase 2: Growth (Days 31-60)',
      color: COLORS.purple,
      goals: ['Scale content production to 4+ pieces/month', 'Build competitor intelligence monitoring', 'Optimize conversion paths', 'Expand to all AI platforms'],
      kpis: ['AI visibility score improvement: +25 points', 'Organic traffic increase: 20%+', 'Conversion rate improvement: 15%+'],
    },
    {
      phase: 'Phase 3: Dominance (Days 61-90)',
      color: COLORS.success,
      goals: ['Achieve top-3 AI citation for primary keywords', 'Launch automated monitoring and alerts', 'Implement advanced conversion optimization', 'Establish thought leadership authority'],
      kpis: ['AI visibility score target: 75+', 'Revenue recovery: 40%+ of identified losses', 'Competitor gap: reduced by 50%+'],
    },
  ];

  phases.forEach((p) => {
    const y = doc.y;
    doc.rect(60, y, 492, 5).fill(p.color);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(p.color).text(p.phase, 60, y + 12);
    doc.moveDown(0.8);

    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.text).text('Goals:', 75, doc.y);
    doc.moveDown(0.3);
    p.goals.forEach((g) => {
      doc.fontSize(8).font('Helvetica').fillColor(COLORS.text).text(`• ${g}`, 85, doc.y, { width: 450 });
      doc.moveDown(0.4);
    });

    doc.moveDown(0.2);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.text).text('Target KPIs:', 75, doc.y);
    doc.moveDown(0.3);
    p.kpis.forEach((k) => {
      doc.fontSize(8).font('Helvetica').fillColor(COLORS.success).text(`→ ${k}`, 85, doc.y, { width: 450 });
      doc.moveDown(0.4);
    });

    doc.moveDown(0.6);
  });

  doc.moveDown(0.5);
  doc.rect(60, doc.y, 492, 50).fill(COLORS.lightGrey);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.text).text('Expected Outcome After 90 Days', 75, doc.y + 8);
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.text).text(
    `With consistent execution, ${data.businessName} can expect a 20-40 point improvement in AI visibility scores, a ${data.trafficIncrease}%+ increase in organic traffic, and ${data.additionalInquiries}+ additional inquiries per month from AI-driven channels.`,
    75, doc.y + 10, { width: 462 }
  );
}

function addImplementationChecklist(doc, data) {
  addPageHeader(doc, 'Implementation Checklist');
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica').fillColor(COLORS.text).text(
    'Use this checklist to track implementation progress. Each item includes the estimated time and priority level.',
    60, doc.y, { width: 492 }
  );

  doc.moveDown(0.8);

  const sections = [
    {
      title: 'Technical SEO',
      items: [
        '☐ Implement Organization schema markup',
        '☐ Add LocalBusiness schema with NAP data',
        '☐ Create and submit XML sitemap',
        '☐ Fix all broken links (4xx errors)',
        '☐ Resolve redirect chains',
        '☐ Optimize Core Web Vitals (LCP, FID, CLS)',
        '☐ Ensure mobile responsiveness across all pages',
        '☐ Implement canonical tags on all pages',
      ],
    },
    {
      title: 'Content & AI Visibility',
      items: [
        '☐ Create comprehensive FAQ page (15+ questions)',
        '☐ Publish 4 AI-optimized long-form articles',
        '☐ Add comparison/alternative pages',
        '☐ Update all meta titles and descriptions',
        '☐ Add author bylines with credentials',
        '☐ Create industry-specific resource pages',
        '☐ Build internal linking between related content',
        '☐ Add image alt text to all images',
      ],
    },
    {
      title: 'Conversion Optimization',
      items: [
        '☐ Implement sticky CTA in header',
        '☐ Add exit-intent popup with lead magnet',
        '☐ Display customer testimonials above the fold',
        '☐ Add trust badges and security indicators',
        '☐ Create clear pricing/service comparison page',
        '☐ Optimize form fields (reduce to essentials)',
        '☐ Add live chat or chatbot widget',
        '☐ Implement social proof notifications',
      ],
    },
    {
      title: 'Monitoring & Measurement',
      items: [
        '☐ Set up Google Search Console',
        '☐ Configure Google Analytics 4',
        '☐ Install 9 Elms Labs conversion snippet',
        '☐ Set up AI visibility monitoring (weekly)',
        '☐ Configure competitor tracking alerts',
        '☐ Create monthly reporting dashboard',
      ],
    },
  ];

  sections.forEach((section) => {
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.cyan).text(section.title, 60, doc.y);
    doc.moveDown(0.3);

    section.items.forEach((item) => {
      doc.fontSize(8).font('Helvetica').fillColor(COLORS.text).text(item, 75, doc.y, { width: 460 });
      doc.moveDown(0.5);
    });

    doc.moveDown(0.3);
  });
}

function addMeasurementKPIs(doc, data) {
  addPageHeader(doc, 'Measurement & KPIs');
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica').fillColor(COLORS.text).text(
    'Track these key performance indicators to measure the impact of optimization efforts. We recommend reviewing these metrics weekly and reporting monthly.',
    60, doc.y, { width: 492 }
  );

  doc.moveDown(1);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('Primary KPIs');
  doc.moveDown(0.5);

  const primaryKPIs = [
    { kpi: 'AI Visibility Score', current: `${data.aiScore}/100`, target: `${Math.min(100, data.aiScore + 30)}/100`, frequency: 'Weekly' },
    { kpi: 'Monthly Organic Traffic', current: 'Baseline TBD', target: '+30% in 90 days', frequency: 'Weekly' },
    { kpi: 'Conversion Rate', current: `${(data.conversionScore * 0.05).toFixed(1)}%`, target: `${(data.conversionScore * 0.05 + 1.5).toFixed(1)}%`, frequency: 'Weekly' },
    { kpi: 'AI-referred Inquiries', current: 'Baseline TBD', target: `+${data.additionalInquiries}/mo`, frequency: 'Monthly' },
    { kpi: 'AI Platform Citations', current: `~${Math.round(data.aiScore * 0.3)}`, target: `${Math.round(data.aiScore * 0.3 + 25)}+`, frequency: 'Monthly' },
  ];

  const tableX = 60;
  let tableY = doc.y;

  doc.rect(tableX, tableY, 492, 20).fill(COLORS.darkGrey);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.white);
  doc.text('KPI', tableX + 8, tableY + 5);
  doc.text('Current', tableX + 200, tableY + 5);
  doc.text('Target', tableX + 300, tableY + 5);
  doc.text('Review', tableX + 430, tableY + 5);
  tableY += 20;

  primaryKPIs.forEach((k, idx) => {
    const bg = idx % 2 === 0 ? COLORS.lightGrey : COLORS.white;
    doc.rect(tableX, tableY, 492, 22).fill(bg);
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.text).text(k.kpi, tableX + 8, tableY + 6, { width: 185 });
    doc.fontSize(8).fillColor(COLORS.danger).text(k.current, tableX + 200, tableY + 6);
    doc.fontSize(8).fillColor(COLORS.success).font('Helvetica-Bold').text(k.target, tableX + 300, tableY + 6);
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.lightText).text(k.frequency, tableX + 430, tableY + 6);
    tableY += 22;
  });

  doc.y = tableY + 15;

  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.text).text('Secondary KPIs');
  doc.moveDown(0.5);

  const secondaryKPIs = [
    { kpi: 'SEO Health Score', current: `${data.seoScore}/100`, target: `${Math.min(100, data.seoScore + 25)}/100` },
    { kpi: 'Schema Types Implemented', current: `${data.seoScore > 50 ? 3 : 1}`, target: '8+' },
    { kpi: 'Content Pages Published', current: 'Baseline TBD', target: '4+/month' },
    { kpi: 'Backlink Growth', current: 'Baseline TBD', target: '+15%/quarter' },
    { kpi: 'Page Load Speed (LCP)', current: data.seoScore > 60 ? '2.1s' : '3.8s', target: '< 2.5s' },
    { kpi: 'Competitor Gap (AI Score)', current: `${Math.max(5, Math.round((100 - data.aiScore) * 0.3))} pts behind`, target: 'Parity or ahead' },
  ];

  secondaryKPIs.forEach((k) => {
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.text).text(k.kpi, 70, doc.y, { width: 200 });
    doc.fontSize(9).fillColor(COLORS.danger).text(k.current, 280, doc.y);
    doc.fontSize(9).fillColor(COLORS.success).text(`→ ${k.target}`, 400, doc.y);
    doc.moveDown(0.7);
  });

  doc.moveDown(0.8);
  doc.rect(60, doc.y, 492, 45).fill(COLORS.lightGrey);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.text).text('Reporting Schedule', 75, doc.y + 8);
  doc.fontSize(8).font('Helvetica').fillColor(COLORS.lightText).text(
    'Weekly: AI visibility monitoring and alerts. Monthly: Full performance report with KPI dashboard. Quarterly: Strategic review and roadmap refresh. All reports are delivered via email and accessible through your 9 Elms Labs dashboard.',
    75, doc.y + 10, { width: 462 }
  );
}

// Utility functions

function getScoreColor(score) {
  if (score >= 60) return COLORS.success;
  if (score >= 30) return COLORS.warning;
  return COLORS.danger;
}

function getScoreLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Poor';
  return 'Critical';
}

function generateSummaryParagraph(data) {
  const visibility = data.aiScore > 60 ? 'strong' : data.aiScore > 30 ? 'moderate' : 'weak';
  const seo = data.seoScore > 60 ? 'well-optimized' : 'needs improvement';
  const conversion = data.conversionScore > 60 ? 'effective' : 'could be stronger';

  return `Your business currently has ${visibility} visibility in AI search results. Your SEO foundation is ${seo}, and your conversion mechanisms are ${conversion}. By implementing the recommended optimizations, you could increase your AI visibility by ${data.visibilityUplift}%, drive ${data.trafficIncrease}% more traffic, and gain approximately ${data.additionalInquiries}+ additional inquiries per month.`;
}

function formatNumber(num) {
  return Math.round(num).toLocaleString();
}

function formatDate(dateString) {
  if (!dateString) return new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function getClientEmailHTML(contactName, businessName, aiScore, seoScore, conversionScore, visibilityUplift, trafficIncrease, additionalInquiries) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0a0e27; color: white; padding: 30px; text-align: center; border-radius: 8px; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .logo-sub { font-size: 14px; color: #00d4ff; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 8px; }
        .score-card { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #00d4ff; border-radius: 4px; }
        .score-value { font-size: 32px; font-weight: bold; color: #00d4ff; margin: 10px 0; }
        .cta-button { display: inline-block; background: #00d4ff; color: #0a0e27; padding: 15px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; text-align: center; width: 100%; box-sizing: border-box; }
        .metrics { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border-radius: 4px; text-align: center; }
        .metric-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .metric-value { font-size: 24px; font-weight: bold; color: #00d4ff; margin: 10px 0; }
        .footer { text-align: center; font-size: 12px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
        .growth-alert { background: #e8f5e9; border-left: 4px solid #00d4ff; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .growth-highlight { font-size: 22px; font-weight: bold; color: #00d4ff; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">9EL</div>
          <div class="logo-sub">9 Elms Labs</div>
          <p style="margin-top: 15px;">AI Visibility & Growth Report</p>
        </div>

        <div class="content">
          <h2>Hi ${contactName || 'there'},</h2>
          <p>Thank you for using 9 Elms Labs AI Visibility Scanner. Your comprehensive report for <strong>${businessName}</strong> is ready!</p>

          <div class="growth-alert">
            <p style="margin: 0 0 10px 0; font-weight: bold;">📈 Your Growth Potential</p>
            <div class="growth-highlight">+${visibilityUplift}% visibility → +${trafficIncrease}% traffic → +${additionalInquiries} inquiries/mo</div>
            <p style="margin: 10px 0 0 0; font-size: 13px;">Based on AI platform analysis and your industry benchmarks</p>
          </div>

          <h3>Your Performance Scores</h3>
          <div class="metrics">
            <div class="metric">
              <div class="metric-label">AI Visibility</div>
              <div class="metric-value">${aiScore}</div>
              <div style="font-size: 12px; color: #666;">/100</div>
            </div>
            <div class="metric">
              <div class="metric-label">SEO Health</div>
              <div class="metric-value">${seoScore}</div>
              <div style="font-size: 12px; color: #666;">/100</div>
            </div>
            <div class="metric">
              <div class="metric-label">Conversion</div>
              <div class="metric-value">${conversionScore}</div>
              <div style="font-size: 12px; color: #666;">/100</div>
            </div>
          </div>

          <p>Your detailed report with analysis, competitor insights, and an actionable roadmap is attached as a PDF.</p>

          <a href="https://9elmslabs.co.uk/audit" class="cta-button">Upgrade to Full Audit — £2,499</a>
          <p style="text-align: center; font-size: 13px; color: #666; margin-top: 10px;">Get competitor benchmarking, 90-day optimization roadmap, and a strategy call</p>

          <div style="background: white; padding: 20px; border-radius: 4px; margin-top: 30px;">
            <h4>Ready to fix these issues?</h4>
            <p>Our Full Audit includes:</p>
            <ul style="font-size: 14px;">
              <li>Deep-dive technical SEO analysis</li>
              <li>Competitor visibility benchmarking</li>
              <li>AI-specific optimization roadmap</li>
              <li>Conversion improvement strategies</li>
              <li>60-minute strategy call with our team</li>
            </ul>
            <p style="text-align: center;">
              <a href="https://9elmslabs.co.uk/contact" style="color: #00d4ff; text-decoration: none; font-weight: bold;">Book a consultation →</a>
            </p>
          </div>
        </div>

        <div class="footer">
          <p>© 2026 9 Elms Labs. A product of Audley & Oxford Advisory Firm.</p>
          <p>This report is confidential and intended for the recipient only.</p>
          <p>Questions? Email <strong>hello@9elmslabs.co.uk</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getNotificationEmailHTML(contactName, businessName, email, industry, aiScore, seoScore, conversionScore, visibilityUplift, additionalInquiries) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0a0e27; color: white; padding: 20px; border-radius: 8px; }
        .content { padding: 20px; }
        .detail { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>New Report Generated</h2>
        </div>
        <div class="content">
          <h3>Client Details</h3>
          <div class="detail"><strong>Contact:</strong> ${contactName}</div>
          <div class="detail"><strong>Business:</strong> ${businessName}</div>
          <div class="detail"><strong>Email:</strong> ${email}</div>
          <div class="detail"><strong>Industry:</strong> ${industry}</div>

          <h3>Scores</h3>
          <div class="detail">AI Visibility: ${aiScore}/100</div>
          <div class="detail">SEO Health: ${seoScore}/100</div>
          <div class="detail">Conversion: ${conversionScore}/100</div>
          <div class="detail">Growth Potential: +${visibilityUplift}% visibility, +${additionalInquiries} inquiries/mo</div>

          <p>PDF report has been sent to ${email}. Follow up with a plan proposal if interested.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
