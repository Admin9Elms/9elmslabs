/**
 * Schema.org JSON-LD Generator API
 * 9 Elms Labs - Membership Deliverable
 *
 * Generates comprehensive JSON-LD schema markup for client businesses.
 * Supports Organization, LocalBusiness, Website, BreadcrumbList, FAQ, Services, and more.
 */

const INDUSTRY_BUSINESS_TYPES = {
  'dentistry': 'Dentist',
  'dental': 'Dentist',
  'law': 'LegalService',
  'legal': 'LegalService',
  'restaurant': 'Restaurant',
  'food': 'Restaurant',
  'healthcare': 'MedicalBusiness',
  'medical': 'MedicalBusiness',
  'plumbing': 'Plumber',
  'electrical': 'ElectricalContractor',
  'hvac': 'HVAC',
  'real estate': 'RealEstateAgent',
  'realestate': 'RealEstateAgent',
  'beauty': 'BeautySalon',
  'salon': 'BeautySalon',
  'barbershop': 'BarberShop',
  'automotive': 'AutoRepair',
  'mechanic': 'AutoRepair',
  'retail': 'LocalBusiness',
  'ecommerce': 'LocalBusiness',
  'consulting': 'LocalBusiness',
  'agency': 'LocalBusiness',
  'education': 'EducationalOrganization',
  'fitness': 'HealthAndBeautyBusiness',
  'gym': 'HealthAndBeautyBusiness',
};

const INDUSTRY_FAQS = {
  'dentistry': [
    { q: 'How often should I visit the dentist?', a: 'Most dental professionals recommend visiting the dentist every 6 months for routine checkups and cleanings. However, those with dental issues may need more frequent visits.' },
    { q: 'What is the difference between a dentist and a dental hygienist?', a: 'A dentist is a licensed professional who can diagnose and treat dental conditions, while a dental hygienist focuses on preventive care like cleanings and patient education.' },
    { q: 'Are dental procedures covered by insurance?', a: 'Most dental insurance plans cover preventive care like cleanings and exams at 100%, while basic and major procedures may require a copay or have annual limits.' },
    { q: 'What causes tooth sensitivity?', a: 'Tooth sensitivity is often caused by exposed tooth roots, enamel erosion, or gum recession. This can result from aggressive brushing, acidic foods, or gum disease.' },
    { q: 'Can teeth whitening damage my teeth?', a: 'Professional teeth whitening treatments are safe when performed by dental professionals. Over-the-counter products may cause temporary sensitivity but do not permanently damage teeth.' },
  ],
  'legal': [
    { q: 'When do I need to hire a lawyer?', a: 'You should consider hiring a lawyer for legal matters involving contracts, disputes, business formation, estate planning, or any situation with potential legal consequences.' },
    { q: 'What is attorney-client privilege?', a: 'Attorney-client privilege is a legal concept that protects confidential communications between you and your lawyer from being disclosed in court or to third parties.' },
    { q: 'How much does legal representation cost?', a: 'Legal fees vary based on the complexity of your case and the attorney\'s experience. Common billing methods include hourly rates, flat fees, and contingency fees.' },
    { q: 'What documents do I need for estate planning?', a: 'Essential estate planning documents typically include a will, trust, power of attorney, and healthcare directive to ensure your wishes are documented and executed.' },
    { q: 'Can I get legal advice over the phone?', a: 'Many attorneys offer initial consultations over the phone, though some matters may require in-person meetings to fully understand your situation and provide comprehensive advice.' },
  ],
  'restaurant': [
    { q: 'Do you offer reservations?', a: 'Many restaurants accept reservations through their website, phone, or third-party platforms like OpenTable. This helps manage seating and reduce wait times during peak hours.' },
    { q: 'What are your hours of operation?', a: 'Restaurant hours vary by day and season. Check the website or call ahead to confirm hours, as holiday schedules and special events may cause changes.' },
    { q: 'Do you accommodate dietary restrictions?', a: 'Most restaurants can accommodate dietary restrictions like vegetarian, vegan, gluten-free, or allergen-free meals. Call ahead to discuss your specific needs.' },
    { q: 'Is private dining available?', a: 'Many restaurants offer private dining rooms or sections for special events, meetings, or group celebrations. Contact the restaurant directly for availability and pricing.' },
    { q: 'What payment methods do you accept?', a: 'Most restaurants accept major credit cards, debit cards, and mobile payments. Some may also accept cash. Check the website or call to confirm accepted payment methods.' },
  ],
  'healthcare': [
    { q: 'How do I schedule an appointment?', a: 'Most healthcare providers allow you to schedule appointments by phone, through their patient portal, or via their website. Emergency situations should call their emergency number.' },
    { q: 'What should I bring to my appointment?', a: 'Bring a valid ID, insurance card, and any medical records relevant to your visit. Arrive 10-15 minutes early to complete check-in.' },
    { q: 'Do you accept insurance?', a: 'Most healthcare facilities accept major insurance plans. Contact their billing department to verify your coverage before your appointment.' },
    { q: 'What is the difference between urgent care and emergency room?', a: 'Urgent care facilities treat non-life-threatening conditions during extended hours, while emergency rooms handle serious, life-threatening emergencies.' },
    { q: 'How long are appointments typically?', a: 'Appointment length varies by type of visit. Initial consultations often take longer than follow-ups. Check with your provider for specific time estimates.' },
  ],
  'default': [
    { q: 'What are your business hours?', a: 'Check our website or call ahead for current business hours, as seasonal changes and special events may affect our schedule.' },
    { q: 'How can I contact your business?', a: 'You can reach us by phone, email, or by visiting our location in person. Contact details are available on our website.' },
    { q: 'Do you offer customer support?', a: 'Yes, our team is available to assist with questions and concerns. Contact us through your preferred communication method.' },
    { q: 'What payment methods do you accept?', a: 'We accept all major credit cards, debit cards, and other payment methods. Check our website for a complete list of accepted payments.' },
    { q: 'How do I provide feedback about your business?', a: 'We welcome customer feedback. You can leave reviews on Google, social media, or contact us directly with your comments and suggestions.' },
  ],
};

