import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let projectionWindow = null;

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'SanctiFlow Dashboard',
    icon: path.join(__dirname, '../public/logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  const startUrl = isDev 
    ? 'http://localhost:5173' 
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (projectionWindow) {
      projectionWindow.close();
    }
  });
}

function createProjectionWindow() {
  const displays = screen.getAllDisplays();
  const externalDisplay = displays.find((display) => {
    return display.bounds.x !== 0 || display.bounds.y !== 0;
  });

  const bounds = externalDisplay ? externalDisplay.bounds : displays[0].bounds;

  projectionWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    title: 'SanctiFlow Projection',
    icon: path.join(__dirname, '../public/logo.png'),
    fullscreen: !!externalDisplay, // Auto fullscreen on second monitor
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const startUrl = isDev 
    ? 'http://localhost:5173/projection' 
    : `file://${path.join(__dirname, '../dist/index.html')}#/projection`;

  projectionWindow.loadURL(startUrl);

  projectionWindow.on('closed', () => {
    projectionWindow = null;
  });
}

app.whenReady().then(() => {
  createMainWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
