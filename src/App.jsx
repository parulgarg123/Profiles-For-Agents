import { useState, useEffect } from 'react'
import './App.css'

function App() {
  // Onboarding State
  const [hasOnboarded, setHasOnboarded] = useState(() => {
    return localStorage.getItem('agent_profiles_onboarded') === 'true';
  });

  // App State
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [workspaces, setWorkspaces] = useState(() => {
    const saved = localStorage.getItem('agent_profiles_workspaces');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  
  // Renaming State
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  // Preview State
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProfileName, setPreviewProfileName] = useState(null);

  // Fallback to first workspace if none selected
  useEffect(() => {
    if (workspaces.length > 0 && !activeWorkspaceId) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, activeWorkspaceId]);

  // Save workspaces whenever they change
  useEffect(() => {
    localStorage.setItem('agent_profiles_workspaces', JSON.stringify(workspaces));
  }, [workspaces]);

  const getActiveDir = () => {
    const folder = workspaces.find(f => f.id === activeWorkspaceId);
    return folder ? folder.path : null;
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
  }, [activeWorkspaceId, hasOnboarded, workspaces]);

  const addWorkspace = async () => {
    if (!window.api) return false;
    const dir = await window.api.openDirectory();
    if (dir) {
      // Check if it already exists to avoid duplicates
      const existing = workspaces.find(f => f.path === dir);
      if (existing) {
        setActiveWorkspaceId(existing.id);
        return existing.id;
      }

      // Extract a default name from the path
      const defaultName = dir.split('/').pop() || 'New Workspace';
      const newFolder = {
        id: `workspace_${Date.now()}`,
        name: defaultName,
        path: dir
      };
      
      setWorkspaces(prev => [...prev, newFolder]);
      setActiveWorkspaceId(newFolder.id);
      return newFolder.id;
    }
    return false;
  };

  const removeWorkspace = (e, id) => {
    e.stopPropagation();
    const isDeletingActive = activeWorkspaceId === id;
    setWorkspaces(prev => {
      const filtered = prev.filter(f => f.id !== id);
      if (isDeletingActive) {
        setActiveWorkspaceId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  const startRename = (e, folder) => {
    e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const finishRename = (id) => {
    if (editingFolderName.trim()) {
      setWorkspaces(prev => prev.map(f => 
        f.id === id ? { ...f, name: editingFolderName.trim() } : f
      ));
    }
    setEditingFolderId(null);
  };

  const handleRenameKeyDown = (e, id) => {
    if (e.key === 'Enter') finishRename(id);
    if (e.key === 'Escape') setEditingFolderId(null);
  };

  const completeOnboarding = async () => {
    const addedId = await addWorkspace();
    if (!addedId) return; // Cancelled picking a folder
    
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

  const deleteProfile = async (name) => {
    if (!window.confirm(`Are you sure you want to permanently delete profile "${name}"?`)) return;
    const dir = getActiveDir();
    if (!dir) return;
    setLoading(true);
    const res = await window.api.deleteProfile(dir, name);
    if (res.success) {
      await loadProfiles();
    } else {
      setError(res.error || 'Failed to delete profile');
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
  const activeWorkspaceName = workspaces.find(f => f.id === activeWorkspaceId)?.name || 'Select Workspace';

  if (!hasOnboarded) {
    return (
      <div className="onboarding-container titlebar-non-draggable">
        <div className="titlebar-draggable"></div>
        <div className="onboarding-content">
          <h1>Welcome to Agent Profiles</h1>
          <p>Supercharge your AI development by creating isolated, context-aware environments. To get started, select your first folder to track (like <code>~/.claude</code> or <code>~/.cline</code>).</p>
          
          <button 
            className="glass-button primary" 
            style={{ fontSize: '18px', padding: '16px 40px', marginTop: '20px' }}
            onClick={completeOnboarding}
          >
            + Browse Folder to Track
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
          
          <div className="sidebar-title">Your Workspaces</div>
          
          {workspaces.map(folder => (
            <div 
              key={folder.id}
              className={`custom-folder-item ${activeWorkspaceId === folder.id ? 'active' : ''}`}
              onClick={() => setActiveWorkspaceId(folder.id)}
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
                  <button className="action-icon-btn delete" onClick={(e) => removeWorkspace(e, folder.id)} title="Remove">
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ))}

          {workspaces.length === 0 && (
            <div style={{ padding: '0 20px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              No workspaces added.
            </div>
          )}

          <div 
            className="tool-item" 
            style={{ marginTop: 'auto', opacity: 0.8, fontSize: '13px' }}
            onClick={addWorkspace}
          >
            <div className="tool-icon" style={{ background: 'transparent' }}>+</div>
            Add Workspace...
          </div>
        </aside>

        <main className="main-content">
          <div className="content-header">
            <h1>{activeWorkspaceName}</h1>
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
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="glass-button primary" style={{ flex: 1 }} onClick={() => switchProfile(profile.name)}>
                            Switch to Profile
                          </button>
                          <button className="glass-button danger" title="Delete Profile" onClick={() => deleteProfile(profile.name)}>
                            🗑️
                          </button>
                        </div>
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
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <p>Please select a workspace or add a new one to begin.</p>
            </div>
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
