import { describe, it, expect } from 'vitest';
import type { Project, ProjectConfig, ProjectStatus } from '../src/types';

describe('Project Types', () => {
  it('should allow valid ProjectConfig', () => {
    const config: ProjectConfig = {
      id: 'proj_123',
      name: 'Test Project',
      urls: ['https://example.com'],
      maxPages: 50,
      delay: 1000,
      fullPageScreenshots: true,
      viewportWidth: 1920,
      viewportHeight: 1080,
      schedule: '0 0 * * *',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(config.id).toBe('proj_123');
    expect(config.name).toBe('Test Project');
    expect(config.urls).toHaveLength(1);
  });

  it('should allow minimal ProjectConfig', () => {
    const config: ProjectConfig = {
      id: 'proj_456',
      name: 'Minimal Project',
      urls: ['https://example.com'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(config.id).toBeDefined();
    expect(config.maxPages).toBeUndefined();
  });

  it('should validate Project with status', () => {
    const project: Project = {
      id: 'proj_789',
      name: 'Running Project',
      urls: ['https://example.com', 'https://another.com'],
      maxPages: 100,
      delay: 500,
      fullPageScreenshots: true,
      viewportWidth: 1920,
      viewportHeight: 1080,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'running',
      progress: 50,
    };

    expect(project.status).toBe('running');
    expect(project.progress).toBe(50);
    expect(project.urls).toHaveLength(2);
  });

  it('should support all ProjectStatus values', () => {
    const statuses: ProjectStatus[] = ['idle', 'running', 'completed', 'failed'];
    
    for (const status of statuses) {
      const project: Project = {
        id: 'proj_test',
        name: 'Status Test',
        urls: ['https://example.com'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status,
        progress: status === 'completed' ? 100 : 0,
      };

      expect(project.status).toBe(status);
    }
  });

  it('should allow Project with lastReport', () => {
    const project: Project = {
      id: 'proj_complete',
      name: 'Completed Project',
      urls: ['https://example.com'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'completed',
      progress: 100,
      lastRun: new Date().toISOString(),
      lastReport: {
        baseUrl: 'https://example.com',
        totalPages: 5,
        pages: [],
        technologies: [],
        siteStructure: [],
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 10.5,
      },
    };

    expect(project.lastReport).toBeDefined();
    expect(project.lastReport?.totalPages).toBe(5);
  });

  it('should allow Project with error', () => {
    const project: Project = {
      id: 'proj_failed',
      name: 'Failed Project',
      urls: ['https://invalid-url'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'failed',
      progress: 25,
      error: 'Connection refused',
    };

    expect(project.status).toBe('failed');
    expect(project.error).toBe('Connection refused');
  });
});
