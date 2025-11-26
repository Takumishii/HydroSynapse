// IMPORTAR EL DRAGGABLE 🔥
import { makeWindowDraggable } from "./draggable.js";

export function initUI() {

    // ---- TOGGLE MODULE GLOBAL ----
    window.toggleModule = function(id, hideOnly = false) {
        const el = document.getElementById(id);
        if (!el) return;

        if (hideOnly) {
            el.style.display = "none";
        } else {
            el.style.display = el.style.display === "none" ? "block" : "none";
        }
    };

    // ---- ACTIVAR DRAGGABILITY ----
    document.querySelectorAll(".module-window").forEach(win => {
        makeWindowDraggable(win);
    });

    // ---- CREAR BOTONES EN LA BARRA SUPERIOR ----
    const inspector = document.getElementById("moduleInspector");

    document.querySelectorAll(".module-window").forEach(win => {
        const id = win.id;
        const label = win.querySelector(".window-header span")?.textContent ?? id;

        const btn = document.createElement("span");
        btn.className = "px-2 cursor-pointer hover:text-neon-blue whitespace-nowrap";
        btn.textContent = label;

        btn.onclick = () => toggleModule(id);

        inspector.appendChild(btn);
    });
}

// EXPORTAR TAMBIÉN EL TOGGLE SI LO QUIERES USAR DIRECTO
export function toggleModule(id, hideOnly = false) {
    const el = document.getElementById(id);
    if (!el) return;

    if (hideOnly) {
        el.style.display = "none";
    } else {
        el.style.display = el.style.display === "none" ? "block" : "none";
    }
}
