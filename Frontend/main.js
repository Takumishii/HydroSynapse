import { app, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
    const win = new BrowserWindow({
        show: false,
        backgroundColor: "#000000",
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),

            // 🔥 IMPORTANTE PARA QUE FUNCIONEN LOS MÓDULOS ES6
            nodeIntegration: false,
            contextIsolation: true,

            // 🔥 NECESARIO PARA EVITAR ERRORES TONTOS EN WINDOWS
            sandbox: false
        }
    });

    console.log("MAIN.JS EJECUTADO EN:", __dirname);
    console.log("Cargando index desde:", path.join(__dirname, "index.html"));

    const indexPath = path.resolve("index.html");
    console.log("Cargando index desde:", indexPath);

    win.loadFile(indexPath);
    // temporal para debugging
    win.webContents.openDevTools({ mode: 'right' });



    win.once("ready-to-show", () => {
        win.maximize();
        win.show();
    });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
