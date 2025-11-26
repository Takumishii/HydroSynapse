let consoleDiv = null;

export function initConsole() {
    consoleDiv = document.getElementById("consoleLog");

    if (!consoleDiv) {
        console.warn("⚠️ consoleLog no encontrado");
        return;
    }

    // Exponer función global EXACTA como en tu renderer viejo
    window.logConsole = function (msg) {
        if (!consoleDiv) return;

        const time = new Date().toLocaleTimeString();
        const line = document.createElement("div");

        line.innerHTML = `[${time}] ${msg}`;
        line.className = "console-line";

        consoleDiv.appendChild(line);

        // auto scroll
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
    };

    // Primer log
    window.logConsole("🟢 Consola inicializada");
}
