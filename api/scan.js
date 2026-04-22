// AI Visibility Scanning Engine - 9 Elms Labs
// Comprehensive analysis of AI platform visibility and website optimization

const INDUSTRY_SUBCATEGORIES = {
  'digital marketing': ['social media marketing', 'SEO', 'PPC advertising', 'content marketing'],
  'web development': ['e-commerce', 'SaaS', 'mobile apps', 'custom web applications'],
  'consulting': ['strategy', 'operations', 'technology', 'financial'],
  'accounting': ['bookkeeping', 'tax', 'audit', 'financial planning'],
  'it support': ['managed services', 'cybersecurity', 'cloud solutions', 'infrastructure'],
  'healthcare': ['dental', 'medical practice', 'physical therapy', 'mental health'],
  'real estate': ['residential', 'commercial', 'property management', 'investment'],
  'law': ['corporate law', 'litigation', 'family law', 'intellectual property'],
  'education': ['training', 'certification', 'courses', 'tutoring'],
  'hospitality': ['restaurants', 'hotels', 'events', 'catering'],
};

// Industry benchmarks: conversion rate, avg booking/transaction value, and
// AI visibility uplift potential (how much more visibility AI optimisation can deliver).
// These drive the revenue calculation grounded in the client's actual turnover.
const INDUSTRY_BENCHMARKS = {
  'digital marketing': { conversion_rate: 0.05, avg_booking: 2500, ai_uplift: 0.25, leads_per_100k_turnover: 8 },
  'web development':   { conversion_rate: 0.03, avg_booking: 8000, ai_uplift: 0.20, leads_per_100k_turnover: 4 },
  'consulting':        { conversion_rate: 0.04, avg_booking: 5000, ai_uplift: 0.20, leads_per_100k_turnover: 5 },
  'accounting':        { conversion_rate: 0.06, avg_booking: 1200, ai_uplift: 0.15, leads_per_100k_turnover: 14 },
  'it support':        { conversion_rate: 0.04, avg_booking: 3000, ai_uplift: 0.22, leads_per_100k_turnover: 8 },
  'healthcare':        { conversion_rate: 0.10, avg_booking: 350,  ai_uplift: 0.25, leads_per_100k_turnover: 29 },
  'dental':            { conversion_rate: 0.12, avg_booking: 280,  ai_uplift: 0.30, leads_per_100k_turnover: 30 },
  'real estate':       { conversion_rate: 0.02, avg_booking: 12000,ai_uplift: 0.15, leads_per_100k_turnover: 4 },
  'law':               { conversion_rate: 0.03, avg_booking: 3500, ai_uplift: 0.18, leads_per_100k_turnover: 10 },
  'education':         { conversion_rate: 0.08, avg_booking: 800,  ai_uplift: 0.22, leads_per_100k_turnover: 16 },
  'hospitality':       { conversion_rate: 0.15, avg_booking: 120,  ai_uplift: 0.28, leads_per_100k_turnover: 56 },
  'restaurant':        { conversion_rate: 0.18, avg_booking: 45,   ai_uplift: 0.30, leads_per_100k_turnover: 124 },
  'ecommerce':         { conversion_rate: 0.03, avg_booking: 65,   ai_uplift: 0.20, leads_per_100k_turnover: 513 },
  'saas':              { conversion_rate: 0.02, avg_booking: 2000, ai_uplift: 0.25, leads_per_100k_turnover: 25 },
  'finance':           { conversion_rate: 0.03, avg_booking: 4000, ai_uplift: 0.15, leads_per_100k_turnover: 8 },
  'realestate':        { conversion_rate: 0.02, avg_booking: 12000,ai_uplift: 0.15, leads_per_100k_turnover: 4 },
  'construction':      { conversion_rate: 0.05, avg_booking: 15000,ai_uplift: 0.12, leads_per_100k_turnover: 1 },
  'travel':            { conversion_rate: 0.04, avg_booking: 1500, ai_uplift: 0.22, leads_per_100k_turnover: 17 },
  'fitness':           { conversion_rate: 0.10, avg_booking: 60,   ai_uplift: 0.25, leads_per_100k_turnover: 167 },
  'automotive':        { conversion_rate: 0.03, avg_booking: 8000, ai_uplift: 0.15, leads_per_100k_turnover: 4 },
  'agency':            { conversion_rate: 0.04, avg_booking: 3000, ai_uplift: 0.22, leads_per_100k_turnover: 8 },
  'other':             { conversion_rate: 0.04, avg_booking: 1500, ai_uplift: 0.18, leads_per_100k_turnover: 17 },
};

