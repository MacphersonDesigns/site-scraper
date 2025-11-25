// API base URL (relative path for same-origin requests)
const API_BASE = '/api';

// Store for projects
let projects = [];
let eventSource = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  loadProjects();
  connectToEvents();
});

// Connect to SSE for real-time updates
function connectToEvents() {
  if (eventSource) {
    eventSource.close();
  }
  
  eventSource = new EventSource(`${API_BASE}/events`);
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.projectId) {
        handleProgressUpdate(data);
      }
    } catch (e) {
      console.error('Error parsing event:', e);
    }
  };
  
  eventSource.onerror = () => {
    console.warn('SSE connection lost, reconnecting...');
    setTimeout(connectToEvents, 3000);
  };
}

// Handle progress updates from SSE
function handleProgressUpdate(data) {
  const project = projects.find(p => p.id === data.projectId);
  if (project) {
    project.progress = data.progress;
    if (data.status === 'Completed') {
      project.status = 'completed';
      showToast('Project completed successfully!', 'success');
      loadProjects(); // Reload to get full data
    } else if (data.status.startsWith('Failed')) {
      project.status = 'failed';
      project.error = data.status.replace('Failed: ', '');
      showToast('Project failed: ' + project.error, 'error');
    }
    renderProjects();
  }
}

// Load all projects
async function loadProjects() {
  try {
    const response = await fetch(`${API_BASE}/projects`);
    if (!response.ok) throw new Error('Failed to load projects');
    projects = await response.json();
    renderProjects();
  } catch (error) {
    console.error('Error loading projects:', error);
    showToast('Failed to load projects', 'error');
    document.getElementById('projects-list').innerHTML = 
      '<div class="empty-state"><h3>Error loading projects</h3><p>Please refresh the page to try again.</p></div>';
  }
}

