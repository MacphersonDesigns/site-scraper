#!/usr/bin/env node

import { crawlSite } from './crawler';
import { cloneSite } from './cloner';
import { startServer } from './server';
import type { ScraperConfig, ClonerConfig } from './types';

/**
 * Get the next argument value, with bounds checking
 */
function getNextArg(args: string[], index: number, flag: string): string {
  if (index + 1 >= args.length) {
    console.error(`Error: ${flag} requires a value`);
    process.exit(1);
  }
  return args[index + 1];
}

/**
 * Parse result type
 */
interface ParseResult {
  config: ScraperConfig | null;
  clonerConfig: ClonerConfig | null;
  launchUi: boolean;
  port: number;
  mode: 'scrape' | 'clone' | 'ui';
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): ParseResult {
  const config: Partial<ScraperConfig> = {};
  const clonerConfig: Partial<ClonerConfig> = {};
  let launchUi = false;
  let port = 3000;
  let mode: 'scrape' | 'clone' | 'ui' = 'scrape';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === 'clone') {
      mode = 'clone';
    } else if (arg === '--ui') {
      launchUi = true;
      mode = 'ui';
    } else if (arg === '--port' || arg === '-p') {
      port = parseInt(getNextArg(args, i, arg), 10);
      i++;
    } else if (arg === '--url' || arg === '-u') {
      const url = getNextArg(args, i, arg);
      config.baseUrl = url;
      clonerConfig.url = url;
      i++;
    } else if (arg === '--max-pages' || arg === '-m') {
      config.maxPages = parseInt(getNextArg(args, i, arg), 10);
      i++;
    } else if (arg === '--screenshots' || arg === '-s') {
      config.screenshotDir = getNextArg(args, i, arg);
      i++;
    } else if (arg === '--output' || arg === '-o') {
      const output = getNextArg(args, i, arg);
      config.outputDir = output;
      clonerConfig.outputDir = output;
      i++;
    } else if (arg === '--delay' || arg === '-d') {
      config.delay = parseInt(getNextArg(args, i, arg), 10);
      i++;
    } else if (arg === '--quality' || arg === '-q') {
      config.screenshotQuality = parseInt(getNextArg(args, i, arg), 10);
      i++;
    } else if (arg === '--no-full-page') {
      config.fullPageScreenshots = false;
    } else if (arg === '--width' || arg === '-w') {
      config.viewportWidth = parseInt(getNextArg(args, i, arg), 10);
      i++;
    } else if (arg === '--height') {
      config.viewportHeight = parseInt(getNextArg(args, i, arg), 10);
      i++;
    } else if (arg === '--no-images') {
      clonerConfig.downloadImages = false;
    } else if (arg === '--no-css') {
      clonerConfig.downloadCss = false;
    } else if (arg === '--no-js') {
      clonerConfig.downloadJs = false;
    } else if (arg === '--timeout') {
      clonerConfig.timeout = parseInt(getNextArg(args, i, arg), 10);
      i++;
    } else if (!arg.startsWith('-') && !config.baseUrl && arg !== 'clone') {
    } else if (arg === '--disable-animations') {
      config.disableAnimations = true;
    } else if (arg === '--no-disable-animations') {
      config.disableAnimations = false;
    } else if (arg === '--download-assets') {
      config.downloadAssets = true;
    } else if (arg === '--download-images') {
      config.downloadAssets = true;
      config.downloadImages = true;
    } else if (arg === '--verbose' || arg === '-v') {
      config.verbose = true;
    } else if (!arg.startsWith('-') && !config.baseUrl) {
      // Treat non-flag arguments as URL
      config.baseUrl = arg;
      clonerConfig.url = arg;
    }
  }

  // If launching UI, don't require URL
  if (launchUi) {
    return { config: null, clonerConfig: null, launchUi: true, port, mode: 'ui' };
  }

  if (mode === 'clone') {
    if (!clonerConfig.url) {
      console.error('Error: URL is required for clone command');
      console.error('Usage: site-scraper clone <url> [options]');
      console.error('Run with --help for more information');
      process.exit(1);
    }

    // Validate URL
    try {
      new URL(clonerConfig.url);
    } catch {
      console.error(`Error: Invalid URL: ${clonerConfig.url}`);
      process.exit(1);
    }

    return { config: null, clonerConfig: clonerConfig as ClonerConfig, launchUi: false, port, mode: 'clone' };
  }

  if (!config.baseUrl) {
    console.error('Error: URL is required');
    console.error('Usage: site-scraper <url> [options]');
    console.error('       site-scraper clone <url> [options]');
    console.error('       site-scraper --ui [--port <port>]');
    console.error('Run with --help for more information');
    process.exit(1);
  }

  // Validate URL
  try {
    new URL(config.baseUrl);
  } catch {
    console.error(`Error: Invalid URL: ${config.baseUrl}`);
    process.exit(1);
  }

  return { config: config as ScraperConfig, clonerConfig: null, launchUi: false, port, mode: 'scrape' };
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Site Scraper - A comprehensive website crawling and documentation tool

Usage:
  site-scraper <url> [options]           Scrape a website from the command line
  site-scraper clone <url> [options]     Clone a website for offline use
  site-scraper --ui [--port <port>]      Launch the web UI

Commands:
  clone                  Clone a website (HTML, CSS, JS, images) for offline use

Arguments:
  url                    The base URL to start crawling/cloning from

