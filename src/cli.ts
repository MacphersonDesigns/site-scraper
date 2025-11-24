#!/usr/bin/env node

import { crawlSite } from './crawler';
import type { ScraperConfig } from './types';

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): ScraperConfig {
  const config: Partial<ScraperConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

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

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--url' || arg === '-u') {
      config.baseUrl = getNextArg(args, i, arg);
      i++;
    } else if (arg === '--max-pages' || arg === '-m') {
      config.maxPages = parseInt(getNextArg(args, i, arg), 10);
      i++;
    } else if (arg === '--screenshots' || arg === '-s') {
      config.screenshotDir = getNextArg(args, i, arg);
      i++;
    } else if (arg === '--output' || arg === '-o') {
      config.outputDir = getNextArg(args, i, arg);
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
    } else if (!arg.startsWith('-') && !config.baseUrl) {
      // Treat non-flag arguments as URL
      config.baseUrl = arg;
    }
  }

  if (!config.baseUrl) {
    console.error('Error: URL is required');
    console.error('Usage: site-scraper <url> [options]');
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

  return config as ScraperConfig;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Site Scraper - A comprehensive website crawling and documentation tool

Usage:
  site-scraper <url> [options]

Arguments:
  url                    The base URL to start crawling from

Options:
  -h, --help             Show this help message
  -u, --url <url>        Base URL to crawl (alternative to positional argument)
  -m, --max-pages <n>    Maximum number of pages to crawl (default: 50, 0 for unlimited)
  -s, --screenshots <dir> Directory to save screenshots (default: ./screenshots)
  -o, --output <dir>     Directory to save output reports (default: ./output)
  -d, --delay <ms>       Delay between requests in milliseconds (default: 1000)
  -q, --quality <n>      Screenshot quality 0-100 for JPEG (default: 90)
  --no-full-page         Capture viewport only, not full page
  -w, --width <n>        Viewport width in pixels (default: 1920)
  --height <n>           Viewport height in pixels (default: 1080)

Examples:
  site-scraper https://example.com
  site-scraper https://example.com --max-pages 100 --output ./docs
  site-scraper -u https://example.com -m 20 -d 500

Output:
  The scraper creates:
  - screenshots/    Directory with PNG screenshots of each page
  - output/         Directory with:
    - report.json   Full JSON report with all extracted data
    - summary.txt   Human-readable summary of the crawl

Features:
  - Full website crawling with internal link discovery
  - High-accuracy full-page screenshots
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
    process.exit(0);
  }

  const config = parseArgs(args);

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                     SITE SCRAPER                          ║
║   Website Crawling & Documentation Tool                   ║
╚═══════════════════════════════════════════════════════════╝
`);

  try {
    const report = await crawlSite(config);

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