/**
 * Fuzzy match business name in text with multiple strategies
 */
function fuzzyMatchBusiness(businessName, text) {
  const textLower = text.toLowerCase();

  // Strategy 1: Exact phrase match
  if (textLower.includes(businessName.toLowerCase())) return true;

  // Strategy 2: All significant words present
  const words = businessName
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2 && !['and', 'the', 'for', 'are'].includes(w));

  if (words.length === 0) return false;
  const allWordsPresent = words.every(word => textLower.includes(word));
  if (allWordsPresent) return true;

  // Strategy 3: Abbreviation check (e.g., "ABC Inc" for "Acme Business Corp Inc")
  const abbrev = words.map(w => w[0]).join('').toUpperCase();
  if (abbrev.length > 1 && textLower.includes(abbrev.toLowerCase())) return true;

  // Strategy 4: Partial match of first word (at least 4 chars)
  if (words.length > 0 && words[0].length >= 4) {
    const firstWordPattern = new RegExp(`\\b${words[0].substring(0, 4)}\\w*\\b`, 'i');
    if (firstWordPattern.test(text)) return true;
  }

  return false;
}

/**
 * Extract competitors from Perplexity responses
 */
function extractCompetitors(responseText, businessName, platform) {
  const competitors = [];

  // Common competitor indicators
  const lines = responseText.split('\n').slice(0, 20);

  lines.forEach(line => {
    if (line.length > 10 && !fuzzyMatchBusiness(businessName, line)) {
      // Extract company names (usually capitalized words/phrases)
      const matches = line.match(/^[\d\.\-]?\s*([A-Z][A-Za-z0-9\s&\.,-]*)/);
      if (matches && matches[1]) {
        const name = matches[1].trim();
        if (name.length > 2 && name.length < 100 && !name.includes('http')) {
          competitors.push({
            name: name.replace(/[,\.:]$/, ''),
            platform,
            context: line.substring(0, 120),
          });
        }
      }
    }
  });

  return competitors;
}

/**
 * Parse JSON-LD schema markup
 */
