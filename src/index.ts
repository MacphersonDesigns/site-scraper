// Main exports
export { SiteCrawler, crawlSite } from './crawler';
export { detectTechnologies } from './tech-detector';
export {
  extractPageData,
  extractLinks,
  extractImages,
  extractHeadings,
  extractStructure,
  extractTextContent,
  extractMetadata,
} from './extractor';

// Type exports
export type {
  ScraperConfig,
  LinkInfo,
  ImageInfo,
  StructuralElement,
  TechnologyInfo,
  PageData,
  SiteReport,
} from './types';