/**
 * Get the appropriate LocalBusiness subtype for an industry
 */
function getBusinessType(industry) {
  if (!industry) return 'LocalBusiness';
  const normalized = industry.toLowerCase().trim();
  return INDUSTRY_BUSINESS_TYPES[normalized] || 'LocalBusiness';
}

/**
 * Get FAQ questions and answers for an industry
 */
function getIndustryFAQs(industry) {
  if (!industry) return INDUSTRY_FAQS['default'];
  const normalized = industry.toLowerCase().trim();
  return INDUSTRY_FAQS[normalized] || INDUSTRY_FAQS['default'];
}

/**
 * Validate input data
 */
function validateInput(data) {
  const errors = [];

  if (!data.businessName || typeof data.businessName !== 'string') {
    errors.push('businessName is required and must be a string');
  }

  if (!data.url || typeof data.url !== 'string') {
    errors.push('url is required and must be a string');
  }

  if (!data.address || typeof data.address !== 'string') {
    errors.push('address is required and must be a string');
  }

  if (data.phone && typeof data.phone !== 'string') {
    errors.push('phone must be a string if provided');
  }

  if (data.email && typeof data.email !== 'string') {
    errors.push('email must be a string if provided');
  }

  if (data.services && !Array.isArray(data.services)) {
    errors.push('services must be an array if provided');
  }

  if (data.socialLinks && !Array.isArray(data.socialLinks)) {
    errors.push('socialLinks must be an array if provided');
  }

  return errors;
}

/**
 * Generate Organization schema
 */
function generateOrganizationSchema(data) {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.businessName,
    url: data.url,
    description: data.description || '',
  };

  if (data.email) {
    organization.email = data.email;
  }

  if (data.phone) {
    organization.telephone = data.phone;
  }

  if (data.address) {
    organization.address = {
      '@type': 'PostalAddress',
      streetAddress: data.address,
    };
  }

  if (data.socialLinks && data.socialLinks.length > 0) {
    organization.sameAs = data.socialLinks;
  }

  return organization;
}

/**
 * Generate LocalBusiness schema
 */
