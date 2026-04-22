import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { GitManager } from './git-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset', // Makes it look native on Mac
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // For production, we would load the built dist folder
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setTitle('Agents'); // Shows text in the Mac menu bar
  tray.setToolTip('Agent Profiles Manager');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Dashboard', click: () => {
        if (!mainWindow) createWindow();
        else { mainWindow.show(); mainWindow.focus(); }
      } 
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Setup IPC handlers
ipcMain.handle('git:getProfiles', async (event, dir) => {
  GitManager.startWatcher(dir);
  return await GitManager.getProfiles(dir);
});

ipcMain.handle('git:initRepo', async (event, dir) => {
  try {
    await GitManager.initRepo(dir);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git:createProfile', async (event, dir, name, blank) => {
  try {
    await GitManager.createProfile(dir, name, blank);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git:switchProfile', async (event, dir, name) => {
  try {
    await GitManager.switchProfile(dir, name);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('git:getProfilePreview', async (event, dir, name) => {
  try {
    return await GitManager.getProfilePreview(dir, name);
  } catch (error) {
    return null;
  }
});

ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'showHiddenFiles']
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

import os from 'os';
ipcMain.handle('system:getHomeDir', () => os.homedir());