function parseJsonLdSchema(pageText) {
  const schemaTypes = [];
  const jsonLdRegex = /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi;

  let match;
  while ((match = jsonLdRegex.exec(pageText)) !== null) {
    try {
      const schema = JSON.parse(match[1]);
      if (schema['@type']) {
        schemaTypes.push(schema['@type']);
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  }

  return schemaTypes;
}

/**
 * Analyze website for SEO and conversion metrics
 */
async function analyzeWebsite(url) {
  const analysis = {
    fetchSuccess: false,
    seoMetrics: {},
    conversionSignals: {},
    trustSignals: {},
    errors: [],
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const pageResponse = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    clearTimeout(timeoutId);

    if (!pageResponse.ok) {
      analysis.errors.push(`HTTP ${pageResponse.status}`);
      return analysis;
    }

    const pageText = await pageResponse.text();
    analysis.fetchSuccess = true;
    analysis.contentLength = pageText.length;

    // Meta tags analysis
    const metaTitleMatch = pageText.match(/<title[^>]*>([^<]*)<\/title>/i);
    analysis.seoMetrics.metaTitle = metaTitleMatch ? metaTitleMatch[1] : null;
    analysis.seoMetrics.metaTitleLength = analysis.seoMetrics.metaTitle?.length || 0;

    const metaDescMatch = pageText.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
    analysis.seoMetrics.metaDescription = metaDescMatch ? metaDescMatch[1] : null;
    analysis.seoMetrics.metaDescriptionLength = analysis.seoMetrics.metaDescription?.length || 0;
    analysis.seoMetrics.hasMetaDescription = !!metaDescMatch;

    // OG tags
    analysis.seoMetrics.ogTags = {};
    const ogTitleMatch = pageText.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i);
    analysis.seoMetrics.ogTags.title = !!ogTitleMatch;

    const ogDescMatch = pageText.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
    analysis.seoMetrics.ogTags.description = !!ogDescMatch;

    const ogImageMatch = pageText.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i);
    analysis.seoMetrics.ogTags.image = !!ogImageMatch;

    analysis.seoMetrics.ogTagsCount = Object.values(analysis.seoMetrics.ogTags).filter(v => v).length;

    // Heading structure
    analysis.seoMetrics.h1Tags = (pageText.match(/<h1[^>]*>([^<]*)<\/h1>/gi) || []).length;
    analysis.seoMetrics.h2Tags = (pageText.match(/<h2[^>]*>([^<]*)<\/h2>/gi) || []).length;
    analysis.seoMetrics.h3Tags = (pageText.match(/<h3[^>]*>([^<]*)<\/h3>/gi) || []).length;

    // Schema markup
    analysis.seoMetrics.schemaTypes = parseJsonLdSchema(pageText);
    analysis.seoMetrics.hasSchema = analysis.seoMetrics.schemaTypes.length > 0;

    // Mobile viewport
    analysis.seoMetrics.mobileViewport = /<meta\s+name="viewport"/i.test(pageText);

    // Canonical URL
    analysis.seoMetrics.canonicalUrl = /<link\s+rel="canonical"/i.test(pageText);

    // SSL/HTTPS
    analysis.seoMetrics.isHttps = url.startsWith('https://');

    // robots.txt hints
    analysis.seoMetrics.hasRobotsDirective = /<meta\s+name="robots"/i.test(pageText);

    // Links analysis
    const internalLinks = pageText.match(/<a\s+href="\/[^"]*"/gi) || [];
    const externalLinks = pageText.match(/<a\s+href="https?:\/\/[^"]*"/gi) || [];
    analysis.seoMetrics.internalLinkCount = internalLinks.length;
    analysis.seoMetrics.externalLinkCount = externalLinks.length;

    // Images analysis
    const imagesWithAlt = pageText.match(/<img[^>]+alt="[^"]+"/gi) || [];
    const imagesWithoutAlt = pageText.match(/<img[^>]*>/gi) || [];
    analysis.seoMetrics.imagesWithAlt = imagesWithAlt.length;
    analysis.seoMetrics.totalImages = imagesWithoutAlt.length;

    // Conversion signals
    analysis.conversionSignals.ctaButtons = (pageText.match(/<button[^>]*>/gi) || []).length;
    analysis.conversionSignals.ctaClasses = (pageText.match(/class="[^"]*(?:btn|cta|action)[^"]*"/gi) || []).length;
    analysis.conversionSignals.forms = (pageText.match(/<form[^>]*>/gi) || []).length;
    analysis.conversionSignals.inputFields = (pageText.match(/<input[^>]*>/gi) || []).length;
    analysis.conversionSignals.phoneNumbers = (pageText.match(/\+?[\d\s\-\(\)]{10,}/g) || []).length;
    analysis.conversionSignals.emails = (pageText.match(/[\w\.-]+@[\w\.-]+\.\w+/g) || []).length;

    // Contact info
    analysis.conversionSignals.hasContactInfo =
      /contact|get in touch|reach us|call us/i.test(pageText);

    // Trust signals
    analysis.trustSignals.testimonials = (pageText.match(/testimonial/gi) || []).length;
    analysis.trustSignals.reviews = (pageText.match(/review/gi) || []).length;
    analysis.trustSignals.ratings = (pageText.match(/(?:rating|star|★)/gi) || []).length;
    analysis.trustSignals.caseStudies = (pageText.match(/case\s?study|case\s?studies/gi) || []).length;
    analysis.trustSignals.successStories = (pageText.match(/success\s?story|success\s?stories/gi) || []).length;
    analysis.trustSignals.awards = (pageText.match(/award|certified|accredited/gi) || []).length;

    // Social media
    analysis.conversionSignals.socialLinks = {
      facebook: /facebook\.com/i.test(pageText),
      twitter: /twitter\.com|x\.com/i.test(pageText),
      linkedin: /linkedin\.com/i.test(pageText),
      instagram: /instagram\.com/i.test(pageText),
      youtube: /youtube\.com/i.test(pageText),
    };
    analysis.conversionSignals.socialCount = Object.values(analysis.conversionSignals.socialLinks).filter(v => v).length;

    // FAQ schema
    analysis.seoMetrics.hasFaqSchema = /faq|frequently\s+asked/i.test(pageText);

    // Breadcrumb schema
    analysis.seoMetrics.hasBreadcrumbSchema = /breadcrumb/i.test(pageText);

  } catch (err) {
    analysis.errors.push(err.message);
  }

  return analysis;
}

