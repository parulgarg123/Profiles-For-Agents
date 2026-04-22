import { useState, useEffect } from 'react'
import './App.css'

function App() {
  // Onboarding State
  const [hasOnboarded, setHasOnboarded] = useState(() => {
    return localStorage.getItem('agent_profiles_onboarded') === 'true';
  });

  // App State
  const [activeTool, setActiveTool] = useState('claude');
  const [customFolders, setCustomFolders] = useState(() => {
    const saved = localStorage.getItem('agent_profiles_custom_folders');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [homeDir, setHomeDir] = useState('');
  
  // Renaming State
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  // Preview State
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProfileName, setPreviewProfileName] = useState(null);

  const baseTools = [
    { id: 'claude', name: 'Claude Code', icon: 'C', getPath: (home) => `${home}/.claude` },
    { id: 'rovo', name: 'Rovo CLI', icon: 'R', getPath: (home) => `${home}/.config/rovo` },
    { id: 'cline', name: 'Cline', icon: 'CL', getPath: (home) => `${home}/.cline` },
    { id: 'cursor', name: 'Cursor', icon: 'CR', getPath: (home) => `${home}/.cursor` }
  ];

  useEffect(() => {
    if (window.api && window.api.getHomeDir) {
      window.api.getHomeDir().then(setHomeDir);
    }
  }, []);

  // Save custom folders whenever they change
  useEffect(() => {
    localStorage.setItem('agent_profiles_custom_folders', JSON.stringify(customFolders));
  }, [customFolders]);

  const getActiveDir = () => {
    if (activeTool.startsWith('custom_')) {
      const folder = customFolders.find(f => f.id === activeTool);
      return folder ? folder.path : null;
    }
    const tool = baseTools.find(t => t.id === activeTool);
    if (tool && homeDir) return tool.getPath(homeDir);
    return null;
  };

  const loadProfiles = async () => {
    if (!hasOnboarded) return;
    const dir = getActiveDir();
    if (!dir) {
      setProfiles([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await window.api.getProfiles(dir);
      setProfiles(data.profiles || []);
    } catch (err) {
      setError(err.message || 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, [activeTool, homeDir, hasOnboarded, customFolders]);

  const handleAddCustomFolder = async () => {
    if (!window.api) return false;
    const dir = await window.api.openDirectory();
    if (dir) {
      // Check if it already exists to avoid duplicates
      const existing = customFolders.find(f => f.path === dir);
      if (existing) {
        setActiveTool(existing.id);
        return existing.id;
      }

      // Extract a default name from the path
      const defaultName = dir.split('/').pop() || 'Custom Folder';
      const newFolder = {
        id: `custom_${Date.now()}`,
        name: defaultName,
        path: dir
      };
      
      setCustomFolders(prev => [...prev, newFolder]);
      setActiveTool(newFolder.id);
      return newFolder.id;
    }
    return false;
  };

  const removeCustomFolder = (e, id) => {
    e.stopPropagation();
    setCustomFolders(prev => prev.filter(f => f.id !== id));
    if (activeTool === id) {
      setActiveTool('claude'); // Fallback
    }
  };

  const startRename = (e, folder) => {
    e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const finishRename = (id) => {
    if (editingFolderName.trim()) {
      setCustomFolders(prev => prev.map(f => 
        f.id === id ? { ...f, name: editingFolderName.trim() } : f
      ));
    }
    setEditingFolderId(null);
  };

  const handleRenameKeyDown = (e, id) => {
    if (e.key === 'Enter') finishRename(id);
    if (e.key === 'Escape') setEditingFolderId(null);
  };

  const completeOnboarding = async (isCustom = false) => {
    if (isCustom) {
      const addedId = await handleAddCustomFolder();
      if (!addedId) return; // Cancelled
    }
    localStorage.setItem('agent_profiles_onboarded', 'true');
    setHasOnboarded(true);
    setTimeout(initRepo, 500);
  };

  const initRepo = async () => {
    const dir = getActiveDir();
    if (!dir) return;
    setLoading(true);
    const res = await window.api.initRepo(dir);
    if (res.success) {
      await loadProfiles();
    } else {
      setError(res.error || 'Failed to initialize tracking.');
      setLoading(false);
    }
  };

  const switchProfile = async (name) => {
    const dir = getActiveDir();
    if (!dir) return;
    setLoading(true);
    const res = await window.api.switchProfile(dir, name);
    if (res.success) {
      await loadProfiles();
    } else {
      setError(res.error || 'Failed to switch profile');
      setLoading(false);
    }
  };

  const createProfile = async (blank = false) => {
    if (!newProfileName.trim()) return;
    const dir = getActiveDir();
    if (!dir) return;
    
    setLoading(true);
    const res = await window.api.createProfile(dir, newProfileName.trim(), blank);
    if (res.success) {
      setNewProfileName('');
      setShowNewProfile(false);
      await loadProfiles();
    } else {
      setError(res.error || 'Failed to create profile');
      setLoading(false);
    }
  };

  const openPreview = async (name) => {
    const dir = getActiveDir();
    if (!dir || !window.api.getProfilePreview) return;
    setPreviewProfileName(name);
    setPreviewLoading(true);
    try {
      const data = await window.api.getProfilePreview(dir, name);
      setPreviewData(data);
    } catch (e) {
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewData(null);
    setPreviewProfileName(null);
  };

  const activeDir = getActiveDir();

  // Determine active tool display name
  let activeToolName = 'Select Tool';
  if (activeTool.startsWith('custom_')) {
    activeToolName = customFolders.find(f => f.id === activeTool)?.name || 'Custom Folder';
  } else {
    activeToolName = baseTools.find(t => t.id === activeTool)?.name || 'Select Tool';
  }

  if (!hasOnboarded) {
    return (
      <div className="onboarding-container titlebar-non-draggable">
        <div className="titlebar-draggable"></div>
        <div className="onboarding-content">
          <h1>Welcome to Agent Profiles</h1>
          <p>Supercharge your AI development by creating isolated, context-aware environments. To get started, select your primary Agent CLI.</p>
          
          <div className="tools-selection-grid">
            {baseTools.map(tool => (
              <div 
                key={tool.id} 
                className={`tool-selection-card ${activeTool === tool.id ? 'selected' : ''}`}
                onClick={() => setActiveTool(tool.id)}
              >
                <div className="tool-selection-icon">{tool.icon}</div>
                <div className="tool-selection-name">{tool.name}</div>
              </div>
            ))}
            <div 
              className={`tool-selection-card ${activeTool === 'custom' ? 'selected' : ''}`}
              onClick={() => setActiveTool('custom')}
            >
              <div className="tool-selection-icon">+</div>
              <div className="tool-selection-name">Custom Folder</div>
            </div>
          </div>

          <button 
            className="glass-button primary" 
            style={{ fontSize: '16px', padding: '12px 32px' }}
            onClick={() => completeOnboarding(activeTool === 'custom')}
          >
            Start Journey
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="titlebar-draggable"></div>
      <div className="app-container titlebar-non-draggable">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>Agent Profiles</h2>
          </div>
          
          <div className="sidebar-title">Base Tools</div>
          {baseTools.map(tool => (
            <div 
              key={tool.id}
              className={`tool-item ${activeTool === tool.id ? 'active' : ''}`}
              onClick={() => setActiveTool(tool.id)}
            >
              <div className="tool-icon">{tool.icon}</div>
              {tool.name}
            </div>
          ))}

          <div className="sidebar-divider"></div>
          <div className="sidebar-title">Custom Workspaces</div>
          
          {customFolders.map(folder => (
            <div 
              key={folder.id}
              className={`custom-folder-item ${activeTool === folder.id ? 'active' : ''}`}
              onClick={() => setActiveTool(folder.id)}
            >
              <div className="custom-folder-main">
                <div className="tool-icon" style={{ background: 'transparent' }}>📁</div>
                
                {editingFolderId === folder.id ? (
                  <input
                    autoFocus
                    className="rename-input"
                    value={editingFolderName}
                    onChange={(e) => setEditingFolderName(e.target.value)}
                    onBlur={() => finishRename(folder.id)}
                    onKeyDown={(e) => handleRenameKeyDown(e, folder.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="custom-folder-name" title={folder.path}>
                    {folder.name}
                  </div>
                )}
              </div>

              {editingFolderId !== folder.id && (
                <div className="custom-folder-actions">
                  <button className="action-icon-btn" onClick={(e) => startRename(e, folder)} title="Rename">
                    ✏️
                  </button>
                  <button className="action-icon-btn delete" onClick={(e) => removeCustomFolder(e, folder.id)} title="Remove">
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ))}

          <div 
            className="tool-item" 
            style={{ marginTop: 'auto', opacity: 0.8, fontSize: '12px' }}
            onClick={handleAddCustomFolder}
          >
            <div className="tool-icon">+</div>
            Add Custom Folder...
          </div>
        </aside>

        <main className="main-content">
          <div className="content-header">
            <h1>{activeToolName}</h1>
            <p>Managing configs at: <code>{activeDir || 'No directory selected'}</code></p>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', padding: '16px', borderRadius: '8px', color: 'var(--danger-color)', marginBottom: '20px', border: '1px solid var(--danger-color)' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><p>Loading...</p></div>
          ) : profiles.length === 0 && activeDir ? (
            <div style={{ textAlign: 'center', padding: '40px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>No Git tracking found here.</p>
              <button className="glass-button primary" onClick={initRepo}>Initialize Tracking</button>
            </div>
          ) : activeDir ? (
            <>
              <div className="profiles-grid">
                {profiles.map(profile => (
                  <div key={profile.id} className={`glass-panel profile-card ${profile.isActive ? 'active' : ''}`}>
                    <div className="profile-header">
                      <div className="profile-name">{profile.name}</div>
                      <div className={`status-badge ${profile.isActive ? 'active' : ''}`}>
                        {profile.isActive ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                    
                    <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', flexDirection: 'column' }}>
                      <button className="glass-button" onClick={() => openPreview(profile.name)}>
                        View Details
                      </button>
                      {!profile.isActive && (
                        <button className="glass-button primary" onClick={() => switchProfile(profile.name)}>
                          Switch to Profile
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="action-bar">
                {showNewProfile ? (
                  <div style={{ display: 'flex', gap: '12px', width: '100%', alignItems: 'center' }}>
                    <input 
                      type="text" className="glass-input" placeholder="Profile name..." 
                      value={newProfileName} onChange={e => setNewProfileName(e.target.value)}
                      style={{ flex: 1 }} autoFocus
                    />
                    <button className="glass-button primary" onClick={() => createProfile(false)}>Create Base</button>
                    <button className="glass-button danger" onClick={() => createProfile(true)}>Create Blank</button>
                    <button className="glass-button" onClick={() => setShowNewProfile(false)}>Cancel</button>
                  </div>
                ) : (
                  <button className="glass-button primary" onClick={() => setShowNewProfile(true)}>+ Create New Profile</button>
                )}
              </div>
            </>
          ) : (
            <p>Please select a tool or add a custom folder to begin.</p>
          )}
        </main>
      </div>

      {/* Preview Modal */}
      {(previewLoading || previewData) && (
        <div className="modal-overlay" onClick={closePreview}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Profile: {previewProfileName}</h2>
              <button className="close-btn" onClick={closePreview}>&times;</button>
            </div>
            
            {previewLoading ? (
              <p>Loading preview...</p>
            ) : previewData ? (
              <>
                <div className="preview-section">
                  <h3>MCP Servers ({previewData.mcpServers.length})</h3>
                  {previewData.mcpServers.length === 0 ? (
                    <p style={{color: 'var(--text-secondary)', fontSize: '13px'}}>No MCP servers found.</p>
                  ) : (
                    <ul className="preview-list">
                      {previewData.mcpServers.map((mcp, i) => (
                        <li key={i} className="preview-item">
                          <span>{mcp.name}</span>
                          <span className="preview-badge">{mcp.command}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="preview-section">
                  <h3>Skills ({previewData.skills.length})</h3>
                  {previewData.skills.length === 0 ? (
                    <p style={{color: 'var(--text-secondary)', fontSize: '13px'}}>No skills found.</p>
                  ) : (
                    <ul className="preview-list">
                      {previewData.skills.map((skill, i) => (
                        <li key={i} className="preview-item">
                          <span>{skill.name}</span>
                          <span className="preview-badge">skill</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="preview-section">
                  <h3>Files Tracked ({previewData.filesTracked})</h3>
                  <p style={{fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    {previewData.fileList.slice(0, 5).join(', ')}
                    {previewData.filesTracked > 5 && ' ...'}
                  </p>
                </div>
              </>
            ) : (
              <p>Failed to load profile details.</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default App
