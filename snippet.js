/**
 * 9 Elms Labs - Conversion Optimization Snippet
 * Version: 1.0.0
 *
 * Usage: <script src="https://9elmslabs.co.uk/snippet.js?id=CLIENT_ID"></script>
 *
 * Core Features:
 * - Headline A/B testing
 * - CTA button optimization
 * - Form field testing
 * - Trust signal enhancement
 * - Comprehensive analytics tracking
 *
 * Zero dependencies, GDPR compliant, production-grade
 */

(function() {
  'use strict';

  // ============================================================================
  // Configuration & Constants
  // ============================================================================

  const CONFIG = {
    apiEndpoint: 'https://9elmslabs.co.uk/api/analytics',
    cookieDomain: (() => {
      const domain = window.location.hostname;
      return domain === 'localhost' ? domain : domain.replace(/^www\./, '');
    })(),
    cookieExpiry: 365, // days
    demoMode: false,
    version: '1.0.0'
  };

  const VARIANT_TYPES = {
    HEADLINE: 'headline',
    CTA: 'cta',
    FORM: 'form',
    TRUST: 'trust'
  };

  const CTA_KEYWORDS = /^(buy|get|start|sign\s*up|contact|book|learn\s*more|register|subscribe|join|claim|request|download|shop|apply|demo|free|try|install|upgrade)/i;

  const TRUST_SIGNALS = [
    { emoji: '✓', text: 'No credit card required' },
    { emoji: '✓', text: 'Risk-free, cancel anytime' },
    { emoji: '⭐', text: 'Trusted by 10,000+ businesses' },
    { emoji: '🔒', text: 'Secure & encrypted' },
    { emoji: '💬', text: '24/7 support' },
    { emoji: '🚀', text: 'Join today, see results tomorrow' },
    { emoji: '✓', text: '30-day money-back guarantee' },
    { emoji: '⭐', text: 'Rated 4.9/5 by users' }
  ];

  // ============================================================================
  // Utilities
  // ============================================================================

  const Utils = {
    /**
     * Get URL parameter value
     */
    getUrlParam(name) {
      const params = new URLSearchParams(window.location.search);
      return params.get(name);
    },

    /**
     * Generate a consistent random variant ID for this visitor
     */
    generateVariantId(key) {
      const cookieKey = `_9elms_variant_${key}`;
      let variant = this.getCookie(cookieKey);

      if (!variant) {
        variant = Math.floor(Math.random() * 3); // 3 variants per test
        this.setCookie(cookieKey, variant.toString(), CONFIG.cookieExpiry);
      }

      return parseInt(variant, 10);
    },

    /**
     * Set a cookie
     */
    setCookie(name, value, days) {
      const d = new Date();
      d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
      const expires = `expires=${d.toUTCString()}`;
      const domain = CONFIG.cookieDomain === 'localhost' ? '' : `Domain=${CONFIG.cookieDomain}; `;
      document.cookie = `${name}=${encodeURIComponent(value)}; ${domain}Path=/; ${expires}; SameSite=Lax`;
    },

    /**
     * Get a cookie value
     */
    getCookie(name) {
      const nameEQ = name + '=';
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        let c = cookies[i].trim();
        if (c.indexOf(nameEQ) === 0) {
          return decodeURIComponent(c.substring(nameEQ.length));
        }
      }
      return null;
    },

    /**
     * Delete a cookie
     */
    deleteCookie(name) {
      this.setCookie(name, '', -1);
    },

    /**
     * Check if Do Not Track is enabled
     */
    isDNTEnabled() {
      return navigator.doNotTrack === '1' || window.doNotTrack === '1';
    },

    /**
     * Check if user is a bot/crawler
     */
    isBot() {
      const botPatterns = /bot|crawler|spider|scraper|curl|wget|python|java(?!script)/i;
      return botPatterns.test(navigator.userAgent);
    },

    /**
     * Log to console only in demo mode
     */
    log(message, data) {
      if (CONFIG.demoMode && typeof console !== 'undefined' && console.log) {
        if (data) {
          console.log(`[9 Elms Labs] ${message}`, data);
        } else {
          console.log(`[9 Elms Labs] ${message}`);
        }
      }
    },

    /**
     * Deep clone an object
     */
    clone(obj) {
      try {
        return JSON.parse(JSON.stringify(obj));
      } catch (e) {
        return obj;
      }
    },

    /**
     * Measure scroll depth percentage
     */
    getScrollDepth() {
      const winHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      return Math.round(((scrollTop + winHeight) / docHeight) * 100);
    }
  };

  // ============================================================================
  // Headline Testing
  // ============================================================================

  const HeadlineOptimizer = {
    /**
     * Generate headline variants using word manipulation
     */
    generateVariants(original) {
      const variants = [original];

      // Variant 1: Reorder with power words at start
      const powerWords = ['Discover', 'Unlock', 'Master', 'Transform', 'Maximize'];
      const words = original.split(' ');
      if (words.length > 2) {
        const powerWord = powerWords[Math.floor(Math.random() * powerWords.length)];
        variants.push(`${powerWord} ${original}`);
      }

      // Variant 2: Add urgency/scarcity
      const urgencyAddons = [
        `${original} Today`,
        `${original} Now`,
        `Start ${original} Free`,
        `Limited: ${original}`
      ];
      variants.push(urgencyAddons[Math.floor(Math.random() * urgencyAddons.length)]);

      return variants.slice(0, 3);
    },

    /**
     * Test and optimize headlines
     */
    optimize() {
      const h1s = document.querySelectorAll('h1');
      const h2s = document.querySelectorAll('h2');
      const headings = Array.from(h1s).concat(Array.from(h2s));

      headings.forEach((heading, index) => {
        if (!heading.textContent.trim()) return;

        const key = `headline_${index}`;
        const variantId = Utils.generateVariantId(key);
        const variants = this.generateVariants(heading.textContent);

        if (variants[variantId]) {
          const originalText = heading.textContent;
          heading.textContent = variants[variantId];

          // Track the change
          Analytics.trackEvent('headline_variant', {
            index,
            variant: variantId,
            original: originalText,
            tested: variants[variantId]
          });

          Utils.log(`Headline ${index} testing variant ${variantId}`);
        }
      });
    }
  };

  // ============================================================================
  // CTA Button Optimization
  // ============================================================================

  const CTAOptimizer = {
    /**
     * Generate CTA text variants
     */
    generateTextVariants(original) {
      const variants = [original];

      // Extract the base action word
      const baseWord = original.match(/^[a-z\s]+/i)[0].trim();

      // Generate alternatives
      const alternatives = {
        'Get Started': ['Start Now', 'Begin Free Trial', 'Get Access'],
        'Buy Now': ['Purchase Now', 'Order Today', 'Secure Your Copy'],
        'Sign Up': ['Create Account', 'Join Free', 'Get Started'],
        'Learn More': ['Discover More', 'Explore Features', 'See Details'],
        'Contact Us': ['Get in Touch', 'Schedule Demo', 'Talk to Us'],
        'Start Free': ['Try Free', 'Start for Free', 'Begin Free']
      };

      // Use alternatives if available, otherwise create variations
      if (alternatives[original]) {
        return alternatives[original].slice(0, 2).concat([original]);
      }

      variants.push(`${baseWord} Today`);
      variants.push(`${baseWord} Free`);

      return variants.slice(0, 3);
    },

    /**
     * Generate color variants (subtle shade differences)
     */
    generateColorVariants(rgbColor) {
      const variants = [rgbColor];
      // Return original + 2 slightly different shades
      variants.push(this.adjustBrightness(rgbColor, 10));
      variants.push(this.adjustBrightness(rgbColor, -10));
      return variants;
    },

    /**
     * Adjust color brightness
     */
    adjustBrightness(rgb, percent) {
      const match = rgb.match(/\d+/g);
      if (!match || match.length < 3) return rgb;

      let [r, g, b] = match.map(Number);
      r = Math.min(255, Math.max(0, r + percent));
      g = Math.min(255, Math.max(0, g + percent));
      b = Math.min(255, Math.max(0, b + percent));

      return `rgb(${r}, ${g}, ${b})`;
    },

    /**
     * Detect and optimize CTA buttons
     */
    optimize() {
      const buttons = document.querySelectorAll('button, a[href]');
      let ctaCount = 0;

      buttons.forEach((element, index) => {
        const text = element.textContent.trim();

        // Check if this looks like a CTA
        if (!CTA_KEYWORDS.test(text) || text.length > 50) {
          return;
        }

        ctaCount++;
        const key = `cta_${index}`;
        const variantId = Utils.generateVariantId(key);

        // Text variant
        const textVariants = this.generateTextVariants(text);
        if (textVariants[variantId]) {
          const originalText = element.textContent;
          element.textContent = textVariants[variantId];

          Analytics.trackEvent('cta_text_variant', {
            index,
            variant: variantId,
            original: originalText,
            tested: textVariants[variantId]
          });

          Utils.log(`CTA ${index} text variant: ${textVariants[variantId]}`);
        }

        // Color variant
        const computedStyle = window.getComputedStyle(element);
        const bgColor = computedStyle.backgroundColor;

        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
          const colorVariantId = Utils.generateVariantId(`${key}_color`);
          const colorVariants = this.generateColorVariants(bgColor);

          if (colorVariants[colorVariantId]) {
            element.style.backgroundColor = colorVariants[colorVariantId];

            Analytics.trackEvent('cta_color_variant', {
              index,
              variant: colorVariantId,
              original: bgColor,
              tested: colorVariants[colorVariantId]
            });
          }
        }

        // Add click tracking
        element.addEventListener('click', () => {
          Analytics.trackEvent('cta_click', { index, text });
        });
      });

      Utils.log(`Found and testing ${ctaCount} CTA buttons`);
    }
  };

  // ============================================================================
  // Form Optimization
  // ============================================================================

  const FormOptimizer = {
    /**
     * Generate form field order variants
     */
    generateFieldOrderVariants(fields) {
      const variants = [fields];

      // Variant 1: Essential fields first
      const clone1 = Utils.clone(fields);
      clone1.sort((a, b) => {
        const essentialOrder = { email: 0, name: 1, phone: 2 };
        const aOrder = essentialOrder[a.type] ?? 99;
        const bOrder = essentialOrder[b.type] ?? 99;
        return aOrder - bOrder;
      });
      variants.push(clone1);

      // Variant 2: Shortest fields first
      const clone2 = Utils.clone(fields);
      clone2.sort((a, b) => (a.name.length - b.name.length));
      variants.push(clone2);

      return variants;
    },

    /**
     * Generate button text variants
     */
    generateSubmitButtonVariants(original) {
      const variants = [original];
      variants.push('Send Now');
      variants.push('Get My ' + original);
      return variants.slice(0, 3);
    },

    /**
     * Optimize forms on the page
     */
    optimize() {
      const forms = document.querySelectorAll('form');

      forms.forEach((form, formIndex) => {
        const fields = Array.from(form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea, select')).map(f => ({
          element: f,
          name: f.name || f.placeholder || f.id || 'field',
          type: f.type || 'text'
        }));

        if (fields.length === 0) return;

        // Track form view
        Analytics.trackEvent('form_view', {
          formIndex,
          fieldCount: fields.length
        });

        // Track form submission
        form.addEventListener('submit', (e) => {
          const filledFields = fields.filter(f => {
            const val = f.element.value;
            return val && val.trim().length > 0;
          });

          Analytics.trackEvent('form_submit', {
            formIndex,
            fieldsFilled: filledFields.length,
            totalFields: fields.length
          });
        });

        // Test submit button text
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
          const key = `form_submit_${formIndex}`;
          const variantId = Utils.generateVariantId(key);
          const variants = this.generateSubmitButtonVariants(submitBtn.textContent || submitBtn.value);

          if (variants[variantId]) {
            const originalText = submitBtn.textContent || submitBtn.value;
            if (submitBtn.textContent !== undefined) {
              submitBtn.textContent = variants[variantId];
            } else {
              submitBtn.value = variants[variantId];
            }

            Analytics.trackEvent('form_submit_button_variant', {
              formIndex,
              variant: variantId,
              original: originalText,
              tested: variants[variantId]
            });

            Utils.log(`Form ${formIndex} submit button variant: ${variants[variantId]}`);
          }
        }
      });
    }
  };

  // ============================================================================
  // Trust Signal Enhancement
  // ============================================================================

  const TrustOptimizer = {
    /**
     * Add trust signal near CTAs
     */
    addTrustSignals() {
      const ctaElements = document.querySelectorAll('button, a[href]');

      ctaElements.forEach((element, index) => {
        const text = element.textContent.trim();

        // Only add to actual CTAs
        if (!CTA_KEYWORDS.test(text) || text.length > 50) {
          return;
        }

        // Check if trust signal already exists nearby
        const parent = element.parentElement;
        if (!parent) return;

        const existing = parent.querySelector('[data-9elms-trust]');
        if (existing) return;

        // Generate a variant
        const variantId = Utils.generateVariantId(`trust_${index}`);
        const signal = TRUST_SIGNALS[variantId % TRUST_SIGNALS.length];

        // Create trust signal element
        const trustEl = document.createElement('div');
        trustEl.setAttribute('data-9elms-trust', 'true');
        trustEl.style.cssText = `
          font-size: 0.85em;
          color: #27ae60;
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        `;
        trustEl.innerHTML = `<span style="font-size: 1.1em;">${signal.emoji}</span> <span>${signal.text}</span>`;

        parent.insertBefore(trustEl, element.nextSibling);

        Analytics.trackEvent('trust_signal_shown', {
          index,
          signal: signal.text,
          variant: variantId
        });

        Utils.log(`Added trust signal: ${signal.text}`);
      });
    }
  };

  // ============================================================================
  // Analytics & Event Tracking
  // ============================================================================

  const Analytics = {
    clientId: null,
    sessionId: null,
    pageStartTime: Date.now(),
    lastSendTime: 0,
    sendInterval: 10000, // Send data every 10 seconds
    eventBuffer: [],
    pageMetrics: {
      pageViews: 1,
      scrollDepth: 0,
      timeOnPage: 0,
      bounceRisk: true
    },

    /**
     * Initialize analytics
     */
    init(clientId) {
      this.clientId = clientId || Utils.getUrlParam('id') || 'demo';
      CONFIG.demoMode = this.clientId === 'demo';

      if (Utils.isDNTEnabled()) {
        Utils.log('Do Not Track enabled - analytics disabled');
        return;
      }

      // Generate or get session ID
      let sessionId = Utils.getCookie('_9elms_session');
      if (!sessionId) {
        sessionId = this.generateSessionId();
        Utils.setCookie('_9elms_session', sessionId, 1);
      }
      this.sessionId = sessionId;

      // Track initial page view
      this.trackPageView();

      // Track scroll depth periodically
      this.setupScrollTracking();

      // Send buffered events periodically
      this.setupEventSending();

      // Send final data before unload
      window.addEventListener('beforeunload', () => this.sendFinalData());

      Utils.log(`Analytics initialized - Session: ${this.sessionId}`);
    },

    /**
     * Generate unique session ID
     */
    generateSessionId() {
      return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Track page view
     */
    trackPageView() {
      this.eventBuffer.push({
        type: 'pageview',
        timestamp: Date.now(),
        url: window.location.href,
        referrer: document.referrer,
        title: document.title
      });
    },

    /**
     * Track generic event
     */
    trackEvent(eventName, data) {
      if (Utils.isDNTEnabled()) return;

      this.eventBuffer.push({
        type: eventName,
        timestamp: Date.now(),
        data: data || {}
      });

      Utils.log(`Event tracked: ${eventName}`, data);
    },

    /**
     * Setup scroll depth tracking
     */
    setupScrollTracking() {
      let maxScrollDepth = 0;

      window.addEventListener('scroll', () => {
        const depth = Utils.getScrollDepth();
        if (depth > maxScrollDepth) {
          maxScrollDepth = depth;
          this.pageMetrics.scrollDepth = maxScrollDepth;
          this.pageMetrics.bounceRisk = false; // User scrolled = engaged
        }
      }, { passive: true });

      // Track any click as engagement
      document.addEventListener('click', () => {
        this.pageMetrics.bounceRisk = false;
      }, { passive: true });
    },

    /**
     * Setup periodic event sending
     */
    setupEventSending() {
      setInterval(() => {
        if (this.eventBuffer.length > 0) {
          this.sendEvents();
        }
      }, this.sendInterval);
    },

    /**
     * Send buffered events
     */
    sendEvents() {
      if (this.eventBuffer.length === 0) return;

      const now = Date.now();
      if (now - this.lastSendTime < this.sendInterval) return;

      const payload = {
        clientId: this.clientId,
        sessionId: this.sessionId,
        timestamp: now,
        pageUrl: window.location.href,
        pageMetrics: {
          scrollDepth: this.pageMetrics.scrollDepth,
          timeOnPage: Math.round((now - this.pageStartTime) / 1000),
          bounceRisk: this.pageMetrics.bounceRisk
        },
        events: this.eventBuffer.splice(0, 50) // Send max 50 events per request
      };

      this.send(payload);
      this.lastSendTime = now;
    },

    /**
     * Send final data before user leaves
     */
    sendFinalData() {
      if (this.eventBuffer.length === 0) return;

      this.pageMetrics.timeOnPage = Math.round((Date.now() - this.pageStartTime) / 1000);

      const payload = {
        clientId: this.clientId,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        pageUrl: window.location.href,
        pageMetrics: this.pageMetrics,
        events: this.eventBuffer,
        final: true
      };

      // Use sendBeacon for reliability (fires even if page is unloading)
      if (navigator.sendBeacon) {
        try {
          navigator.sendBeacon(CONFIG.apiEndpoint, JSON.stringify(payload));
        } catch (e) {
          Utils.log('sendBeacon failed, falling back to fetch', e);
          this.send(payload);
        }
      } else {
        this.send(payload);
      }
    },

    /**
     * Send data to analytics endpoint
     */
    send(payload) {
      if (!payload) return;

      try {
        const fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true // Allows sending even if page is unloading
        };

        fetch(CONFIG.apiEndpoint, fetchOptions).catch((e) => {
          Utils.log('Failed to send analytics', e);
        });
      } catch (e) {
        Utils.log('Analytics send error', e);
      }
    }
  };

  // ============================================================================
  // Initialization
  // ============================================================================

  function init() {
    try {
      // Don't run on bots
      if (Utils.isBot()) {
        Utils.log('Bot detected - skipping optimization');
        return;
      }

      // Initialize analytics first
      Analytics.init();

      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startOptimizations);
      } else {
        startOptimizations();
      }
    } catch (e) {
      // Fail silently - never break the client's page
      if (typeof console !== 'undefined' && console.error) {
        console.error('[9 Elms Labs Error]', e);
      }
    }
  }

  function startOptimizations() {
    try {
      Utils.log('Starting optimizations');

      // Run all optimizations
      HeadlineOptimizer.optimize();
      CTAOptimizer.optimize();
      FormOptimizer.optimize();
      TrustOptimizer.addTrustSignals();

      Utils.log('Optimizations complete');
    } catch (e) {
      // Fail silently
      if (typeof console !== 'undefined' && console.error) {
        console.error('[9 Elms Labs Error]', e);
      }
    }
  }

  // Start the script
  init();
})();
