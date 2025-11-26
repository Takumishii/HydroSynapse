console.log("🟦 INICIO DEL RENDERER");

// --- IMPORTS DE LIBRERÍAS EMPAQUETADAS ---
import * as THREE from "./public/libs/three.js";
import { OrbitControls } from "./public/libs/OrbitControls.js";
import Chart from "./public/libs/chart.js";

console.log("🟩 IMPORTS COMPLETADOS");

// --- IMPORTS DE MÓDULOS ---
import { initUI, toggleModule } from "./modules/ui.js";
import { loadProfilesToUI, saveNutrientProfile } from "./modules/profiles.js";
import { setupCalculatorHandlers, calcularDosis, enviarAProcesador } from "./modules/calculator.js";
import { setupResultsModule } from "./modules/results.js";
import { setupAnalyzer, agregarSal, analizarAgua } from "./modules/analyzer.js";
import { loadInventory } from "./modules/inventory.js";
import { initNPKChart } from "./modules/npk.js";
import { setupDiagnosis, runDiagnosis } from "./modules/diagnosis.js";
import { loadHistory } from "./modules/history.js";
import { init3DSimulation } from "./modules/simulator3d.js";

console.log("🟨 EXPONIENDO FUNCIONES GLOBALES");
window.toggleModule = toggleModule;
window.calcularDosis = calcularDosis;
window.enviarAProcesador = enviarAProcesador;
window.agregarSal = agregarSal;
window.analizarAgua = analizarAgua;
window.saveNutrientProfile = saveNutrientProfile;
window.runDiagnosis = runDiagnosis;

// --- ESTA PARTE FALTABA 🔥🔥🔥 ---
console.log("🟧 INICIALIZANDO SISTEMA...");

initUI();
loadProfilesToUI();
setupCalculatorHandlers();
setupResultsModule();
setupAnalyzer();
loadInventory();
initNPKChart();
setupDiagnosis();
loadHistory();
init3DSimulation();

console.log("🟩 SISTEMA LISTO ✔");

document.getElementById("statusText").innerText = "STATUS: Sistema Listo";