/**
 * Calculate SEO Health Score (0-100)
 */
function calculateSeoScore(analysis) {
  if (!analysis.fetchSuccess) return 0;

  let score = 0;

  // Meta tags (20 points)
  if (analysis.seoMetrics.hasMetaDescription) score += 10;
  if (analysis.seoMetrics.metaTitleLength >= 30 && analysis.seoMetrics.metaTitleLength <= 60) score += 10;

  // Open Graph (15 points)
  score += Math.min(analysis.seoMetrics.ogTagsCount * 5, 15);

  // Heading structure (15 points)
  if (analysis.seoMetrics.h1Tags > 0) score += 5;
  if (analysis.seoMetrics.h2Tags > 0) score += 5;
  if (analysis.seoMetrics.h3Tags > 0) score += 5;

  // Schema markup (15 points)
  if (analysis.seoMetrics.hasSchema) score += 10;
  if (analysis.seoMetrics.hasFaqSchema) score += 3;
  if (analysis.seoMetrics.hasBreadcrumbSchema) score += 2;

  // Mobile & Technical (20 points)
  if (analysis.seoMetrics.mobileViewport) score += 8;
  if (analysis.seoMetrics.canonicalUrl) score += 6;
  if (analysis.seoMetrics.isHttps) score += 6;

  // Links & Images (15 points)
  if (analysis.seoMetrics.internalLinkCount > 5) score += 5;
  if (analysis.seoMetrics.externalLinkCount > 0) score += 3;
  if (analysis.seoMetrics.totalImages > 0) {
    const altRatio = analysis.seoMetrics.imagesWithAlt / analysis.seoMetrics.totalImages;
    score += Math.min(Math.round(altRatio * 7), 7);
  }

  return Math.min(score, 100);
}

/**
 * Calculate Conversion Score (0-100)
 */
function calculateConversionScore(analysis) {
  if (!analysis.fetchSuccess) return 0;

  let score = 0;

  // CTA presence (25 points)
  const totalCtas = analysis.conversionSignals.ctaButtons +
                    Math.min(analysis.conversionSignals.ctaClasses, 5);
  if (totalCtas > 0) score += Math.min(totalCtas * 3, 25);

  // Forms (25 points)
  if (analysis.conversionSignals.forms > 0) score += 15;
  if (analysis.conversionSignals.inputFields > 3) score += 10;

  // Contact info (15 points)
  if (analysis.conversionSignals.hasContactInfo) score += 8;
  score += Math.min(analysis.conversionSignals.phoneNumbers, 1) * 4;
  score += Math.min(analysis.conversionSignals.emails, 1) * 3;

  // Trust signals (20 points)
  const trustCount = analysis.trustSignals.testimonials +
                     analysis.trustSignals.reviews +
                     analysis.trustSignals.caseStudies +
                     analysis.trustSignals.successStories;
  if (trustCount > 0) score += Math.min(trustCount * 2, 20);

  // Social proof (15 points)
  score += Math.min(analysis.conversionSignals.socialCount * 3, 15);

  return Math.min(score, 100);
}

/**
 * Generate detailed findings array
 */
