const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");

const API_PORT = process.env.PORT || "4000";
let apiProcess = null;

function startPackagedApi() {
  if (!app.isPackaged) return;

  const appPath = app.getAppPath();
  const serverEntry = path.join(appPath, "server", "src", "index.js");

  apiProcess = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(API_PORT)
    },
    stdio: "pipe"
  });

  apiProcess.stdout.on("data", (chunk) => {
    process.stdout.write(`[api] ${chunk}`);
  });

  apiProcess.stderr.on("data", (chunk) => {
    process.stderr.write(`[api:error] ${chunk}`);
  });

  apiProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`API finalizo con codigo ${code}`);
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 680,
    backgroundColor: "#fff4fa",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  if (app.isPackaged) {
    const htmlPath = path.join(app.getAppPath(), "dist", "index.html");
    win.loadFile(htmlPath);
    return;
  }

  win.loadURL("http://localhost:5173");
}

app.whenReady().then(() => {
  startPackagedApi();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  if (apiProcess && !apiProcess.killed) {
    apiProcess.kill("SIGTERM");
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
