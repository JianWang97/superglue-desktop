// ==================== Imports ====================
// External imports
import {
  logEmitter,
  logMessage,
  restartServer,
  startServer as startCoreServer,
} from "@superglue/core";
import { config } from "dotenv";
import express from "express";
import { createServer, Server } from "http";
import * as path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs";

// Electron imports
import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from "electron";

// ==================== Constants ====================
const STATIC_SERVER_PORT = 3002;
const WINDOW_CONFIG = {
  width: 1680,
  height: 900,
  autoHideMenuBar: true,
} as const;

// ==================== Global Variables ====================
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let serverStarted = false;
let staticServer: Server | null = null;
let singleInstanceLock: boolean = false;

// ==================== Utility Functions ====================
// ES模块中获取当前文件目录的方法
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 检查是否为开发者模式
const isDevelopment = process.env.NODE_ENV === "development" || !app.isPackaged;

/**
 * 获取应用根目录
 * @returns 应用根目录路径
 */
const getAppPath = (): string => {
  if (app.isPackaged) {
    // 打包后：从 resources 目录获取
    return process.resourcesPath;
  } else {
    // 开发时：从项目根目录获取
    return path.join(__dirname, "..", "..", "..", "..");
  }
};

/**
 * 初始化环境配置
 */
const initializeEnvironment = (): void => {
  const envPath = path.join(getAppPath(), ".env");

  try {
    config({ path: envPath,override: true });
    logMessage("info", `✅ Loaded .env from: ${envPath}`);
  } catch (error) {
    logMessage("error", `Failed to load .env file from ${envPath}: ${error}`);
  }

  if (isDevelopment) {
    logMessage("info", "🔧 Running in development mode");
    logMessage("info", `📂 Environment file path: ${envPath}`);
  }
};

/**
 * 检查并获取单例锁
 * @returns 是否成功获取锁
 */
function checkSingleInstance(): boolean {
  // 尝试获取单例锁
  singleInstanceLock = app.requestSingleInstanceLock();

  if (!singleInstanceLock) {
    logMessage(
      "warn",
      "Another instance of the application is already running"
    );
    return false;
  }

  // 当第二个实例尝试启动时的处理
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    logMessage("info", "Second instance detected, focusing existing window");

    // 如果窗口存在，显示并聚焦
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
    }
  });

  return true;
}

// ==================== Server Functions ====================

/**
 * 启动 GraphQL 服务器
 */
async function startGraphQLServer(): Promise<void> {
  if (serverStarted) {
    logMessage("info", "GraphQL server already started");
    return;
  }

  try {
    logMessage("info", "Starting GraphQL server...");
    await startCoreServer();
    serverStarted = true;
    logMessage("info", "GraphQL server started successfully");
  } catch (error) {
    logMessage("error", `Failed to start GraphQL server: ${error}`);
    throw error;
  }
}

/**
 * 启动静态文件服务器
 * @returns 服务器URL
 */
async function startStaticServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const expressApp = express();

    // 确定静态文件目录
    const staticDir = getStaticDirectory();
    logMessage("info", `Starting static server for directory: ${staticDir}`);

    // 配置静态文件服务
    expressApp.use(
      express.static(staticDir, {
        index: "index.html",
        dotfiles: "deny",
        etag: false,
        lastModified: false,
        maxAge: 0,
      })
    );

    // 处理 SPA 路由 - 所有未匹配的路由都返回 index.html
    expressApp.get("*", handleSpaRouting(staticDir));

    // 启动服务器
    staticServer = createServer(expressApp);

    staticServer.listen(STATIC_SERVER_PORT, "localhost", () => {
      const url = `http://localhost:${STATIC_SERVER_PORT}`;
      logMessage("info", `✅ Static server started at: ${url}`);
      resolve(url);
    });

    staticServer.on("error", (error: Error) => {
      logMessage("error", `Failed to start static server: ${error}`);
      reject(error);
    });
  });
}

/**
 * 获取静态文件目录
 */
function getStaticDirectory(): string {
  if (app.isPackaged) {
    return path.join(getAppPath(), "web");
  } else {
    return path.join(__dirname, "..", "..", "..", "web", "dist", "web");
  }
}