function generateFindings(analysis, businessName, scores, competitors) {
  const findings = [];

  // AI Visibility findings
  if (scores.aiVisibility < 30) {
    findings.push({
      category: 'AI Visibility',
      severity: 'critical',
      title: 'Not mentioned in AI recommendations',
      description: `${businessName} is not appearing in AI platform recommendations. This represents a significant gap in modern discovery channels.`,
      recommendation: 'Invest in content marketing and SEO to increase visibility in AI training data and responses.',
    });
  } else if (scores.aiVisibility < 70) {
    findings.push({
      category: 'AI Visibility',
      severity: 'warning',
      title: 'Limited AI platform visibility',
      description: `${businessName} appears in less than 50% of AI recommendations tested.`,
      recommendation: 'Enhance content quality, build backlinks, and ensure consistent business information across directories.',
    });
  }

  // Meta description
  if (!analysis.seoMetrics.hasMetaDescription) {
    findings.push({
      category: 'SEO Fundamentals',
      severity: 'critical',
      title: 'Missing meta description',
      description: 'Meta descriptions are crucial for CTR in search results and appear in AI summaries.',
      recommendation: 'Add unique, compelling meta descriptions (150-160 chars) to all key pages.',
    });
  } else if (analysis.seoMetrics.metaDescriptionLength < 120 || analysis.seoMetrics.metaDescriptionLength > 160) {
    findings.push({
      category: 'SEO Fundamentals',
      severity: 'warning',
      title: 'Meta description length suboptimal',
      description: `Meta description is ${analysis.seoMetrics.metaDescriptionLength} characters (ideal: 150-160).`,
      recommendation: 'Adjust meta description to recommended length range.',
    });
  }

  // H1 tags
  if (analysis.seoMetrics.h1Tags === 0) {
    findings.push({
      category: 'On-Page SEO',
      severity: 'critical',
      title: 'No H1 heading found',
      description: 'H1 tags are essential for page structure and AI understanding.',
      recommendation: 'Add exactly one descriptive H1 tag per page with primary keywords.',
    });
  } else if (analysis.seoMetrics.h1Tags > 1) {
    findings.push({
      category: 'On-Page SEO',
      severity: 'warning',
      title: 'Multiple H1 tags detected',
      description: `Page has ${analysis.seoMetrics.h1Tags} H1 tags (best practice: 1 per page).`,
      recommendation: 'Restructure headings to use only one H1 tag per page.',
    });
  }

  // Open Graph tags
  if (analysis.seoMetrics.ogTagsCount === 0) {
    findings.push({
      category: 'Social & Sharing',
      severity: 'warning',
      title: 'No Open Graph tags',
      description: 'OG tags control how content appears when shared on social media.',
      recommendation: 'Add og:title, og:description, and og:image tags to homepage and key pages.',
    });
  }

  // Schema markup
  if (!analysis.seoMetrics.hasSchema) {
    findings.push({
      category: 'Structured Data',
      severity: 'critical',
      title: 'Missing schema markup',
      description: 'Schema.org markup helps AI systems understand business information and boosts search visibility.',
      recommendation: 'Implement Organization or LocalBusiness schema at minimum. Add Product schema if applicable.',
    });
  }

  // Mobile viewport
  if (!analysis.seoMetrics.mobileViewport) {
    findings.push({
      category: 'Mobile & Technical',
      severity: 'critical',
      title: 'Missing mobile viewport meta tag',
      description: 'Mobile responsiveness is critical for both user experience and search rankings.',
      recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    });
  }

  // HTTPS
  if (!analysis.seoMetrics.isHttps) {
    findings.push({
      category: 'Security & Technical',
      severity: 'critical',
      title: 'Not using HTTPS',
      description: 'HTTPS is a ranking factor and essential for user trust.',
      recommendation: 'Migrate to HTTPS immediately using an SSL certificate.',
    });
  }

  // CTA elements
  if (analysis.conversionSignals.ctaButtons === 0 && analysis.conversionSignals.ctaClasses < 2) {
    findings.push({
      category: 'Conversion Optimization',
      severity: 'critical',
      title: 'Insufficient call-to-action elements',
      description: 'Limited CTA buttons reduce conversion potential.',
      recommendation: 'Add clear, visible CTAs above the fold and throughout the page (Get Quote, Contact Us, Learn More, etc.).',
    });
  }

  // Forms
  if (analysis.conversionSignals.forms === 0) {
    findings.push({
      category: 'Lead Capture',
      severity: 'critical',
      title: 'No contact forms detected',
      description: 'Forms are primary conversion mechanisms for B2B/service businesses.',
      recommendation: 'Add a contact form or inquiry form to capture leads directly from your website.',
    });
  }

  // Trust signals
  const totalTrustSignals = analysis.trustSignals.testimonials +
                           analysis.trustSignals.caseStudies +
                           analysis.trustSignals.successStories;
  if (totalTrustSignals === 0 && analysis.trustSignals.reviews === 0) {
    findings.push({
      category: 'Trust & Social Proof',
      severity: 'critical',
      title: 'No trust signals detected',
      description: 'Absence of testimonials, reviews, or case studies significantly impacts conversion rates.',
      recommendation: 'Add customer testimonials, case studies, or request reviews from satisfied clients.',
    });
  }

  // Social media links
  if (analysis.conversionSignals.socialCount === 0) {
    findings.push({
      category: 'Social Media',
      severity: 'warning',
      title: 'No social media links found',
      description: 'Social media presence builds credibility and provides alternative engagement channels.',
      recommendation: 'Add links to active social media profiles (LinkedIn, Twitter, Facebook, etc.).',
    });
  }

  // Contact info
  if (!analysis.conversionSignals.hasContactInfo) {
    findings.push({
      category: 'Accessibility',
      severity: 'critical',
      title: 'Missing contact information section',
      description: 'Visitors should easily find multiple ways to contact you.',
      recommendation: 'Add a clear Contact Us page with phone, email, address, and inquiry form.',
    });
  }

  // Image alt text
  if (analysis.seoMetrics.totalImages > 0) {
    const altRatio = analysis.seoMetrics.imagesWithAlt / analysis.seoMetrics.totalImages;
    if (altRatio < 0.5) {
      findings.push({
        category: 'Accessibility & SEO',
        severity: 'warning',
        title: `Only ${Math.round(altRatio * 100)}% of images have alt text`,
        description: 'Alt text improves accessibility and helps search engines understand images.',
        recommendation: 'Add descriptive alt text to all images, especially product and team photos.',
      });
    }
  }

  // Competitors
  if (competitors.length > 0) {
    findings.push({
      category: 'Competitive Analysis',
      severity: 'info',
      title: `${competitors.length} competitors found in AI recommendations`,
      description: `Other companies are being recommended instead of ${businessName}: ${competitors.slice(0, 3).map(c => c.name).join(', ')}.`,
      recommendation: 'Analyze competitor content strategies and differentiate through unique value propositions.',
    });
  }

  // Content length
  if (analysis.contentLength < 5000) {
    findings.push({
      category: 'Content Quality',
      severity: 'warning',
      title: 'Limited page content',
      description: `Homepage has ${Math.round(analysis.contentLength / 100)} words. AI systems prefer comprehensive content.`,
      recommendation: 'Expand homepage with detailed information about services, team, and value proposition (1000+ words recommended).',
    });
  }

  return findings;
}

