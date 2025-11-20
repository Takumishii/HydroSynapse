const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow () {
  // Crea la ventana del navegador.
  const mainWindow = new BrowserWindow({
    // Remueve las dimensiones fijas
    // width: 800, 
    // height: 600,
    
    // Nueva configuración para iniciar maximizada
    show: false, // Oculta la ventana mientras se carga para evitar flashes
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Importante: Deshabilitar la integración de Node para seguridad (aunque estamos en un entorno controlado)
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 1. Maximizar la ventana inmediatamente después de crearla
  mainWindow.maximize();
  
  // 2. Mostrar la ventana solo cuando esté lista para evitar el destello
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Carga el archivo index.html de la aplicación.
  mainWindow.loadFile('index.html');

  // Abre las DevTools (útil para desarrollo).
  // mainWindow.webContents.openDevTools();
}

// Este método se llamará cuando Electron haya terminado la inicialización
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // En macOS es común recrear una ventana en la app cuando el ícono del dock
    // es clicado y no hay otras ventanas abiertas.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Salir cuando todas las ventanas estén cerradas (excepto en macOS).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});