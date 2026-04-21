/**
 * AI-Optimized Content Generator API
 * 9 Elms Labs - Membership Deliverable
 *
 * Generates structured, AI-citeable content using Perplexity API.
 * Optimized for search engines and AI training model citation.
 */

const CONTENT_TEMPLATES = {
  'blog-post': {
    structure: 'multi-section-with-faqs',
    sections: ['introduction', 'main-content', 'key-benefits', 'faqs', 'conclusion'],
  },
  'faq': {
    structure: 'question-answer-pairs',
    sections: ['intro', 'questions-answers', 'conclusion'],
  },
  'service-page': {
    structure: 'service-focused',
    sections: ['overview', 'benefits', 'process', 'faqs', 'cta'],
  },
  'about-page': {
    structure: 'narrative',
    sections: ['mission', 'story', 'values', 'team-intro', 'cta'],
  },
};

const INDUSTRY_KEYWORDS = {
  'dentistry': ['dental care', 'oral health', 'dental treatment', 'preventive dentistry', 'cosmetic dentistry'],
  'legal': ['legal services', 'legal advice', 'law firm', 'attorney', 'legal representation'],
  'restaurant': ['dining', 'cuisine', 'menu', 'reservation', 'food service'],
  'healthcare': ['medical care', 'healthcare', 'patient care', 'medical services', 'wellness'],
  'real estate': ['property', 'real estate', 'home sale', 'real estate agent', 'listing'],
  'fitness': ['fitness', 'gym', 'workout', 'personal training', 'health'],
};

/**
 * Validate input data
 */
function validateInput(data) {
  const errors = [];

  if (!data.businessName || typeof data.businessName !== 'string') {
    errors.push('businessName is required and must be a string');
  }

  if (!data.industry || typeof data.industry !== 'string') {
    errors.push('industry is required and must be a string');
  }

  if (!data.topic || typeof data.topic !== 'string') {
    errors.push('topic is required and must be a string');
  }

  if (!data.contentType || typeof data.contentType !== 'string') {
    errors.push('contentType is required and must be a string');
  }

  const validContentTypes = ['blog-post', 'faq', 'service-page', 'about-page'];
  if (!validContentTypes.includes(data.contentType)) {
    errors.push(`contentType must be one of: ${validContentTypes.join(', ')}`);
  }

  if (data.keywords && !Array.isArray(data.keywords)) {
    errors.push('keywords must be an array if provided');
  }

  return errors;
}

/**
 * Generate Perplexity API request for research
 */
async function researchTopic(topic, industry, businessName) {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY environment variable is not set');
  }

  const prompt = `Research and provide comprehensive, factual information about: "${topic}" in the context of the ${industry} industry.

  Provide:
  1. Current industry trends and best practices
  2. Key statistics and data points
  3. Common challenges and solutions
  4. Expert recommendations
  5. Recent developments (2023-2026)

  Format the response with clear sections and actionable insights suitable for "${businessName}" business content.`;

  try {
    const response = await fetch('https://api.perplexity.ai/openai/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Perplexity API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('Perplexity API request failed:', error);
    // Fallback to structured response if API fails
    return generateFallbackContent(topic, industry);
  }
}

/**
 * Fallback content generation if API is unavailable
 */
function generateFallbackContent(topic, industry) {
  return `# ${topic} in ${industry}

## Overview
${topic} is a critical aspect of the ${industry} industry. Businesses in this sector must stay informed about best practices and industry standards.

## Key Points

### Importance
Understanding ${topic} helps ${industry} professionals provide better service to their clients and stay competitive in the market.

### Best Practices
- Stay current with industry developments
- Implement proven methodologies
- Focus on customer satisfaction
- Invest in ongoing education and training
- Use data-driven decision making

### Common Challenges
Many businesses struggle with staying up-to-date with the latest trends and implementing new strategies effectively.

### Solutions
- Partner with industry experts
- Invest in staff training
- Implement quality assurance processes
- Use technology to improve efficiency
- Monitor industry trends regularly

## Conclusion
Success in ${industry} requires a commitment to continuous improvement and staying informed about ${topic} and related developments.`;
}

