const { contextBridge } = require("electron");

console.log("PRELOAD CARGADO ✔");

contextBridge.exposeInMainWorld("api", {
    test: () => console.log("API funcionando")
});
