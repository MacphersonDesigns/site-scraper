import * as fs from 'fs';
import * as path from 'path';
import { chromium, type Browser, type Page } from 'playwright';
import type { Project, ProjectConfig, SiteReport, PageData, TechnologyInfo, ProgressDetails } from './types';
import { extractPageData } from './extractor';
import { disablePageAnimations, downloadAssets, formatBytes } from './utils';

const SCRAPED_DATA_DIR = './scraped-data';
const PROJECTS_FILE = './scraped-data/projects.json';

/**
 * In-memory store for projects
 */
let projectsStore: Map<string, Project> = new Map();

/**
 * Callback type for progress updates with detailed info
 */
export type ProgressCallback = (projectId: string, progress: number, status: string, details?: ProgressDetails) => void;

/**
 * Progress callback (set by server for WebSocket updates)
 */
let progressCallback: ProgressCallback | null = null;

/**
 * Set the progress callback for real-time updates
 */
export function setProgressCallback(callback: ProgressCallback | null): void {
  progressCallback = callback;
}

/**
 * Ensure the scraped-data directory exists
 */
function ensureDataDir(): void {
  if (!fs.existsSync(SCRAPED_DATA_DIR)) {
    fs.mkdirSync(SCRAPED_DATA_DIR, { recursive: true });
  }
}

/**
 * Load projects from disk
 */
export function loadProjects(): void {
  ensureDataDir();
  if (fs.existsSync(PROJECTS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
      projectsStore = new Map(Object.entries(data));
      // Reset any running projects to idle (in case of crash)
      for (const [id, project] of projectsStore) {
        if (project.status === 'running') {
          project.status = 'idle';
          project.progress = 0;
        }
        projectsStore.set(id, project);
      }
      saveProjects();
    } catch {
      projectsStore = new Map();
    }
  }
}

/**
 * Save projects to disk
 */
function saveProjects(): void {
  ensureDataDir();
  const data = Object.fromEntries(projectsStore);
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Generate a unique project ID
 */
function generateId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get sanitized folder name from string
 */
function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50) || 'unnamed';
}

/**
 * Get page folder name from URL
 */
function getPageFolderName(url: string): string {
  try {
    const parsed = new URL(url);
    let pathname = parsed.pathname
      .replace(/^\/+|\/+$/g, '')
      .replace(/\//g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '');
    if (!pathname) pathname = 'index';
    return pathname;
  } catch {
    return 'page';
  }
}

/**
 * Create a new project
 */
export function createProject(config: Omit<ProjectConfig, 'id' | 'createdAt' | 'updatedAt'>): Project {
  const now = new Date().toISOString();
  const project: Project = {
    id: generateId(),
    name: config.name,
    urls: config.urls,
    maxPages: config.maxPages ?? 50,
    delay: config.delay ?? 1000,
    fullPageScreenshots: config.fullPageScreenshots ?? true,
    viewportWidth: config.viewportWidth ?? 1920,
    viewportHeight: config.viewportHeight ?? 1080,
    schedule: config.schedule,
    disableAnimations: config.disableAnimations ?? true,
    downloadAssets: config.downloadAssets ?? false,
    downloadImages: config.downloadImages ?? true,
    downloadCSS: config.downloadCSS ?? false,
    downloadJS: config.downloadJS ?? false,
    assetTimeout: config.assetTimeout ?? 5000,
    maxAssetSize: config.maxAssetSize ?? 10 * 1024 * 1024,
    createdAt: now,
    updatedAt: now,
    status: 'idle',
    progress: 0,
  };

  projectsStore.set(project.id, project);
  saveProjects();

  // Create project folder
  const projectDir = path.join(SCRAPED_DATA_DIR, sanitizeName(project.name));
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  return project;
}

/**
 * Get all projects
 */
export function getAllProjects(): Project[] {
  return Array.from(projectsStore.values());
}

/**
 * Get a single project by ID
 */
export function getProject(id: string): Project | undefined {
  return projectsStore.get(id);
}

/**
 * Update a project
 */
export function updateProject(id: string, updates: Partial<ProjectConfig>): Project | undefined {
  const project = projectsStore.get(id);
  if (!project) return undefined;

  const updated: Project = {
    ...project,
    ...updates,
    id: project.id, // Ensure ID can't be changed
    createdAt: project.createdAt, // Preserve creation date
    updatedAt: new Date().toISOString(),
  };

  projectsStore.set(id, updated);
  saveProjects();
  return updated;
}

/**
 * Delete a project
 */
export function deleteProject(id: string): boolean {
  const project = projectsStore.get(id);
  if (!project) return false;

  // Delete project folder
  const projectDir = path.join(SCRAPED_DATA_DIR, sanitizeName(project.name));
  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }

  projectsStore.delete(id);
  saveProjects();
  return true;
}

/**
 * Run a scraping project
 */