/**
 * Generate FAQ schema from content
 */
function generateFAQSchema(businessName, topic) {
  const faqs = [
    {
      q: `What is ${topic} and why is it important?`,
      a: `${topic} is a crucial aspect of the ${businessName} business. Understanding it helps ensure better service delivery and customer satisfaction.`,
    },
    {
      q: `How can ${businessName} benefit from focusing on ${topic}?`,
      a: `By prioritizing ${topic}, ${businessName} can improve operational efficiency, increase customer satisfaction, and maintain competitive advantage in the market.`,
    },
    {
      q: `What are common misconceptions about ${topic}?`,
      a: `Many people believe that ${topic} is simple or straightforward. In reality, it requires careful planning, ongoing education, and professional expertise.`,
    },
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };
}

/**
 * Generate BlogPosting schema
 */
function generateBlogPostingSchema(businessName, title, description, wordCount) {
  const today = new Date().toISOString();

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: description,
    datePublished: today,
    dateModified: today,
    author: {
      '@type': 'Organization',
      name: businessName,
    },
    wordCount: wordCount,
  };
}

/**
 * Generate Article schema
 */
function generateArticleSchema(businessName, title, description, wordCount) {
  const today = new Date().toISOString();

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description,
    datePublished: today,
    dateModified: today,
    author: {
      '@type': 'Organization',
      name: businessName,
    },
    publisher: {
      '@type': 'Organization',
      name: businessName,
    },
    wordCount: wordCount,
  };
}

/**
 * Generate HTML content from research data
 */
function generateHTMLContent(researchData, topic, contentType, businessName) {
  // Split research data into sections
  const sections = researchData.split('\n\n').filter((s) => s.trim());

  let html = '';

  if (contentType === 'blog-post') {
    html = `
<article class="blog-post">
  <h1>${topic}: A Comprehensive Guide for ${businessName}</h1>

  <section class="introduction">
    <p>In this comprehensive guide, we explore ${topic} and its relevance to businesses like ${businessName}. Whether you're new to this topic or looking to deepen your expertise, this article provides actionable insights and expert recommendations.</p>
  </section>

  ${sections
    .map(
      (section, i) => `
  <section class="content-section-${i}">
    ${section}
  </section>
`
    )
    .join('')}

  <section class="key-takeaways">
    <h2>Key Takeaways</h2>
    <ul>
      <li>Understanding ${topic} is essential for business success</li>
      <li>Industry best practices should guide your strategy</li>
      <li>Continuous learning and adaptation are critical</li>
      <li>Professional expertise makes a measurable difference</li>
    </ul>
  </section>

  <section class="conclusion">
    <h2>Conclusion</h2>
    <p>${businessName} is committed to providing the best service by staying current with ${topic} trends and best practices. Contact us to learn how we can help your business thrive.</p>
  </section>
</article>
`;
  } else if (contentType === 'faq') {
    html = `
<section class="faq-section">
  <h1>Frequently Asked Questions About ${topic}</h1>

  ${sections
    .map(
      (section, i) => `
  <article class="faq-item">
    <h2>Question ${i + 1}: ${topic}</h2>
    <p>${section}</p>
  </article>
`
    )
    .join('')}
</section>
`;
  } else if (contentType === 'service-page') {
    html = `
<section class="service-page">
  <h1>${topic} Services by ${businessName}</h1>

  <section class="service-overview">
    <h2>Service Overview</h2>
    <p>${businessName} specializes in ${topic.toLowerCase()} services. Our expert team is dedicated to delivering exceptional results.</p>
  </section>

  ${sections
    .map(
      (section, i) => `
  <section class="service-detail-${i}">
    ${section}
  </section>
`
    )
    .join('')}

  <section class="service-benefits">
    <h2>Why Choose ${businessName}</h2>
    <ul>
      <li>Expert team with years of experience</li>
      <li>Proven track record of success</li>
      <li>Customer-focused approach</li>
      <li>Competitive pricing</li>
      <li>Exceptional customer service</li>
    </ul>
  </section>

  <section class="cta">
    <h2>Get Started Today</h2>
    <p>Contact ${businessName} today to learn how we can help with your ${topic.toLowerCase()} needs.</p>
  </section>
</section>
`;
  } else if (contentType === 'about-page') {
    html = `
<section class="about-page">
  <h1>About ${businessName}</h1>

  <section class="mission">
    <h2>Our Mission</h2>
    <p>${businessName} is dedicated to providing exceptional service and expertise in ${topic.toLowerCase()}. We believe in putting our clients first and delivering results that exceed expectations.</p>
  </section>

  <section class="story">
    <h2>Our Story</h2>
    ${sections
      .map(
        (section, i) => `
    <p>${section}</p>
`
      )
      .join('')}
  </section>

  <section class="values">
    <h2>Our Values</h2>
    <ul>
      <li>Integrity and honesty in all dealings</li>
      <li>Commitment to excellence</li>
      <li>Customer satisfaction is our priority</li>
      <li>Continuous improvement and innovation</li>
      <li>Community involvement and responsibility</li>
    </ul>
  </section>

  <section class="cta">
    <h2>Work With Us</h2>
    <p>Learn more about how ${businessName} can help you achieve your goals. Contact us today for a consultation.</p>
  </section>
</section>
`;
  }

  return html;
}