function generateLocalBusinessSchema(data) {
  const businessType = getBusinessType(data.industry);

  const business = {
    '@context': 'https://schema.org',
    '@type': businessType,
    name: data.businessName,
    url: data.url,
    description: data.description || '',
    image: `${new URL(data.url).origin}/logo.png`,
  };

  if (data.email) {
    business.email = data.email;
  }

  if (data.phone) {
    business.telephone = data.phone;
  }

  if (data.address) {
    business.address = {
      '@type': 'PostalAddress',
      streetAddress: data.address,
    };
  }

  business.contactPoint = {
    '@type': 'ContactPoint',
    contactType: 'Customer Service',
    telephone: data.phone || '',
    email: data.email || '',
  };

  if (data.socialLinks && data.socialLinks.length > 0) {
    business.sameAs = data.socialLinks;
  }

  // Add aggregateRating as placeholder
  business.aggregateRating = {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '127',
  };

  return business;
}

/**
 * Generate Website schema with SearchAction
 */
function generateWebsiteSchema(data) {
  const urlObj = new URL(data.url);

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: data.businessName,
    url: data.url,
    description: data.description || '',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${data.url}?s={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Generate BreadcrumbList schema
 */
function generateBreadcrumbSchema(data) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: data.url,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Services',
        item: `${data.url}/services`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Contact',
        item: `${data.url}/contact`,
      },
    ],
  };
}

/**
 * Generate FAQPage schema
 */
function generateFAQSchema(data) {
  const faqs = getIndustryFAQs(data.industry);

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
 * Generate Service schemas
 */
function generateServiceSchemas(data) {
  if (!data.services || data.services.length === 0) {
    return [];
  }

  return data.services.map((service) => ({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service,
    provider: {
      '@type': 'Organization',
      name: data.businessName,
      url: data.url,
    },
    description: `${service} offered by ${data.businessName}`,
    areaServed: 'US',
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: `${data.url}/services/${service.toLowerCase().replace(/\s+/g, '-')}`,
    },
  }));
}

/**
 * Generate ContactPoint schema
 */
function generateContactPointSchema(data) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPoint',
    contactType: 'Customer Service',
    telephone: data.phone || '',
    email: data.email || '',
    areaServed: 'US',
    availableLanguage: 'en',
  };
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

    // Generate all schema types
    const schemas = {
      organization: generateOrganizationSchema(data),
      localBusiness: generateLocalBusinessSchema(data),
      website: generateWebsiteSchema(data),
      breadcrumb: generateBreadcrumbSchema(data),
      faq: generateFAQSchema(data),
      services: generateServiceSchemas(data),
      contactPoint: generateContactPointSchema(data),
    };

    // Generate complete JSON-LD code blocks for copy-paste
    const jsonLdScript = {
      organization: `<script type="application/ld+json">\n${JSON.stringify(schemas.organization, null, 2)}\n</script>`,
      localBusiness: `<script type="application/ld+json">\n${JSON.stringify(schemas.localBusiness, null, 2)}\n</script>`,
      website: `<script type="application/ld+json">\n${JSON.stringify(schemas.website, null, 2)}\n</script>`,
      breadcrumb: `<script type="application/ld+json">\n${JSON.stringify(schemas.breadcrumb, null, 2)}\n</script>`,
      faq: `<script type="application/ld+json">\n${JSON.stringify(schemas.faq, null, 2)}\n</script>`,
      services: schemas.services.map(
        (service) => `<script type="application/ld+json">\n${JSON.stringify(service, null, 2)}\n</script>`
      ),
      contactPoint: `<script type="application/ld+json">\n${JSON.stringify(schemas.contactPoint, null, 2)}\n</script>`,
    };

    // Generate combined script tag with all schemas
    const combinedSchemas = [
      schemas.organization,
      schemas.localBusiness,
      schemas.website,
      schemas.breadcrumb,
      schemas.faq,
      schemas.contactPoint,
      ...schemas.services,
    ];

    const combinedScript = `<script type="application/ld+json">\n${JSON.stringify(combinedSchemas, null, 2)}\n</script>`;

    return res.status(200).json({
      success: true,
      message: 'Schema markup generated successfully',
      schemas,
      jsonLdScript,
      combinedScript,
      instructions: 'Paste any of the above JSON-LD script blocks into your website <head> section. The combinedScript includes all schemas in a single script tag.',
    });
  } catch (error) {
    console.error('Schema generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate schema markup',
      message: error.message,
    });
  }
}
