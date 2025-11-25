/**
 * Logger utility for enhanced terminal output
 * 
 * All log functions accept a `verbose` parameter that controls whether
 * to output the message. When false, the message is silently discarded.
 * Callers should pass the config's verbose setting to control logging.
 */

/**
 * Format current timestamp as HH:MM:SS
 */
function getTimestamp(): string {
  const now = new Date();
  return now.toTimeString().slice(0, 8);
}

/**
 * Log a message with timestamp (only if verbose is true)
 */
export function log(message: string, verbose: boolean): void {
  if (verbose) {
    console.log(`[${getTimestamp()}] ${message}`);
  }
}

/**
 * Log info message
 */
export function logInfo(message: string, verbose: boolean): void {
  log(`ℹ️  ${message}`, verbose);
}

/**
 * Log success message
 */
export function logSuccess(message: string, verbose: boolean): void {
  log(`✅ ${message}`, verbose);
}

/**
 * Log warning message
 */
export function logWarning(message: string, verbose: boolean): void {
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
export function logCrawling(url: string, current: number, total: number, verbose: boolean): void {
  log(`🌐 Crawling: ${url} (${current}/${total})`, verbose);
}

/**
 * Log screenshot captured
 */
export function logScreenshot(verbose: boolean): void {
  log(`📸 Screenshot captured`, verbose);
}

/**
 * Log asset download
 */
export function logAssetDownload(type: string, count: number, verbose: boolean): void {
  log(`🖼️  Downloading ${type}: ${count} found`, verbose);
}

/**
 * Log downloaded asset
 */
export function logDownloaded(filename: string, size: string, verbose: boolean): void {
  log(`  ✓ Downloaded: ${filename} (${size})`, verbose);
}

/**
 * Log failed download
 */
export function logDownloadFailed(filename: string, error: string, verbose: boolean): void {
  log(`  ⚠️  Failed: ${filename} (${error})`, verbose);
}

/**
 * Log detected technologies
 */
export function logTechnologies(techs: string[], verbose: boolean): void {
  if (techs.length > 0) {
    log(`📊 Technologies: ${techs.join(', ')}`, verbose);
  }
}

/**
 * Log page completion
 */
export function logPageComplete(durationSeconds: number, verbose: boolean): void {
  log(`✅ Page complete (${durationSeconds.toFixed(1)}s)`, verbose);
}