// Render projects list
function renderProjects() {
  const container = document.getElementById('projects-list');
  
  if (projects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No projects yet</h3>
        <p>Create your first scraping project to get started.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = projects.map(project => `
    <div class="project-card">
      <div class="project-card-header">
        <h3 class="project-card-title">${escapeHtml(project.name)}</h3>
        <span class="project-card-status status-${project.status}">
          ${getStatusIcon(project.status)} ${project.status}
        </span>
      </div>
      
      <div class="project-card-urls">
        ${project.urls.slice(0, 2).map(url => `<div>🔗 ${escapeHtml(truncateUrl(url))}</div>`).join('')}
        ${project.urls.length > 2 ? `<div>+${project.urls.length - 2} more URLs</div>` : ''}
      </div>
      
      <div class="project-card-meta">
        <span>📄 Max ${project.maxPages || 50} pages</span>
        <span>⏱️ ${project.delay || 1000}ms delay</span>
      </div>
      
      ${project.status === 'running' ? `
        <div class="project-card-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${project.progress}%"></div>
          </div>
          <div class="progress-text">${project.progress}% complete</div>
        </div>
      ` : ''}
      
      ${project.error ? `
        <div style="color: var(--error); font-size: 0.75rem; margin-bottom: 1rem;">
          ⚠️ ${escapeHtml(project.error)}
        </div>
      ` : ''}
      
      <div class="project-card-actions">
        ${project.status !== 'running' ? `
          <button class="btn btn-success btn-small" onclick="runProject('${project.id}')">
            ▶️ Run
          </button>
        ` : `
          <button class="btn btn-secondary btn-small" disabled>
            ⏳ Running...
          </button>
        `}
        <button class="btn btn-secondary btn-small" onclick="showProjectDetails('${project.id}')">
          📊 Details
        </button>
        <button class="btn btn-secondary btn-small" onclick="editProject('${project.id}')">
          ✏️ Edit
        </button>
        <button class="btn btn-danger btn-small" onclick="confirmDeleteProject('${project.id}')">
          🗑️ Delete
        </button>
      </div>
    </div>
  `).join('');
}

// Get status icon
function getStatusIcon(status) {
  const icons = {
    idle: '⏸️',
    running: '🔄',
    completed: '✅',
    failed: '❌'
  };
  return icons[status] || '⏸️';
}

// Show create project modal
function showCreateModal() {
  document.getElementById('modal-title').textContent = 'New Project';
  document.getElementById('project-id').value = '';
  document.getElementById('project-form').reset();
  document.getElementById('project-fullpage').checked = true;
  document.getElementById('project-max-pages').value = '50';
  document.getElementById('project-delay').value = '1000';
  document.getElementById('project-width').value = '1920';
  document.getElementById('project-height').value = '1080';
  document.getElementById('project-modal').style.display = 'flex';
}

// Close modal
function closeModal() {
  document.getElementById('project-modal').style.display = 'none';
}

// Close details modal
function closeDetailsModal() {
  document.getElementById('details-modal').style.display = 'none';
}

// Edit project
function editProject(id) {
  const project = projects.find(p => p.id === id);
  if (!project) return;
  
  document.getElementById('modal-title').textContent = 'Edit Project';
  document.getElementById('project-id').value = project.id;
  document.getElementById('project-name').value = project.name;
  document.getElementById('project-urls').value = project.urls.join('\n');
  document.getElementById('project-max-pages').value = project.maxPages || 50;
  document.getElementById('project-delay').value = project.delay || 1000;
  document.getElementById('project-width').value = project.viewportWidth || 1920;
  document.getElementById('project-height').value = project.viewportHeight || 1080;
  document.getElementById('project-fullpage').checked = project.fullPageScreenshots !== false;
  document.getElementById('project-schedule').value = project.schedule || '';
  document.getElementById('project-modal').style.display = 'flex';
}

// Handle project form submit
async function handleProjectSubmit(event) {
  event.preventDefault();
  
  const id = document.getElementById('project-id').value;
  const urls = document.getElementById('project-urls').value
    .split('\n')
    .map(url => url.trim())
    .filter(url => url.length > 0);
  
  // Validate URLs
  for (const url of urls) {
    try {
      new URL(url);
    } catch {
      showToast(`Invalid URL: ${url}`, 'error');
      return;
    }
  }
  
  const data = {
    name: document.getElementById('project-name').value.trim(),
    urls,
    maxPages: parseInt(document.getElementById('project-max-pages').value) || 50,
    delay: parseInt(document.getElementById('project-delay').value) || 1000,
    viewportWidth: parseInt(document.getElementById('project-width').value) || 1920,
    viewportHeight: parseInt(document.getElementById('project-height').value) || 1080,
    fullPageScreenshots: document.getElementById('project-fullpage').checked,
    schedule: document.getElementById('project-schedule').value.trim() || undefined
  };
  
  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/projects/${id}` : `${API_BASE}/projects`;
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save project');
    }
    
    closeModal();
    showToast(id ? 'Project updated!' : 'Project created!', 'success');
    loadProjects();
  } catch (error) {
    console.error('Error saving project:', error);
    showToast(error.message, 'error');
  }
}

// Run project
async function runProject(id) {
  const project = projects.find(p => p.id === id);
  if (!project || project.status === 'running') return;
  
  try {
    const response = await fetch(`${API_BASE}/projects/${id}/run`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start project');
    }
    
    // Update local state
    project.status = 'running';
    project.progress = 0;
    renderProjects();
    showToast('Project started!', 'info');
  } catch (error) {
    console.error('Error running project:', error);
    showToast(error.message, 'error');
  }
}

// Show project details
function showProjectDetails(id) {
  const project = projects.find(p => p.id === id);
  if (!project) return;
  
  document.getElementById('details-title').textContent = project.name;
  
  const report = project.lastReport;
  
  let html = `
    <div class="details-section">
      <h4>Project Configuration</h4>
      <div class="details-grid">
        <div class="details-item">
          <div class="details-label">Status</div>
          <div class="details-value">${getStatusIcon(project.status)} ${project.status}</div>
        </div>
        <div class="details-item">
          <div class="details-label">Progress</div>
          <div class="details-value">${project.progress}%</div>
        </div>
        <div class="details-item">
          <div class="details-label">Max Pages</div>
          <div class="details-value">${project.maxPages || 50}</div>
        </div>
        <div class="details-item">
          <div class="details-label">Delay</div>
          <div class="details-value">${project.delay || 1000}ms</div>
        </div>
        <div class="details-item">
          <div class="details-label">Viewport</div>
          <div class="details-value">${project.viewportWidth || 1920}x${project.viewportHeight || 1080}</div>
        </div>
        <div class="details-item">
          <div class="details-label">Full Page Screenshots</div>
          <div class="details-value">${project.fullPageScreenshots !== false ? 'Yes' : 'No'}</div>
        </div>
        <div class="details-item">
          <div class="details-label">Created</div>
          <div class="details-value">${formatDate(project.createdAt)}</div>
        </div>
        <div class="details-item">
          <div class="details-label">Last Run</div>
          <div class="details-value">${project.lastRun ? formatDate(project.lastRun) : 'Never'}</div>
        </div>
      </div>
      
      <h4>URLs to Scrape</h4>
      <div class="pages-list" style="margin-bottom: 1.5rem;">
        ${project.urls.map(url => `
          <div class="page-item">
            <a href="${escapeHtml(url)}" target="_blank" class="page-url">${escapeHtml(url)}</a>
          </div>
        `).join('')}
      </div>
  `;
  
  if (report) {
    html += `
      <h4>Last Run Results</h4>
      <div class="details-grid">
        <div class="details-item">
          <div class="details-label">Pages Scraped</div>
          <div class="details-value">${report.totalPages}</div>
        </div>
        <div class="details-item">
          <div class="details-label">Duration</div>
          <div class="details-value">${report.duration?.toFixed(2) || 0}s</div>
        </div>
      </div>
      
      ${report.technologies && report.technologies.length > 0 ? `
        <h4>Detected Technologies</h4>
        <div class="tech-tags">
          ${report.technologies.map(tech => `
            <span class="tech-tag">${escapeHtml(tech.name)} (${tech.category})</span>
          `).join('')}
        </div>
      ` : ''}
      
      ${report.pages && report.pages.length > 0 ? `
        <h4 style="margin-top: 1.5rem;">Scraped Pages</h4>
        <div class="pages-list">
          ${report.pages.map(page => `
            <div class="page-item">
              <div>
                <a href="${escapeHtml(page.url)}" target="_blank" class="page-url">${escapeHtml(truncateUrl(page.url))}</a>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                  ${escapeHtml(page.title || '(no title)')}
                </div>
              </div>
              <div class="page-stats">
                ${page.loadTime}ms | ${page.links?.length || 0} links | ${page.images?.length || 0} images
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }
  
  html += '</div>';
  
  document.getElementById('details-content').innerHTML = html;
  document.getElementById('details-modal').style.display = 'flex';
}

// Confirm delete project
function confirmDeleteProject(id) {
  const project = projects.find(p => p.id === id);
  if (!project) return;
  
  if (project.status === 'running') {
    showToast('Cannot delete a running project', 'error');
    return;
  }
  
  if (confirm(`Are you sure you want to delete "${project.name}"? This will also delete all scraped data.`)) {
    deleteProject(id);
  }
}

// Delete project
async function deleteProject(id) {
  try {
    const response = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete project');
    }
    
    showToast('Project deleted!', 'success');
    loadProjects();
  } catch (error) {
    console.error('Error deleting project:', error);
    showToast(error.message, 'error');
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Utility: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Utility: Truncate URL
function truncateUrl(url) {
  if (url.length <= 50) return url;
  return url.substring(0, 47) + '...';
}

// Utility: Format date
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString();
}

// Close modals on backdrop click
document.addEventListener('click', (event) => {
  if (event.target.classList.contains('modal')) {
    event.target.style.display = 'none';
  }
});

// Close modals on Escape key
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    document.getElementById('project-modal').style.display = 'none';
    document.getElementById('details-modal').style.display = 'none';
  }
});
