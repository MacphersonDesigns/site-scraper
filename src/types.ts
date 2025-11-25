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
  /** Disable CSS/JS animations before screenshots (default: true) */
  disableAnimations?: boolean;
  /** Download all page assets (images, CSS, JS) */
  downloadAssets?: boolean;
  /** Download only images (default: true when downloadAssets is true) */
  downloadImages?: boolean;
  /** Download CSS files */
  downloadCSS?: boolean;
  /** Download JS files */
  downloadJS?: boolean;
  /** Timeout for asset downloads in milliseconds (default: 5000) */
  assetTimeout?: number;
  /** Maximum asset size in bytes (default: 10MB) */
  maxAssetSize?: number;
  /** Show verbose logging output */
  verbose?: boolean;
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
  /** Disable CSS/JS animations before screenshots (default: true) */
  disableAnimations?: boolean;
  /** Download all page assets (images, CSS, JS) */
  downloadAssets?: boolean;
  /** Download only images (default: true when downloadAssets is true) */
  downloadImages?: boolean;
  /** Download CSS files */
  downloadCSS?: boolean;
  /** Download JS files */
  downloadJS?: boolean;
  /** Timeout for asset downloads in milliseconds (default: 5000) */
  assetTimeout?: number;
  /** Maximum asset size in bytes (default: 10MB) */
  maxAssetSize?: number;
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
 * Result of an asset download attempt
 */
export interface AssetDownloadResult {
  /** Original URL of the asset */
  url: string;
  /** Local file path where asset was saved */
  localPath?: string;
  /** Whether the download was successful */
  success: boolean;
  /** Error message if download failed */
  error?: string;
  /** Size of downloaded file in bytes */
  size?: number;
}

/**
 * Detailed progress information
 */
export interface ProgressDetails {
  /** Current status of the operation */
  status: 'scraping' | 'downloading_assets' | 'completed' | 'failed';
  /** Current URL being processed */
  url?: string;
  /** Current action being performed */
  action?: string;
  /** Details about the current action */
  details?: string;
  /** Timestamp of this progress update */
  timestamp: string;
}
