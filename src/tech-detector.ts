import type { Page } from 'playwright';
import type { TechnologyInfo } from './types';

/**
 * Technology detection patterns
 */
interface TechPattern {
  name: string;
  category: string;
  patterns: {
    type: 'script' | 'global' | 'meta' | 'element' | 'header';
    pattern: RegExp | string;
    versionPattern?: RegExp;
  }[];
}

const TECH_PATTERNS: TechPattern[] = [
  // Frameworks
  {
    name: 'React',
    category: 'framework',
    patterns: [
      { type: 'global', pattern: '__REACT_DEVTOOLS_GLOBAL_HOOK__' },
      { type: 'script', pattern: /react(?:\.min)?\.js/i },
      { type: 'element', pattern: '[data-reactroot]' },
    ],
  },
  {
    name: 'Vue.js',
    category: 'framework',
    patterns: [
      { type: 'global', pattern: 'Vue' },
      { type: 'script', pattern: /vue(?:\.min)?\.js/i, versionPattern: /vue@(\d+\.\d+\.\d+)/i },
      { type: 'element', pattern: '[data-v-]' },
    ],
  },
  {
    name: 'Angular',
    category: 'framework',
    patterns: [
      { type: 'global', pattern: 'ng' },
      { type: 'script', pattern: /angular(?:\.min)?\.js/i },
      { type: 'element', pattern: '[ng-app]' },
      { type: 'element', pattern: '[ng-controller]' },
    ],
  },
  {
    name: 'Next.js',
    category: 'framework',
    patterns: [
      { type: 'global', pattern: '__NEXT_DATA__' },
      { type: 'script', pattern: /_next\/static/i },
      { type: 'meta', pattern: 'next-head-count' },
    ],
  },
  {
    name: 'Nuxt.js',
    category: 'framework',
    patterns: [
      { type: 'global', pattern: '__NUXT__' },
      { type: 'script', pattern: /_nuxt\//i },
    ],
  },
  {
    name: 'Svelte',
    category: 'framework',
    patterns: [
      { type: 'element', pattern: '[class*="svelte-"]' },
      { type: 'script', pattern: /svelte/i },
    ],
  },

  // Libraries
  {
    name: 'jQuery',
    category: 'library',
    patterns: [
      { type: 'global', pattern: 'jQuery' },
      { type: 'script', pattern: /jquery(?:\.min)?\.js/i, versionPattern: /jquery[.-]?(\d+\.\d+\.\d+)/i },
    ],
  },
  {
    name: 'Lodash',
    category: 'library',
    patterns: [
      { type: 'global', pattern: '_' },
      { type: 'script', pattern: /lodash(?:\.min)?\.js/i },
    ],
  },
  {
    name: 'Bootstrap',
    category: 'ui-framework',
    patterns: [
      { type: 'script', pattern: /bootstrap(?:\.min)?\.js/i },
      { type: 'element', pattern: '.container' },
      { type: 'element', pattern: '.row' },
    ],
  },
  {
    name: 'Tailwind CSS',
    category: 'ui-framework',
    patterns: [
      { type: 'element', pattern: '[class*="tw-"]' },
      { type: 'element', pattern: '[class*="flex"]' },
      { type: 'element', pattern: '[class*="grid"]' },
    ],
  },

  // Analytics & Tracking
  {
    name: 'Google Analytics',
    category: 'analytics',
    patterns: [
      { type: 'global', pattern: 'ga' },
      { type: 'global', pattern: 'gtag' },
      { type: 'script', pattern: /google-analytics\.com\/analytics\.js/i },
      { type: 'script', pattern: /googletagmanager\.com\/gtag/i },
    ],
  },
  {
    name: 'Google Tag Manager',
    category: 'analytics',
    patterns: [
      { type: 'global', pattern: 'dataLayer' },
      { type: 'script', pattern: /googletagmanager\.com\/gtm\.js/i },
    ],
  },
  {
    name: 'Hotjar',
    category: 'analytics',
    patterns: [
      { type: 'global', pattern: 'hj' },
      { type: 'script', pattern: /static\.hotjar\.com/i },
    ],
  },
  {
    name: 'Segment',
    category: 'analytics',
    patterns: [
      { type: 'global', pattern: 'analytics' },
      { type: 'script', pattern: /cdn\.segment\.com/i },
    ],
  },

  // CMS
  {
    name: 'WordPress',
    category: 'cms',
    patterns: [
      { type: 'meta', pattern: 'generator' },
      { type: 'script', pattern: /wp-content\//i },
      { type: 'script', pattern: /wp-includes\//i },
    ],
  },
  {
    name: 'Drupal',
    category: 'cms',
    patterns: [
      { type: 'global', pattern: 'Drupal' },
      { type: 'script', pattern: /\/sites\/all\//i },
    ],
  },
  {
    name: 'Shopify',
    category: 'ecommerce',
    patterns: [
      { type: 'global', pattern: 'Shopify' },
      { type: 'script', pattern: /cdn\.shopify\.com/i },
    ],
  },

  // Build Tools
  {
    name: 'Webpack',
    category: 'build-tool',
    patterns: [
      { type: 'global', pattern: 'webpackJsonp' },
      { type: 'script', pattern: /webpack/i },
    ],
  },
  {
    name: 'Vite',
    category: 'build-tool',
    patterns: [
      { type: 'script', pattern: /@vite\/client/i },
      { type: 'script', pattern: /\.vite\//i },
    ],
  },

  // State Management
  {
    name: 'Redux',
    category: 'state-management',
    patterns: [
      { type: 'global', pattern: '__REDUX_DEVTOOLS_EXTENSION__' },
    ],
  },

  // Other
  {
    name: 'TypeScript',
    category: 'language',
    patterns: [
      { type: 'script', pattern: /\.tsx?$/i },
    ],
  },
  {
    name: 'Font Awesome',
    category: 'icons',
    patterns: [
      { type: 'script', pattern: /fontawesome/i },
      { type: 'element', pattern: '.fa' },
      { type: 'element', pattern: '[class*="fa-"]' },
    ],
  },
];

/**
 * Detect technologies used on a page
 */
export async function detectTechnologies(page: Page): Promise<TechnologyInfo[]> {
  const detected: TechnologyInfo[] = [];
  const detectedNames = new Set<string>();

  // Get all script sources
  const scripts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('script[src]'))
      .map(s => s.getAttribute('src') || '');
  });

  // Get all inline scripts
  const inlineScripts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('script:not([src])'))
      .map(s => s.textContent || '');
  });

  // Get meta tags
  const metaTags = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('meta'))
      .map(m => ({
        name: m.getAttribute('name') || '',
        content: m.getAttribute('content') || '',
      }));
  });

  for (const tech of TECH_PATTERNS) {
    if (detectedNames.has(tech.name)) continue;

    let isDetected = false;
    let version: string | undefined;
    let confidence: 'high' | 'medium' | 'low' = 'low';

    for (const pattern of tech.patterns) {
      if (pattern.type === 'script') {
        // Check script sources
        for (const src of scripts) {
          if (pattern.pattern instanceof RegExp) {
            if (pattern.pattern.test(src)) {
              isDetected = true;
              confidence = 'high';

              // Try to extract version
              if (pattern.versionPattern) {
                const match = src.match(pattern.versionPattern);
                if (match) version = match[1];
              }
              break;
            }
          }
        }

        // Also check inline scripts for CDN patterns
        if (!isDetected) {
          for (const script of inlineScripts) {
            if (pattern.pattern instanceof RegExp && pattern.pattern.test(script)) {
              isDetected = true;
              confidence = 'medium';
              break;
            }
          }
        }
      } else if (pattern.type === 'global') {
        // Check global variables
        const exists = await page.evaluate((globalName) => {
          return typeof (window as unknown as Record<string, unknown>)[globalName] !== 'undefined';
        }, pattern.pattern as string);

        if (exists) {
          isDetected = true;
          confidence = 'high';
        }
      } else if (pattern.type === 'meta') {
        // Check meta tags
        const metaMatch = metaTags.find(m =>
          m.name.toLowerCase() === (pattern.pattern as string).toLowerCase()
        );
        if (metaMatch) {
          isDetected = true;
          confidence = 'high';
          // Check for WordPress in generator meta
          if (tech.name === 'WordPress' && metaMatch.content.toLowerCase().includes('wordpress')) {
            const vMatch = metaMatch.content.match(/WordPress\s+(\d+\.\d+\.?\d*)/i);
            if (vMatch) version = vMatch[1];
          }
        }
      } else if (pattern.type === 'element') {
        // Check for specific elements
        const exists = await page.evaluate((selector) => {
          try {
            return document.querySelector(selector) !== null;
          } catch {
            return false;
          }
        }, pattern.pattern as string);

        if (exists) {
          isDetected = true;
          if (confidence === 'low') confidence = 'medium';
        }
      }

      if (isDetected && confidence === 'high') break;
    }

    if (isDetected) {
      detectedNames.add(tech.name);
      detected.push({
        name: tech.name,
        version,
        category: tech.category,
        confidence,
      });
    }
  }

  return detected;
}
