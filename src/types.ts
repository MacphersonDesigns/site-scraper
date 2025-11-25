/**
 * Configuration options for the site scraper
 */
export interface ScraperConfig {
  /** Base URL to start crawling from */
  baseUrl: string;
  /** Maximum number of pages to crawl (0 for unlimited) */
  maxPages?: number;
  /** Directory to save screenshots */
  screenshotDir?: string;
  /** Directory to save output reports */
  outputDir?: string;
  /** Request delay in milliseconds between pages */
  delay?: number;
  /** Screenshot quality (0-100) for JPEG format */
  screenshotQuality?: number;
  /** Whether to capture full page screenshots */
  fullPageScreenshots?: boolean;
  /** Viewport width for screenshots */
  viewportWidth?: number;
  /** Viewport height for screenshots */
  viewportHeight?: number;
}

/**
 * Extracted link information
 */
export interface LinkInfo {
  /** Link text content */
  text: string;
  /** Link href attribute */
  href: string;
  /** Whether link is internal or external */
  isInternal: boolean;
}

/**
 * Extracted image information
 */
export interface ImageInfo {
  /** Image src attribute */
  src: string;
  /** Image alt text */
  alt: string;
  /** Image width (if available) */
  width?: number;
  /** Image height (if available) */
  height?: number;
}

/**
 * Structural element information
 */
export interface StructuralElement {
  /** HTML tag name */
  tag: string;
  /** Element ID (if present) */
  id?: string;
  /** Element classes */
  classes: string[];
  /** Element text content */
  text?: string;
  /** Number of children */
  childCount: number;
}

/**
 * Detected technology/library information
 */
export interface TechnologyInfo {
  /** Technology name */
  name: string;
  /** Version (if detected) */
  version?: string;
  /** Category (framework, library, analytics, etc.) */
  category: string;
  /** Detection confidence (high, medium, low) */
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Page data extracted from a single page
 */
export interface PageData {
  /** Page URL */
  url: string;
  /** Page title */
  title: string;
  /** Meta description */
  metaDescription?: string;
  /** All extracted text content */
  textContent: string;
  /** Extracted headings */
  headings: { level: number; text: string }[];
  /** Extracted links */
  links: LinkInfo[];
  /** Extracted images */
  images: ImageInfo[];
  /** Structural elements */
  structure: StructuralElement[];
  /** Screenshot file path */
  screenshotPath?: string;
  /** Detected technologies (page-specific scripts) */
  technologies: TechnologyInfo[];
  /** HTTP status code */
  statusCode: number;
  /** Page load time in milliseconds */
  loadTime: number;
  /** Timestamp of when page was scraped */
  scrapedAt: string;
}

/**
 * Complete site report
 */
export interface SiteReport {
  /** Base URL that was scraped */
  baseUrl: string;
  /** Total pages scraped */
  totalPages: number;
  /** All page data */
  pages: PageData[];
  /** Site-wide detected technologies */
  technologies: TechnologyInfo[];
  /** Site structure (page hierarchy) */
  siteStructure: {
    url: string;
    title: string;
    children: string[];
  }[];
  /** Scrape start time */
  startTime: string;
  /** Scrape end time */
  endTime: string;
  /** Total duration in seconds */
  duration: number;
}

/**
 * Project status values
 */
export type ProjectStatus = 'idle' | 'running' | 'completed' | 'failed';

/**
 * Configuration for a scraping project
 */
export interface ProjectConfig {
  /** Unique project identifier */
  id: string;
  /** Human-readable project name */
  name: string;
  /** URLs to scrape */
  urls: string[];
  /** Maximum pages to crawl per URL (0 for unlimited) */
  maxPages?: number;
  /** Request delay in milliseconds */
  delay?: number;
  /** Whether to capture full page screenshots */
  fullPageScreenshots?: boolean;
  /** Viewport width for screenshots */
  viewportWidth?: number;
  /** Viewport height for screenshots */
  viewportHeight?: number;
  /** Scheduling cron expression (optional) */
  schedule?: string;
  /** Date when project was created */
  createdAt: string;
  /** Date when project was last updated */
  updatedAt: string;
}

/**
 * Project status and metadata
 */
export interface Project extends ProjectConfig {
  /** Current status of the project */
  status: ProjectStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Error message if status is 'failed' */
  error?: string;
  /** Last run timestamp */
  lastRun?: string;
  /** Report from last completed run */
  lastReport?: SiteReport;
}

/**
 * Configuration options for the site cloner
 */
export interface ClonerConfig {
  /** URL of the website to clone */
  url: string;
  /** Output directory for cloned files (default: ./cloned-sites/<hostname>) */
  outputDir?: string;
  /** Whether to download images (default: true) */
  downloadImages?: boolean;
  /** Whether to download CSS files (default: true) */
  downloadCss?: boolean;
  /** Whether to download JavaScript files (default: true) */
  downloadJs?: boolean;
  /** Timeout for page load in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Information about a downloaded asset
 */
export interface ClonedAsset {
  /** Original URL of the asset */
  originalUrl: string;
  /** Local file path where asset was saved */
  localPath: string;
  /** Type of asset (html, css, js, image) */
  type: 'html' | 'css' | 'js' | 'image';
  /** Size in bytes */
  size: number;
}

/**
 * Result of a site cloning operation
 */
export interface CloneResult {
  /** URL that was cloned */
  url: string;
  /** Output directory where files were saved */
  outputDir: string;
  /** HTML file path */
  htmlPath: string;
  /** List of all downloaded assets */
  assets: ClonedAsset[];
  /** Total number of assets downloaded */
  totalAssets: number;
  /** Total size in bytes */
  totalSize: number;
  /** Cloning start time */
  startTime: string;
  /** Cloning end time */
  endTime: string;
  /** Duration in seconds */
  duration: number;
  /** Any errors encountered during cloning */
  errors: string[];
}
