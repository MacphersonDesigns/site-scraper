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
export {
  createProject,
  getAllProjects,
  getProject,
  updateProject,
  deleteProject,
  runProject,
  loadProjects,
  setProgressCallback,
} from './project-manager';
export { startServer } from './server';

// Type exports
export type {
  ScraperConfig,
  LinkInfo,
  ImageInfo,
  StructuralElement,
  TechnologyInfo,
  PageData,
  SiteReport,
  ProjectConfig,
  Project,
  ProjectStatus,
} from './types';