Scraping Options:
  -h, --help             Show this help message
  --ui                   Launch the web-based user interface
  -p, --port <port>      Port for the web UI server (default: 3000)
  -u, --url <url>        Base URL to crawl (alternative to positional argument)
  -m, --max-pages <n>    Maximum number of pages to crawl (default: 50, 0 for unlimited)
  -s, --screenshots <dir> Directory to save screenshots (default: ./screenshots)
  -o, --output <dir>     Directory to save output reports/cloned files
  -d, --delay <ms>       Delay between requests in milliseconds (default: 1000)
  -q, --quality <n>      Screenshot quality 0-100 for JPEG (default: 90)
  --no-full-page         Capture viewport only, not full page
  -w, --width <n>        Viewport width in pixels (default: 1920)
  --height <n>           Viewport height in pixels (default: 1080)
  --disable-animations   Disable CSS/JS animations before screenshots (default: enabled)
  --no-disable-animations Keep animations enabled for screenshots
  --download-assets      Download all page assets (images, CSS, JS)
  --download-images      Download only images
  -v, --verbose          Show detailed logging output

Clone Options:
  --no-images            Skip downloading images
  --no-css               Skip downloading CSS files
  --no-js                Skip downloading JavaScript files
  --timeout <ms>         Page load timeout in milliseconds (default: 30000)

Examples:
  # Scraping
  site-scraper https://example.com
  site-scraper https://example.com --max-pages 100 --output ./docs
  site-scraper -u https://example.com -m 20 -d 500

  # Cloning
  site-scraper clone https://example.com
  site-scraper clone https://example.com --output ./my-clone
  site-scraper clone https://example.com --no-js --no-images

  # Web UI
  site-scraper https://example.com --download-images --verbose
  site-scraper --ui                          # Launch web UI on port 3000
  site-scraper --ui --port 8080              # Launch web UI on port 8080

Web UI:
  The web UI provides a modern interface for:
  - Creating and managing scraping projects
  - Configuring URLs, scheduling, and options
  - Monitoring scraping progress in real-time
  - Viewing results and screenshots

Output:
  CLI Scrape Mode:
    - screenshots/    Directory with PNG screenshots of each page
    - output/         Directory with:
      - report.json   Full JSON report with all extracted data
      - summary.txt   Human-readable summary of the crawl
    - images/         Downloaded images (when --download-assets or --download-images)

  CLI Clone Mode:
    - cloned-sites/<hostname>/
      - index.html           Main HTML file with updated asset paths
      - assets/css/          Downloaded CSS files
      - assets/js/           Downloaded JavaScript files
      - assets/images/       Downloaded images
      - clone-report.json    Report of cloned assets

  Web UI / Project Mode:
    - scraped-data/<project-name>/<page-name>/
      - screenshot.png    Full-page screenshot
      - data.json         Page data and extracted content
      - images/           Downloaded images (when enabled)
    - scraped-data/<project-name>/
      - report.json       Complete project report
      - summary.txt       Human-readable summary

Features:
  - Full website crawling with internal link discovery
  - Website cloning for offline use
  - High-accuracy full-page screenshots
  - Animation disabling for consistent screenshots
  - Asset downloading (images, CSS, JS)
  - Text, images, links extraction
  - Structural element detection (header, nav, main, etc.)
  - JavaScript framework and library detection
  - Technology stack identification
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    console.log('\n💡 TIP: Use --ui to launch the web-based interface for easier project management.\n');
    process.exit(0);
  }

  const { config, clonerConfig, launchUi, port, mode } = parseArgs(args);

  if (launchUi) {
    // Launch web UI
    startServer(port);
    return;
  }

  if (mode === 'clone') {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                     SITE CLONER                           ║
║   Clone websites for offline use                          ║
╚═══════════════════════════════════════════════════════════╝
`);

    try {
      const result = await cloneSite(clonerConfig!);

      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    CLONE COMPLETE                         ║
╠═══════════════════════════════════════════════════════════╣
║  Assets downloaded: ${String(result.totalAssets).padEnd(36)} ║
║  Total size: ${String((result.totalSize / 1024).toFixed(2) + ' KB').padEnd(43)} ║
║  Duration: ${String(result.duration.toFixed(2) + 's').padEnd(45)} ║
║  Output: ${String(result.outputDir).substring(0, 47).padEnd(47)} ║
╚═══════════════════════════════════════════════════════════╝
`);

      if (result.errors.length > 0) {
        console.log(`\n⚠️  ${result.errors.length} warning(s) occurred during cloning.`);
        console.log('Check clone-report.json for details.\n');
      }

    } catch (error) {
      console.error('Error during cloning:', error);
      process.exit(1);
    }

    return;
  }

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                     SITE SCRAPER                          ║
║   Website Crawling & Documentation Tool                   ║
╚═══════════════════════════════════════════════════════════╝
`);

  console.log('💡 TIP: Use --ui to launch the web-based interface for easier project management.\n');

  try {
    const report = await crawlSite(config!);

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    SCRAPE COMPLETE                        ║
╠═══════════════════════════════════════════════════════════╣
║  Pages scraped: ${String(report.totalPages).padEnd(40)} ║
║  Technologies: ${String(report.technologies.length).padEnd(41)} ║
║  Duration: ${String(report.duration.toFixed(2) + 's').padEnd(45)} ║
╚═══════════════════════════════════════════════════════════╝
`);

  } catch (error) {
    console.error('Error during scraping:', error);
    process.exit(1);
  }
}

main();