/**
 * 处理 SPA 路由的中间件
 */
function handleSpaRouting(staticDir: string) {
  return (req: express.Request, res: express.Response) => {
    const requestedPath = req.path;

    // 检查是否是静态资源（排除.html文件）
    const isStaticFile =
      /\.[a-zA-Z0-9]+$/.test(requestedPath) && !/\.(html)$/.test(requestedPath);

    // 如果是静态资源且文件不存在，返回404
    if (isStaticFile) {
      const filePath = path.join(staticDir, requestedPath);
      if (!fs.existsSync(filePath)) {
        res.status(404).send("File not found");
        return;
      }
    }

    // 对于SPA路由，返回index.html
    const indexPath = path.join(staticDir, "index.html");
    logMessage("info", `Serving SPA route: ${requestedPath} -> index.html`);

    res.sendFile(indexPath, (err) => {
      if (err) {
        logMessage("error", `Failed to serve index.html: ${err}`);
        res.status(500).send("Error loading application");
      }
    });
  };
}

// ==================== Window Management Functions ====================

/**
 * 显示窗口
 */
function showWindow(): void {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
}

/**
 * 隐藏窗口
 */
function hideWindow(): void {
  if (mainWindow) {
    mainWindow.hide();
  }
}

/**
 * 创建窗口并加载应用
 */
async function createWindow(): Promise<void> {
  // 获取应用图标
  const appIcon = getAppIcon();

  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    ...WINDOW_CONFIG,
    icon: appIcon, // 设置窗口图标
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, "preload.js"),
      devTools: isDevelopment,
    },
  });

  // 删除默认菜单
  Menu.setApplicationMenu(null);

  try {
    // 启动静态文件服务器
    const serverUrl = await startStaticServer();

    // 在开发模式下打开开发者工具
    if (isDevelopment) {
      mainWindow.webContents.openDevTools();
    }

    logMessage("info", `Loading application from: ${serverUrl}`);
    await mainWindow.loadURL(serverUrl);

    // 设置事件监听器
    setupWindowEventListeners();
  } catch (error) {
    logMessage("error", `Failed to create window: ${error}`);
    throw error;
  }
}

/**
 * 设置窗口事件监听器
 */
function setupWindowEventListeners(): void {
  if (!mainWindow) return;

  // 监听加载错误
  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription) => {
      logMessage("error", `Failed to load: ${errorDescription} (${errorCode})`);
    }
  );

  // 窗口关闭时隐藏到托盘而不是退出
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hideWindow();

      // 在Windows上显示托盘通知
      if (process.platform === "win32" && tray) {
        tray.displayBalloon({
          iconType: "info",
          title: "Superglue",
          content: "应用已最小化到系统托盘",
        });
      }
    }
  });

  // 窗口完全关闭时清理
  mainWindow.on("closed", () => {
    mainWindow = null;
    // 关闭静态服务器
    if (staticServer) {
      staticServer.close(() => {
        logMessage("info", "Static server closed");
      });
      staticServer = null;
    }
  });
}

// ==================== Tray Functions ====================

/**
 * 创建系统托盘
 */
function createTray(): void {
  const trayIcon = getTrayIcon();
  tray = new Tray(trayIcon);

  // 设置托盘属性
  tray.setContextMenu(createTrayMenu());
  tray.setToolTip("Superglue Desktop");

  // 双击托盘图标显示/隐藏窗口
  tray.on("double-click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        hideWindow();
      } else {
        showWindow();
      }
    }
  });
}

/**
 * 获取应用图标
 */
function getAppIcon(): Electron.NativeImage {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "tray-icon.ico")
    : path.join(__dirname, "..", "..", "src", "tray-icon.ico");

  try {
    const appIcon = nativeImage.createFromPath(iconPath);
    if (!appIcon.isEmpty()) {
      return appIcon;
    }
  } catch (error) {
    logMessage("warn", `应用图标加载失败，使用默认图标: ${error}`);
  }

  // 如果加载失败，返回空图标
  return nativeImage.createEmpty();
}

