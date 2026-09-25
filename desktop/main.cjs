// نسخة الكمبيوتر (قسم 24): نفس اللعبة داخل Electron، بمتصفح ثابت بيتعامل مع المايك بنفس الطريقة عند الكل.
// اللعبة نفسها هي ملف واحد (app/index.html) بيتبني بـ npm run build:desktop من المجلد الرئيسي.
const { app, BrowserWindow, session } = require('electron');
const path = require('path');

// الصلاحيات اللي بتحتاجها اللعبة بس: المايك، قفل الماوس، والشاشة الكاملة
const ALLOWED = new Set(['media', 'pointerLock', 'fullscreen']);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: '#050404',
    autoHideMenuBar: true,
    title: 'السعلوة',
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  // الروابط الخارجية ما بتفتح جوّا اللعبة
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(ALLOWED.has(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => ALLOWED.has(permission));
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
