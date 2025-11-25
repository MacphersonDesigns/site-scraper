# Site Scraper

A comprehensive website crawling and documentation tool that captures high-accuracy screenshots of every page, extracts all text, images, links, and structural elements, while also identifying JavaScript libraries, frameworks, and stack components. Perfect for documenting website layouts to streamline rebuilding or modernization projects.

## Features

- **Full Website Crawling** - Automatically discovers and crawls all internal pages starting from a base URL
- **High-Accuracy Screenshots** - Captures full-page PNG screenshots at 1920x1080 resolution by default
- **Animation Disabling** - Automatically disables CSS/JS animations before screenshots for consistent captures
- **Asset Downloading** - Download all images (and optionally CSS/JS) from scraped pages
- **Content Extraction** - Extracts:
  - All text content
  - Headings (H1-H6)
  - Links (internal and external)
  - Images with alt text and dimensions
  - Structural elements (header, nav, main, footer, etc.)
  - Meta information (title, description)
- **Technology Detection** - Identifies:
  - JavaScript frameworks (React, Vue, Angular, Next.js, Nuxt.js, Svelte)
  - Libraries (jQuery, Lodash, Bootstrap)
  - Analytics tools (Google Analytics, Google Tag Manager, Hotjar, Segment)
  - CMS platforms (WordPress, Drupal, Shopify)
  - Build tools (Webpack, Vite)
  - State management (Redux)
  - And more...
- **Web-Based UI** - Modern interface for:
  - Creating and managing scraping projects
  - Configuring URLs, scheduling, and options
  - Monitoring scraping progress in real-time
  - Viewing results and screenshots
- **Enhanced Logging** - Verbose output with timestamps, emojis, and detailed progress
- **Organized Output** - Generates:
  - JSON report with complete structured data
  - Human-readable text summary
  - Organized screenshots directory
  - Downloaded assets organized by page
  - Project-based folder structure

## Installation

```bash
# Clone the repository
git clone https://github.com/MacphersonDesigns/site-scraper.git
cd site-scraper

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Build the project
npm run build
```

## Usage

### Web UI (Recommended)

Launch the web-based user interface for an easy-to-use project management experience:

```bash
# Launch web UI on default port (3000)
node dist/cli.js --ui

# Launch on custom port
node dist/cli.js --ui --port 8080
```

Then open http://localhost:3000 in your browser.

The Web UI allows you to:
- Create and manage multiple scraping projects
- Configure project settings (URLs, max pages, delay, viewport size)
- Enable/disable animations and asset downloading
- Run scraping jobs with real-time progress updates
- View detailed results including detected technologies
- Access screenshots and extracted data

**Output Structure (Web UI / Project Mode):**
```
scraped-data/
├── projects.json              # Project configurations
└── <project-name>/
    ├── report.json            # Complete project report
    ├── summary.txt            # Human-readable summary
    └── <page-name>/
        ├── screenshot.png     # Full-page screenshot
        ├── data.json          # Page data and content
        └── images/            # Downloaded images (when enabled)
            ├── logo.png
            ├── hero.jpg
            └── ...
```

### Command Line

```bash
# Basic usage
node dist/cli.js https://example.com

# With verbose output and image downloading
node dist/cli.js https://example.com --download-images --verbose

# All options
node dist/cli.js <url> [options]
```

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--ui` | | Launch the web-based user interface | |
| `--port` | `-p` | Port for the web UI server | 3000 |
| `--url` | `-u` | Base URL to crawl | (required) |
| `--max-pages` | `-m` | Maximum pages to crawl (0 = unlimited) | 50 |
| `--screenshots` | `-s` | Screenshot output directory | ./screenshots |
| `--output` | `-o` | Report output directory | ./output |
| `--delay` | `-d` | Delay between requests (ms) | 1000 |
| `--quality` | `-q` | JPEG quality (0-100) | 90 |
| `--no-full-page` | | Capture viewport only | false |
| `--width` | `-w` | Viewport width (px) | 1920 |
| `--height` | | Viewport height (px) | 1080 |
| `--disable-animations` | | Disable CSS/JS animations (default) | true |
| `--no-disable-animations` | | Keep animations enabled | |
| `--download-assets` | | Download all page assets | false |
| `--download-images` | | Download only images | false |
| `--verbose` | `-v` | Show detailed logging output | false |

### Programmatic Usage

```typescript
import { crawlSite, SiteCrawler } from 'site-scraper';