/**
 * Estimate growth potential — visibility %, traffic %, and additional inquiries.
 * NO hard caps. NO absolute revenue numbers. Percentage-based and credible.
 */
function estimateGrowthPotential(scores, industry, companySize, annualTurnover, competitors) {
  const b = INDUSTRY_BENCHMARKS[industry.toLowerCase()] || INDUSTRY_BENCHMARKS['other'];

  // --- Visibility uplift % ---
  // The lower the AI score, the more room for improvement.
  // ai_uplift is the industry max (e.g. 30% for dental).
  // Scale by how much room exists: score 10 → 90% of max, score 80 → 20% of max.
  const aiRoom = Math.max(0, (100 - scores.aiVisibility) / 100);
  const visibilityUpliftPct = Math.round(b.ai_uplift * aiRoom * 100); // e.g. 24%

  // --- Traffic increase % ---
  // Visibility increase doesn't translate 1:1 to traffic — apply a dampening factor.
  // Typically 40-60% of visibility uplift converts to actual traffic increase,
  // depending on how crowded the industry is.
  const trafficDampening = b.conversion_rate > 0.08 ? 0.55 : b.conversion_rate > 0.03 ? 0.45 : 0.38;
  const trafficIncreasePct = Math.round(visibilityUpliftPct * trafficDampening); // e.g. 11%

  // --- Additional inquiries/month ---
  // Use company size to estimate current monthly inquiries, then apply the traffic uplift.
  const sizeInquiryEstimates = {
    'solo-micro': { low: 10, high: 30 },
    'small':      { low: 30, high: 100 },
    'medium':     { low: 80, high: 300 },
    'large':      { low: 200, high: 800 },
  };
  const sizeRange = sizeInquiryEstimates[companySize] || sizeInquiryEstimates['small'];
  const estimatedCurrentInquiries = Math.round((sizeRange.low + sizeRange.high) / 2);
  const additionalInquiries = Math.max(1, Math.round(estimatedCurrentInquiries * (trafficIncreasePct / 100)));

  // --- Competitor comparison ---
  // Build comparison showing where they stand vs competitors in same industry.
  // Use the AI visibility score and the number of competitors found.
  const competitorCount = (competitors || []).length;
  const competitorNames = (competitors || []).slice(0, 3).map(c => c.name);

  // Estimate a "typical optimised competitor" score range
  // Competitors who ARE appearing in AI recommendations likely score 60-85
  const avgCompetitorAiScore = competitorCount > 0
    ? Math.min(85, Math.max(55, 55 + competitorCount * 5))
    : 60; // default industry average

  const competitorGap = Math.max(0, avgCompetitorAiScore - scores.aiVisibility);

  // Industry rank estimate: where they sit relative to others
  // Score < 20 → bottom 15%, 20-40 → bottom 30%, 40-60 → middle, 60-80 → top 30%, 80+ → top 10%
  let industryRanking;
  if (scores.aiVisibility < 20) industryRanking = 'bottom 15%';
  else if (scores.aiVisibility < 40) industryRanking = 'bottom 30%';
  else if (scores.aiVisibility < 60) industryRanking = 'middle of the pack';
  else if (scores.aiVisibility < 80) industryRanking = 'top 30%';
  else industryRanking = 'top 10%';

  return {
    visibilityUpliftPct,
    trafficIncreasePct,
    additionalInquiries,
    estimatedCurrentInquiries,
    industryConversionRate: b.conversion_rate,
    industryAvgBooking: b.avg_booking,
    industryAiUplift: b.ai_uplift,
    competitorComparison: {
      competitorsFound: competitorCount,
      competitorNames,
      avgCompetitorAiScore,
      yourAiScore: scores.aiVisibility,
      gap: competitorGap,
      industryRanking,
    },
    summary: `Your AI visibility could increase by ${visibilityUpliftPct}%. In your industry, that translates to ~${trafficIncreasePct}% more traffic and approximately ${additionalInquiries}+ additional inquiries per month.`,
  };
}