export async function runProject(id: string): Promise<SiteReport | undefined> {
  const project = projectsStore.get(id);
  if (!project) return undefined;

  // Record start time
  const runStartTime = new Date();

  // Update status
  project.status = 'running';
  project.progress = 0;
  project.error = undefined;
  project.lastRun = runStartTime.toISOString();
  projectsStore.set(id, project);
  saveProjects();

  const projectDir = path.join(SCRAPED_DATA_DIR, sanitizeName(project.name));
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: {
        width: project.viewportWidth ?? 1920,
        height: project.viewportHeight ?? 1080,
      },
      userAgent: 'Mozilla/5.0 (compatible; SiteScraperBot/1.0)',
    });

    const page = await context.newPage();
    const allPages: PageData[] = [];
    const visitedUrls = new Set<string>();
    const totalUrls = project.urls.length;
    let processedUrls = 0;

    for (const baseUrl of project.urls) {
      const urlsToVisit = [baseUrl];
      const maxPages = project.maxPages ?? 50;
      let pageCount = 0;

      while (urlsToVisit.length > 0 && (maxPages === 0 || pageCount < maxPages)) {
        const url = urlsToVisit.shift()!;
        const normalizedUrl = normalizeUrl(url);

        if (visitedUrls.has(normalizedUrl)) continue;
        visitedUrls.add(normalizedUrl);

        try {
          const startTime = Date.now();
          const response = await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000,
          });
          const statusCode = response?.status() || 200;
          await page.waitForTimeout(500);

          // Disable animations before taking screenshot
          if (project.disableAnimations !== false) {
            await disablePageAnimations(page);
            await page.waitForTimeout(100);
          }

          const loadTime = Date.now() - startTime;

          // Create page folder
          const pageFolderName = getPageFolderName(url);
          const pageDir = path.join(projectDir, pageFolderName);
          if (!fs.existsSync(pageDir)) {
            fs.mkdirSync(pageDir, { recursive: true });
          }

          // Take screenshot
          const screenshotPath = path.join(pageDir, 'screenshot.png');
          await page.screenshot({
            path: screenshotPath,
            fullPage: project.fullPageScreenshots ?? true,
            type: 'png',
          });

          // Update progress with detailed status
          if (progressCallback) {
            progressCallback(id, project.progress, `Screenshot: ${url}`, {
              status: 'scraping',
              url,
              action: 'screenshot',
              details: 'Screenshot captured',
              timestamp: new Date().toISOString(),
            });
          }

          // Extract page data
          const pageData = await extractPageData(
            page,
            url,
            baseUrl,
            screenshotPath,
            statusCode,
            loadTime
          );

          // Download assets if enabled
          if (project.downloadAssets && project.downloadImages !== false) {
            await downloadPageAssets(
              pageData,
              url,
              pageDir,
              project,
              id,
              progressCallback
            );
          }

          // Save page data
          const dataPath = path.join(pageDir, 'data.json');
          fs.writeFileSync(dataPath, JSON.stringify(pageData, null, 2));

          allPages.push(pageData);
          pageCount++;

          // Find internal links to crawl
          const internalLinks = pageData.links
            .filter(link => link.isInternal && shouldCrawl(link.href, baseUrl, visitedUrls))
            .map(link => link.href);

          for (const link of internalLinks) {
            if (!urlsToVisit.includes(link)) {
              urlsToVisit.push(link);
            }
          }

          // Update progress
          const baseProgress = (processedUrls / totalUrls) * 100;
          const urlProgress = maxPages > 0 ? (pageCount / maxPages) * (100 / totalUrls) : 0;
          project.progress = Math.min(Math.round(baseProgress + urlProgress), 99);
          projectsStore.set(id, project);
          saveProjects();

          if (progressCallback) {
            progressCallback(id, project.progress, `Scraped: ${url}`, {
              status: 'scraping',
              url,
              action: 'page_complete',
              details: `Page ${pageCount} of ${maxPages}`,
              timestamp: new Date().toISOString(),
            });
          }

          // Delay between requests
          if (urlsToVisit.length > 0 && (project.delay ?? 1000) > 0) {
            await new Promise(resolve => setTimeout(resolve, project.delay ?? 1000));
          }
        } catch (error) {
          console.error(`Error crawling ${url}:`, error);
        }
      }

      processedUrls++;
    }

    await context.close();
    await browser.close();
    browser = null;

    // Create final report
    const endTime = new Date();
    const report: SiteReport = {
      baseUrl: project.urls[0],
      totalPages: allPages.length,
      pages: allPages,
      technologies: aggregateTechnologies(allPages),
      siteStructure: buildSiteStructure(allPages),
      startTime: runStartTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: (endTime.getTime() - runStartTime.getTime()) / 1000,
    };

    // Save report
    const reportPath = path.join(projectDir, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Save summary
    const summaryPath = path.join(projectDir, 'summary.txt');
    fs.writeFileSync(summaryPath, generateSummary(report, project.name));

    // Update project
    project.status = 'completed';
    project.progress = 100;
    project.lastRun = endTime.toISOString();
    project.lastReport = report;
    projectsStore.set(id, project);
    saveProjects();

    if (progressCallback) {
      progressCallback(id, 100, 'Completed');
    }

    return report;
  } catch (error) {
    console.error('Project run failed:', error);
    project.status = 'failed';
    project.error = error instanceof Error ? error.message : 'Unknown error';
    projectsStore.set(id, project);
    saveProjects();

    if (progressCallback) {
      progressCallback(id, project.progress, `Failed: ${project.error}`);
    }

    if (browser) {
      await browser.close();
    }

    return undefined;
  }
}

