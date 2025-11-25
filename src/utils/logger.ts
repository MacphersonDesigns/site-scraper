/**
 * Logger utility for enhanced terminal output
 */

/**
 * Format current timestamp as HH:MM:SS
 */
function getTimestamp(): string {
  const now = new Date();
  return now.toTimeString().slice(0, 8);
}

/**
 * Log a message with timestamp
 */
export function log(message: string, verbose = true): void {
  if (verbose) {
    console.log(`[${getTimestamp()}] ${message}`);
  }
}

/**
 * Log info message
 */
export function logInfo(message: string, verbose = true): void {
  log(`ℹ️  ${message}`, verbose);
}

/**
 * Log success message
 */
export function logSuccess(message: string, verbose = true): void {
  log(`✅ ${message}`, verbose);
}

/**
 * Log warning message
 */
export function logWarning(message: string, verbose = true): void {
  log(`⚠️  ${message}`, verbose);
}

/**
 * Log error message (always shown)
 */
export function logError(message: string): void {
  console.error(`[${getTimestamp()}] ❌ ${message}`);
}

/**
 * Log crawling status
 */
export function logCrawling(url: string, current: number, total: number, verbose = true): void {
  log(`🌐 Crawling: ${url} (${current}/${total})`, verbose);
}

/**
 * Log screenshot captured
 */
export function logScreenshot(verbose = true): void {
  log(`📸 Screenshot captured`, verbose);
}

/**
 * Log asset download
 */
export function logAssetDownload(type: string, count: number, verbose = true): void {
  log(`🖼️  Downloading ${type}: ${count} found`, verbose);
}

/**
 * Log downloaded asset
 */
export function logDownloaded(filename: string, size: string, verbose = true): void {
  log(`  ✓ Downloaded: ${filename} (${size})`, verbose);
}

/**
 * Log failed download
 */
export function logDownloadFailed(filename: string, error: string, verbose = true): void {
  log(`  ⚠️  Failed: ${filename} (${error})`, verbose);
}

/**
 * Log detected technologies
 */
export function logTechnologies(techs: string[], verbose = true): void {
  if (techs.length > 0) {
    log(`📊 Technologies: ${techs.join(', ')}`, verbose);
  }
}

/**
 * Log page completion
 */
export function logPageComplete(durationSeconds: number, verbose = true): void {
  log(`✅ Page complete (${durationSeconds.toFixed(1)}s)`, verbose);
}