/**
 * Generate meta title and description
 */
function generateMetadata(topic, businessName, contentType) {
  const templates = {
    'blog-post': {
      title: `${topic}: Complete Guide for ${businessName}`,
      description: `Learn everything about ${topic}. Expert guide with actionable tips and industry best practices for ${businessName}.`,
    },
    'faq': {
      title: `${topic}: Frequently Asked Questions | ${businessName}`,
      description: `Get answers to common questions about ${topic}. Expert insights from ${businessName}.`,
    },
    'service-page': {
      title: `${topic} Services | ${businessName}`,
      description: `Professional ${topic.toLowerCase()} services from ${businessName}. Expert team, proven results, exceptional service.`,
    },
    'about-page': {
      title: `About ${businessName}: Your ${topic} Experts`,
      description: `Learn about ${businessName}. We're dedicated to providing exceptional ${topic.toLowerCase()} services and expertise.`,
    },
  };

  return templates[contentType] || templates['blog-post'];
}

/**
 * Main handler function
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const data = req.body;

    // Validate input
    const validationErrors = validateInput(data);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors,
      });
    }

    const { businessName, industry, topic, contentType, keywords = [] } = data;

    // Add industry-specific keywords if not provided
    let finalKeywords = keywords.length > 0 ? keywords : INDUSTRY_KEYWORDS[industry.toLowerCase()] || [];
    finalKeywords = [
      topic,
      ...finalKeywords.slice(0, 4),
    ];

    // Research the topic using Perplexity API
    const researchData = await researchTopic(topic, industry, businessName);

    // Generate metadata
    const metadata = generateMetadata(topic, businessName, contentType);

    // Generate HTML content
    const content = generateHTMLContent(researchData, topic, contentType, businessName);

    // Generate schema markup
    const schemaMarkup =
      contentType === 'blog-post'
        ? generateBlogPostingSchema(businessName, metadata.title, metadata.description, content.length)
        : generateArticleSchema(businessName, metadata.title, metadata.description, content.length);

    // Calculate word count (rough estimate)
    const wordCount = researchData.split(/\s+/).length + content.split(/\s+/).length;

    // Generate FAQ schema if applicable
    const faqSchema =
      contentType === 'blog-post' || contentType === 'faq' ? generateFAQSchema(businessName, topic) : null;

    return res.status(200).json({
      success: true,
      message: 'Content generated successfully',
      content,
      metaTitle: metadata.title,
      metaDescription: metadata.description,
      schemaMarkup: faqSchema || schemaMarkup,
      keywords: finalKeywords,
      wordCount,
      researchSummary: researchData.substring(0, 500),
      contentType,
      instructions:
        'The content is optimized for AI citation and search engines. Paste the schema markup in your <head> section. Replace placeholder sections with your business-specific details if needed.',
    });
  } catch (error) {
    console.error('Content generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate content',
      message: error.message,
    });
  }
}