/**
 * 获取托盘图标
 */
function getTrayIcon(): Electron.NativeImage {
  // 托盘图标和应用图标使用同一个文件
  return getAppIcon();
}

/**
 * 创建托盘菜单
 */
function createTrayMenu(): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: "显示窗口",
      click: showWindow,
    },
    {
      label: "隐藏窗口",
      click: hideWindow,
    },
    { type: "separator" },
    {
      label: "重启服务器",
      click: handleServerRestart,
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => app.quit(),
    },
  ]);
}

/**
 * 处理服务器重启
 */
async function handleServerRestart(): Promise<void> {
  try {
    logMessage("info", "用户从托盘重启服务器");
    initializeEnvironment();
    if (serverStarted) {
      await restartServer();
    }
  } catch (error) {
    logMessage("error", `重启服务器失败: ${error}`);
  }
}

// ==================== Log Management Functions ====================

/**
 * 设置日志文件写入功能
 */
function setupLogFileWriter(): void {
  // 确保日志目录存在
  const logDir = path.join(getAppPath(), "logs");
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // 监听日志事件并写入文件
  logEmitter.on("log", (logEntry) => {
    // 根据日志时间生成日期格式的文件名
    const logDate = new Date(logEntry.timestamp);
    const dateStr = logDate.toISOString().split("T")[0]; // YYYY-MM-DD 格式
    const logFilePath = path.join(logDir, `app-${dateStr}.log`);

    const timestamp = logDate.toISOString();
    const logLine = `[${timestamp}] [${logEntry.level}] ${logEntry.message}${
      logEntry.orgId ? ` (orgId: ${logEntry.orgId})` : ""
    }${logEntry.runId ? ` (runId: ${logEntry.runId})` : ""}\n`;

    // 异步写入文件，避免阻塞主线程
    fs.appendFile(logFilePath, logLine, (err) => {
      if (err) {
        console.error("Failed to write log to file:", err);
      }
    });
  });
}

// ==================== IPC Handlers ====================

/**
 * 设置IPC处理程序
 */
function setupIpcHandlers(): void {
  ipcMain.handle("show-window", showWindow);
  ipcMain.handle("hide-window", hideWindow);
  ipcMain.handle("get-window-visible", () => {
    return mainWindow ? mainWindow.isVisible() : false;
  });
  ipcMain.handle("quit-app", () => app.quit());
}

// ==================== App Event Handlers ====================

/**
 * 应用程序初始化
 */
async function initializeApp(): Promise<void> {
  // 设置日志文件写入功能
  setupLogFileWriter();

  // 初始化环境配置
  initializeEnvironment();

  // 设置IPC处理程序
  setupIpcHandlers();

  // 创建系统托盘
  createTray();

  // 创建窗口
  logMessage("info", "App ready, creating window...");
  console.log("App ready, creating window...");

  await createWindow();
  logMessage("info", "Window created successfully");

  // 启动 GraphQL 服务器
  try {
    logMessage("info", "Starting GraphQL server...");
    await startGraphQLServer();
    logMessage("info", "GraphQL server started successfully");
    logMessage("info", "Application initialized successfully");
  } catch (error) {
    logMessage("error", `Failed to start GraphQL server: ${error}`);
    logMessage(
      "info",
      "Application running in debug mode (server unavailable)"
    );
  }
}

// ==================== App Event Listeners ====================

// 检查单例锁
if (!checkSingleInstance()) {
  logMessage("info", "Application instance already running, exiting...");
  app.quit();
} else {
  // 应用就绪时初始化
  app.whenReady().then(initializeApp);
}

// 所有窗口关闭时的处理
app.on("window-all-closed", () => {
  // 保持应用运行在后台（托盘中）
  // 用户需要从托盘菜单中选择退出来关闭应用
});

// 应用即将退出时的清理
app.on("before-quit", () => {
  isQuitting = true;

  // 释放单例锁
  if (singleInstanceLock) {
    logMessage("info", "Releasing single instance lock");
  }
});

// macOS 上点击 dock 图标时重新创建窗口
app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  } else {
    showWindow();
  }
});
