import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import type { AssetDownloadResult } from '../types';

/**
 * Default timeout for asset downloads (5 seconds)
 */
const DEFAULT_TIMEOUT = 5000;

/**
 * Default maximum asset size (10 MB)
 */
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024;

/**
 * Sanitize a filename by removing/replacing invalid characters
 */
export function sanitizeFilename(filename: string): string {
  // Get the base name from URL path
  let sanitized = filename
    .split('/')
    .pop() || 'unnamed';

  // Remove query string and hash
  sanitized = sanitized.split('?')[0].split('#')[0];

  // Replace invalid characters
  sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');

  // Limit length
  if (sanitized.length > 200) {
    const ext = path.extname(sanitized);
    sanitized = sanitized.substring(0, 200 - ext.length) + ext;
  }

  return sanitized || 'unnamed';
}

/**
 * Get a unique filename by appending a number if needed
 */
export function getUniqueFilename(dir: string, filename: string): string {
  let uniqueName = filename;
  let counter = 1;
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);

  while (fs.existsSync(path.join(dir, uniqueName))) {
    uniqueName = `${base}_${counter}${ext}`;
    counter++;
  }

  return uniqueName;
}

/**
 * Download an asset from a URL to a local file
 */
export async function downloadAsset(
  url: string,
  destDir: string,
  options: {
    timeout?: number;
    maxSize?: number;
    baseUrl?: string;
  } = {}
): Promise<AssetDownloadResult> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;

  try {
    // Resolve relative URLs
    let resolvedUrl = url;
    if (url.startsWith('//')) {
      resolvedUrl = 'https:' + url;
    } else if (url.startsWith('/') && options.baseUrl) {
      const base = new URL(options.baseUrl);
      resolvedUrl = `${base.protocol}//${base.host}${url}`;
    } else if (!url.startsWith('http') && options.baseUrl) {
      resolvedUrl = new URL(url, options.baseUrl).href;
    }

    // Skip data URLs - they're embedded
    if (resolvedUrl.startsWith('data:')) {
      return {
        url,
        success: false,
        error: 'Skipped data URL (embedded content)',
      };
    }

    // Validate URL
    const parsedUrl = new URL(resolvedUrl);

    // Ensure destination directory exists
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Get filename and ensure it's unique
    const rawFilename = sanitizeFilename(parsedUrl.pathname);
    const filename = getUniqueFilename(destDir, rawFilename);
    const localPath = path.join(destDir, filename);

    // Download the file
    const size = await downloadFile(resolvedUrl, localPath, timeout, maxSize);

    return {
      url,
      localPath,
      success: true,
      size,
    };
  } catch (error) {
    return {
      url,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Download a file using native HTTP/HTTPS modules
 */
function downloadFile(
  url: string,
  destPath: string,
  timeout: number,
  maxSize: number
): Promise<number> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const httpModule = parsedUrl.protocol === 'https:' ? https : http;

    const request = httpModule.get(url, { timeout }, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, destPath, timeout, maxSize)
            .then(resolve)
            .catch(reject);
          return;
        }
      }

      // Check for successful response
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      // Check content length if available
      const contentLength = parseInt(response.headers['content-length'] || '0', 10);
      if (contentLength > maxSize) {
        reject(new Error(`File too large: ${contentLength} bytes (max: ${maxSize})`));
        return;
      }

      let downloadedSize = 0;
      const chunks: Buffer[] = [];

      response.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;
        if (downloadedSize > maxSize) {
          request.destroy();
          reject(new Error(`File too large: exceeded ${maxSize} bytes`));
          return;
        }
        chunks.push(chunk);
      });

      response.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          fs.writeFileSync(destPath, buffer);
          resolve(buffer.length);
        } catch (error) {
          reject(error);
        }
      });

      response.on('error', reject);
    });

    request.on('timeout', () => {
      request.destroy();
      reject(new Error(`Download timed out after ${timeout}ms`));
    });

    request.on('error', reject);
  });
}

/**
 * Download multiple assets in parallel with a concurrency limit
 */
export async function downloadAssets(
  urls: string[],
  destDir: string,
  options: {
    timeout?: number;
    maxSize?: number;
    baseUrl?: string;
    concurrency?: number;
    onProgress?: (completed: number, total: number, result: AssetDownloadResult) => void;
  } = {}
): Promise<AssetDownloadResult[]> {
  const concurrency = options.concurrency ?? 5;
  const results: AssetDownloadResult[] = [];
  let completed = 0;

  // Create batches
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(url => downloadAsset(url, destDir, options))
    );

    for (const result of batchResults) {
      results.push(result);
      completed++;
      if (options.onProgress) {
        options.onProgress(completed, urls.length, result);
      }
    }
  }

  return results;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