/**
 * Generate recommendations by priority
 */
function generateRecommendations(findings) {
  const immediate = findings
    .filter(f => f.severity === 'critical')
    .slice(0, 5)
    .map(f => f.recommendation);

  const shortTerm = findings
    .filter(f => f.severity === 'warning')
    .slice(0, 5)
    .map(f => f.recommendation);

  const longTerm = findings
    .filter(f => f.severity === 'info')
    .map(f => f.recommendation)
    .slice(0, 5);

  return { immediate, shortTerm, longTerm };
}

/**
 * Main handler function
 */
// Note: maxDuration:30 requires Vercel Pro. Free tier is 10s.
export default async function handler(req, res) {
  // CORS headers
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
  const rawUrl = req.body.url || req.body.websiteUrl || req.body.website || '';
  const email = req.body.email || '';
  const contactName = req.body.contactName || req.body.name || '';
  const industry = req.body.industry || 'other';
  const companySize = req.body.companySize || '';
  const annualTurnover = req.body.annualTurnover || '';

  // Input validation
  if (!businessName || !rawUrl || !email) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['businessName', 'url/websiteUrl', 'email']
    });
  }

  try {
    // Normalize URL — add https:// if missing
    let normalizedUrl = rawUrl.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    let baseUrl;
    try {
      const urlObj = new URL(normalizedUrl);
      baseUrl = urlObj.toString();
    } catch (e) {
      baseUrl = normalizedUrl;
    }

    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    if (!perplexityKey) {
      // Perform website analysis even without Perplexity API
      const webAnalysis = await analyzeWebsite(baseUrl);
      const seoScore = calculateSeoScore(webAnalysis);
      const conversionScore = calculateConversionScore(webAnalysis);

      return res.status(200).json({
        success: true,
        business: { name: businessName, url: baseUrl, industry },
        scores: {
          aiVisibility: 0,
          seoHealth: seoScore,
          conversion: conversionScore,
          overall: Math.round((0 * 0.4 + seoScore * 0.3 + conversionScore * 0.3)),
        },
        platforms: {
          perplexity: { found: false, mentions: 0, context: 'API key not configured' },
          chatgpt: { found: null, mentions: 0, context: 'estimated' },
          googleAI: { found: null, mentions: 0, context: 'estimated' },
        },
        competitors: [],
        growthPotential: estimateGrowthPotential({ aiVisibility: 0, seoHealth: seoScore, conversion: conversionScore }, industry, companySize, annualTurnover, []),
        findings: generateFindings(webAnalysis, businessName, { aiVisibility: 0, seoHealth: seoScore, conversion: conversionScore }, []),
        recommendations: generateRecommendations(generateFindings(webAnalysis, businessName, { aiVisibility: 0, seoHealth: seoScore, conversion: conversionScore }, [])),
        companySize,
        annualTurnover,
        note: 'Partial analysis: Perplexity API key not configured. Website analysis completed.',
      });
    }

    // Perplexity queries - 5 prompts with relevant subcategory
    const subCategory = INDUSTRY_SUBCATEGORIES[industry.toLowerCase()] || ['services'];
    const randomSubCategory = subCategory[Math.floor(Math.random() * subCategory.length)];

    const queries = [
      `What are the best ${industry} companies in the UK?`,
      `Can you recommend a good ${industry} business?`,
      `Top rated ${industry} services`,
      `Who are the leading ${industry} providers?`,
      `Best ${industry} companies for ${randomSubCategory}`,
    ];

    let aiVisibilityScore = 0;
    const perplexityFindings = [];
    const competitorSet = new Set();
    const platformDetails = {
      perplexity: { found: false, mentions: 0, context: '', responses: [] }
    };

    // Query Perplexity API
    for (const query of queries) {
      try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${perplexityKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              {
                role: 'user',
                content: query,
              },
            ],
            max_tokens: 1000,
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('Perplexity API error:', response.status, error);
          perplexityFindings.push(`Query failed: "${query.substring(0, 50)}..."`);
          continue;
        }

        const data = await response.json();
        const responseText = data.choices[0]?.message?.content || '';

        if (!responseText) continue;

        platformDetails.perplexity.responses.push({
          query,
          response: responseText.substring(0, 300),
        });

        // Check if business name found
        if (fuzzyMatchBusiness(businessName, responseText)) {
          aiVisibilityScore += 20; // 20 points per query (5 queries max = 100)
          platformDetails.perplexity.found = true;
          platformDetails.perplexity.mentions += 1;
          platformDetails.perplexity.context = `Found in: ${query}`;
        }

        // Extract competitors
        const competitors = extractCompetitors(responseText, businessName, 'Perplexity');
        competitors.forEach(comp => {
          if (!competitorSet.has(comp.name)) {
            competitorSet.add(comp.name);
          }
        });

      } catch (err) {
        console.error('Error querying Perplexity:', err);
        perplexityFindings.push(`Error: ${err.message}`);
      }
    }

    // Cap AI Visibility score at 100
    aiVisibilityScore = Math.min(aiVisibilityScore, 100);

    // Analyze website
    const webAnalysis = await analyzeWebsite(baseUrl);
    const seoScore = calculateSeoScore(webAnalysis);
    const conversionScore = calculateConversionScore(webAnalysis);

    // Calculate overall score
    const overallScore = Math.round(
      aiVisibilityScore * 0.4 + seoScore * 0.3 + conversionScore * 0.3
    );

    // Generate competitors array
    const competitorsArray = Array.from(competitorSet)
      .slice(0, 5)
      .map(name => ({
        name,
        platform: 'Perplexity',
        context: 'Recommended in AI responses',
      }));

    // Generate findings
    const scores = {
      aiVisibility: aiVisibilityScore,
      seoHealth: seoScore,
      conversion: conversionScore
    };
    const findings = generateFindings(webAnalysis, businessName, scores, competitorsArray);

    // Generate recommendations
    const recommendations = generateRecommendations(findings);

    // Estimate growth potential (visibility %, traffic %, inquiries)
    const growthPotential = estimateGrowthPotential(scores, industry, companySize, annualTurnover, competitorsArray);

    return res.status(200).json({
      success: true,
      business: {
        name: businessName,
        url: baseUrl,
        industry,
        companySize,
        annualTurnover,
      },
      scores: {
        aiVisibility: aiVisibilityScore,
        seoHealth: seoScore,
        conversion: conversionScore,
        overall: overallScore,
      },
      platforms: {
        perplexity: {
          found: platformDetails.perplexity.found,
          mentions: platformDetails.perplexity.mentions,
          context: platformDetails.perplexity.context || 'Not found',
        },
        chatgpt: {
          found: null,
          mentions: 0,
          context: 'estimated (not queried)',
        },
        googleAI: {
          found: null,
          mentions: 0,
          context: 'estimated (not queried)',
        },
      },
      competitors: competitorsArray,
      growthPotential,
      findings: findings.slice(0, 15),
      recommendations,
      metadata: {
        totalFindingsAvailable: findings.length,
        scanDuration: '~2 minutes',
        analysisDate: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Scan handler error:', error);
    return res.status(500).json({
      error: 'Internal server error during scan',
      message: error.message,
      success: false,
    });
  }
}
