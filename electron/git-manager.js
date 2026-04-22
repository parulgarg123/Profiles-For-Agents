import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export class GitManager {
  static watchers = new Map();
  
  static async executeGitCommand(dir, command) {
    try {
      const { stdout, stderr } = await execAsync(`git ${command}`, { cwd: dir });
      return { success: true, stdout, stderr };
    } catch (error) {
      console.error(`Git Error in ${dir}: ${command}`, error);
      return { success: false, error: error.message };
    }
  }

  static async isGitRepo(dir) {
    try {
      await fs.access(path.join(dir, '.git'));
      return true;
    } catch {
      return false;
    }
  }

  static async initRepo(dir) {
    // Ensure directory exists
    try {
      await fs.access(dir);
    } catch {
      // If it doesn't exist, we can't init. The user needs to run the tool first.
      throw new Error(`Directory ${dir} does not exist.`);
    }

    const isRepo = await this.isGitRepo(dir);
    if (!isRepo) {
      await this.executeGitCommand(dir, 'init');
      await this.executeGitCommand(dir, 'add .');
      await this.executeGitCommand(dir, 'commit -m "Initial backup"');
      // Ensure branch is named 'default'
      await this.executeGitCommand(dir, 'branch -m default || git checkout -b default');
    }
  }

  static async getProfiles(dir) {
    const isRepo = await this.isGitRepo(dir);
    if (!isRepo) {
      return { active: null, profiles: [] };
    }

    const result = await this.executeGitCommand(dir, 'branch');
    if (!result.success) return { active: null, profiles: [] };

    const lines = result.stdout.split('\n').filter(l => l.trim() !== '');
    const profiles = lines.map(line => {
      const isActive = line.startsWith('*');
      const name = line.replace('*', '').trim();
      return { id: name, name, isActive };
    });

    const active = profiles.find(p => p.isActive)?.id || null;
    return { active, profiles };
  }

  static async saveState(dir) {
    await this.executeGitCommand(dir, 'add .');
    await this.executeGitCommand(dir, 'commit -m "Auto save before switch"');
  }

  static async createProfile(dir, name, blank = false) {
    await this.initRepo(dir);
    await this.saveState(dir);

    if (blank) {
      // Create an orphan branch (no history, blank slate)
      await this.executeGitCommand(dir, `checkout --orphan ${name}`);
      // Remove all tracked files
      await this.executeGitCommand(dir, 'rm -rf .');
      // Create an empty commit so the branch exists without any files
      await this.executeGitCommand(dir, `commit --allow-empty -m "Init blank profile ${name}"`);
    } else {
      await this.executeGitCommand(dir, `checkout -b ${name}`);
    }
  }

  static async switchProfile(dir, name) {
    await this.initRepo(dir);
    await this.saveState(dir);
    
    const result = await this.executeGitCommand(dir, `checkout ${name}`);
    if (!result.success) {
      throw new Error(`Failed to switch profile: ${result.error}`);
    }
  }

  static async deleteProfile(dir, name) {
    const result = await this.executeGitCommand(dir, `branch -D ${name}`);
    if (!result.success) {
      throw new Error(`Failed to delete profile: ${result.error}`);
    }
  }
  static async getProfilePreview(dir, branchName) {
    const isRepo = await this.isGitRepo(dir);
    if (!isRepo) return null;

    // List all files in the branch
    const lsResult = await this.executeGitCommand(dir, `ls-tree -r --name-only ${branchName}`);
    if (!lsResult.success) return null;

    const files = lsResult.stdout.split('\n').filter(l => l.trim() !== '');
    
    // Find interesting JSON configs
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const previewData = {
      filesTracked: files.length,
      fileList: files,
      mcpServers: [],
      skills: []
    };

    for (const file of jsonFiles) {
      const contentResult = await this.executeGitCommand(dir, `show ${branchName}:${file}`);
      if (!contentResult.success) continue;

      try {
        const parsed = JSON.parse(contentResult.stdout);
        // Look for MCP servers
        if (parsed.mcpServers) {
          Object.keys(parsed.mcpServers).forEach(serverName => {
            previewData.mcpServers.push({
              name: serverName,
              file: file,
              command: parsed.mcpServers[serverName].command || 'unknown'
            });
          });
        }
        // Look for skills
        if (parsed.skills && Array.isArray(parsed.skills)) {
          parsed.skills.forEach(skill => {
            previewData.skills.push({
              name: skill.name || skill,
              file: file
            });
          });
        }
      } catch (e) {
        // Ignore JSON parse errors for malformed or non-standard configs
      }
    }

    return previewData;
  }

  static startWatcher(dir) {
    if (this.watchers.has(dir)) return; // Already watching

    try {
      let timeout = null;
      const watcher = fsSync.watch(dir, { recursive: true }, (eventType, filename) => {
        if (filename && filename.includes('.git')) return; // Ignore git internal changes

        // Debounce commits to avoid spamming
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(async () => {
          console.log(`Auto-committing changes in ${dir} due to file modification: ${filename}`);
          await this.executeGitCommand(dir, 'add .');
          await this.executeGitCommand(dir, 'commit -m "Auto save background changes"');
        }, 2000); // Wait 2s for changes to settle
      });

      this.watchers.set(dir, watcher);
      console.log(`Started watching ${dir} for auto-commits.`);
    } catch (e) {
      console.error(`Failed to watch ${dir}:`, e);
    }
  }

  static stopWatcher(dir) {
    if (this.watchers.has(dir)) {
      this.watchers.get(dir).close();
      this.watchers.delete(dir);
      console.log(`Stopped watching ${dir}`);
    }
  }
}
