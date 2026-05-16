const { app, BrowserWindow, dialog } = require("electron");
const { fork } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const isDev = !app.isPackaged;
const apiPort = process.env.MARKETSYS_API_PORT || process.env.PORT || "5000";
const apiUrl = `http://127.0.0.1:${apiPort}`;

let mainWindow = null;
let backendProcess = null;

const resolveAppPath = (...segments) => {
  if (isDev) return path.join(app.getAppPath(), ...segments);
  return path.join(process.resourcesPath, ...segments);
};

const waitForApi = (timeoutMs = 20000) => {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`${apiUrl}/api/health`, (res) => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
          return;
        }
        retry();
      });

      req.on("error", retry);
      req.setTimeout(1200, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("No se pudo iniciar la API local de MarketSYS."));
        return;
      }
      setTimeout(check, 600);
    };

    check();
  });
};

const startBackend = () => {
  const backendDir = resolveAppPath("backend");
  const backendEntry = path.join(backendDir, "src", "index.js");

  backendProcess = fork(backendEntry, [], {
    cwd: backendDir,
    env: {
      ...process.env,
      ELECTRON_APP: "1",
      PORT: apiPort,
      CORS_ORIGIN: `${apiUrl},http://localhost:5173,http://127.0.0.1:5173`,
    },
    stdio: "inherit",
  });

  backendProcess.on("exit", (code) => {
    if (!app.isQuitting) {
      console.error(`MarketSYS API finalizo con codigo ${code}`);
    }
  });
};

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 780,
    minWidth: 1100,
    minHeight: 680,
    title: "MarketSYS",
    backgroundColor: "#f4f6ff",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(resolveAppPath("frontend", "dist", "index.html"));
  }
};

app.whenReady().then(async () => {
  startBackend();

  try {
    await waitForApi();
  } catch (error) {
    dialog.showErrorBox("MarketSYS", `${error.message}\n\nRevisa la configuracion de backend/.env y MySQL.`);
  }

  await createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