// Simple usage
const report = await crawlSite({
  baseUrl: 'https://example.com',
  maxPages: 20,
});

console.log(`Scraped ${report.totalPages} pages`);
console.log('Technologies:', report.technologies);

// Advanced usage with new features
const crawler = new SiteCrawler({
  baseUrl: 'https://example.com',
  maxPages: 100,
  screenshotDir: './my-screenshots',
  outputDir: './my-output',
  delay: 500,
  fullPageScreenshots: true,
  viewportWidth: 1920,
  viewportHeight: 1080,
  disableAnimations: true,    // Disable animations before screenshots
  downloadAssets: true,       // Enable asset downloading
  downloadImages: true,       // Download images
  verbose: true,              // Show detailed logging
});

const report = await crawler.crawl();

// Project-based usage (used by Web UI)
import { createProject, runProject, getAllProjects } from 'site-scraper';

const project = createProject({
  name: 'My Website',
  urls: ['https://example.com'],
  maxPages: 50,
  disableAnimations: true,
  downloadAssets: true,
});

await runProject(project.id);
```

## Output Structure

### CLI Mode (`output/report.json`)

```json
{
  "baseUrl": "https://example.com",
  "totalPages": 15,
  "pages": [
    {
      "url": "https://example.com/page",
      "title": "Page Title",
      "metaDescription": "Page description",
      "textContent": "Full text content...",
      "headings": [
        { "level": 1, "text": "Main Heading" }
      ],
      "links": [
        { "text": "Link", "href": "...", "isInternal": true }
      ],
      "images": [
        { "src": "...", "alt": "Image alt", "width": 800, "height": 600 }
      ],
      "structure": [
        { "tag": "header", "id": "main-header", "classes": ["..."], "childCount": 5 }
      ],
      "technologies": [
        { "name": "React", "category": "framework", "confidence": "high" }
      ],
      "screenshotPath": "./screenshots/page_123.png",
      "statusCode": 200,
      "loadTime": 1250,
      "scrapedAt": "2024-01-01T12:00:00.000Z"
    }
  ],
  "technologies": [...],
  "siteStructure": [...],
  "startTime": "...",
  "endTime": "...",
  "duration": 45.5
}
```

### Summary (`output/summary.txt`)

Human-readable summary with:
- Crawl statistics
- Detected technologies
- List of all scraped pages with key metrics

## Development

```bash
# Run in development mode
npm run dev https://example.com

# Run tests
npm test

# Watch tests
npm run test:watch

# Type check
npm run lint

# Build
npm run build
```

## Technology Detection

The scraper identifies technologies through multiple detection methods:

- **Global Variables** - JavaScript globals like `React`, `Vue`, `jQuery`
- **Script Sources** - CDN URLs and file patterns
- **DOM Elements** - Data attributes and class patterns
- **Meta Tags** - Generator tags and other metadata

### Supported Technologies

| Category | Technologies |
|----------|--------------|
| Frameworks | React, Vue.js, Angular, Next.js, Nuxt.js, Svelte |
| Libraries | jQuery, Lodash |
| UI Frameworks | Bootstrap, Tailwind CSS |
| Analytics | Google Analytics, Google Tag Manager, Hotjar, Segment |
| CMS | WordPress, Drupal, Shopify |
| Build Tools | Webpack, Vite |
| State Management | Redux |
| Icons | Font Awesome |

## License

ISC 