/**
 * Normalize URL for comparison
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    let normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    if (normalized.endsWith('/') && normalized !== `${parsed.protocol}//${parsed.host}/`) {
      normalized = normalized.slice(0, -1);
    }
    if (parsed.search) {
      normalized += parsed.search;
    }
    return normalized;
  } catch {
    return url;
  }
}

/**
 * Check if URL should be crawled
 */
function shouldCrawl(url: string, baseUrl: string, visitedUrls: Set<string>): boolean {
  try {
    const baseHostname = new URL(baseUrl).hostname;
    const urlHostname = new URL(url).hostname;

    if (urlHostname !== baseHostname) return false;

    const pathname = new URL(url).pathname.toLowerCase();
    const skipExtensions = ['.pdf', '.zip', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.css', '.js', '.mp4', '.webm', '.mp3'];
    if (skipExtensions.some(ext => pathname.endsWith(ext))) return false;

    const normalized = normalizeUrl(url);
    if (visitedUrls.has(normalized)) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Aggregate technologies across all pages
 */
function aggregateTechnologies(pages: PageData[]): TechnologyInfo[] {
  const techMap = new Map<string, TechnologyInfo>();

  for (const page of pages) {
    for (const tech of page.technologies) {
      const existing = techMap.get(tech.name);
      if (!existing || tech.confidence === 'high') {
        techMap.set(tech.name, tech);
      }
    }
  }

  return Array.from(techMap.values());
}

/**
 * Build site structure from pages
 */
function buildSiteStructure(pages: PageData[]): SiteReport['siteStructure'] {
  return pages.map(page => {
    const children = page.links
      .filter(link => link.isInternal)
      .map(link => link.href);

    return {
      url: page.url,
      title: page.title,
      children: [...new Set(children)],
    };
  });
}

/**
 * Generate a human-readable summary
 */
function generateSummary(report: SiteReport, projectName: string): string {
  const lines: string[] = [
    '='.repeat(60),
    `SITE SCRAPER REPORT - ${projectName}`,
    '='.repeat(60),
    '',
    `Base URL: ${report.baseUrl}`,
    `Total Pages: ${report.totalPages}`,
    `Duration: ${report.duration.toFixed(2)} seconds`,
    `Start: ${report.startTime}`,
    `End: ${report.endTime}`,
    '',
    '-'.repeat(60),
    'DETECTED TECHNOLOGIES',
    '-'.repeat(60),
  ];

  if (report.technologies.length === 0) {
    lines.push('No technologies detected');
  } else {
    for (const tech of report.technologies) {
      lines.push(`  - ${tech.name}${tech.version ? ` v${tech.version}` : ''} (${tech.category}, ${tech.confidence} confidence)`);
    }
  }

  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('PAGES SCRAPED');
  lines.push('-'.repeat(60));

  for (const page of report.pages) {
    lines.push(`  ${page.url}`);
    lines.push(`    Title: ${page.title || '(no title)'}`);
    lines.push(`    Links: ${page.links.length} | Images: ${page.images.length} | Load time: ${page.loadTime}ms`);
    if (page.screenshotPath) {
      lines.push(`    Screenshot: ${page.screenshotPath}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Download assets for a page in project mode
 */
async function downloadPageAssets(
  pageData: PageData,
  url: string,
  pageDir: string,
  project: Project,
  projectId: string,
  callback: ProgressCallback | null
): Promise<void> {
  const imageUrls = pageData.images
    .map(img => img.src)
    .filter(src => src && !src.startsWith('data:'));

  if (imageUrls.length === 0) return;

  // Create images directory
  const imagesDir = path.join(pageDir, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  if (callback) {
    callback(projectId, project.progress, `Downloading images: ${imageUrls.length} found`, {
      status: 'downloading_assets',
      url,
      action: 'downloading_assets',
      details: `Downloading ${imageUrls.length} images`,
      timestamp: new Date().toISOString(),
    });
  }

  const results = await downloadAssets(imageUrls, imagesDir, {
    timeout: project.assetTimeout ?? 5000,
    maxSize: project.maxAssetSize ?? 10 * 1024 * 1024,
    baseUrl: url,
    onProgress: (completed, total, result) => {
      if (callback && result.localPath) {
        const filename = path.basename(result.localPath);
        callback(projectId, project.progress, 
          result.success 
            ? `Downloaded: ${filename} (${formatBytes(result.size || 0)})`
            : `Failed: ${filename}`,
          {
            status: 'downloading_assets',
            url,
            action: 'downloading_assets',
            details: `Image ${completed}/${total}: ${filename}`,
            timestamp: new Date().toISOString(),
          }
        );
      }
    },
  });

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`  Assets downloaded: ${successful} success, ${failed} failed`);
}

// Initialize projects on module load
loadProjects();
