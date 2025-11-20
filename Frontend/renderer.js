import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, query, getDocs, updateDoc, setDoc, deleteDoc, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- CONFIGURACIÓN DE FIREBASE (GLOBALES) ---
// Se utilizan las variables de entorno inyectadas por el Canvas
let app, db, auth;
let userId = 'loading...'; // Default hasta que se autentique
const appId = typeof __app_id !== 'undefined' ? __app_id : 'hydroponic-default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

// Umbral de stock bajo (en Kg)
const LOW_STOCK_THRESHOLD = 5.0; 

// Estado de los módulos: True = Abierto, False = Cerrado (Oculto)
const moduleState = {
    'module-calc': true, 
    'module-results': false,
    'module-analyze': false,
    'module-sim': true, 
    'module-console': true, 
    'module-npk-balance': false, 
    'module-inventory': true, 
    'module-diagnosis': true, 
    'module-history': false, // NUEVO
    'module-profiles': false, // NUEVO
};

// Definición de todos los módulos para el Inspector
const allModules = [
    { id: 'module-calc', title: 'CALCULO DE RECETA' },
    { id: 'module-results', title: 'DATOS DE DOSIFICACIÓN' },
    { id: 'module-analyze', title: 'ANALIZADOR QUÍMICO' },
    { id: 'module-npk-balance', title: 'BALANCE NPK' },
    { id: 'module-inventory', title: 'INVENTARIO DE SALES' }, 
    { id: 'module-diagnosis', title: 'DIAGNÓSTICO DEFICIENCIAS' }, 
    { id: 'module-history', title: 'HISTORIAL DOSIFICACIÓN' }, // NUEVO
    { id: 'module-profiles', title: 'PERFILES DE NUTRIENTES' }, // NUEVO
    { id: 'module-sim', title: 'VISUALIZACIÓN 3D (FIJO)' },
    { id: 'module-console', title: 'CONSOLA (Log)' },
];

let salesAgua = []; 
let npkChart; 
let profileCache = {}; // Almacena perfiles por nombre para el cálculo rápido
let scene, camera, renderer, waterLevel, controls; 
let dosingPipe, flowIndicator, plant; 
let ecSensor, phSensor, dosingPump, roots; 

// Z-index y módulos
const BASE_Z_INDEX_FLOATING = 50; 
const FOCUSED_Z_INDEX_FLOATING = 60;
const fixedModules = ['module-sim', 'module-console'];
const permanentModules = ['module-sim', 'module-console'];

let flowAnimationTime = 0; 
let isPumping = false; 

// --- INICIALIZACIÓN DE FIREBASE ---
async function initFirebase() {
    try {
        if (Object.keys(firebaseConfig).length === 0 || !firebaseConfig.apiKey) {
            logConsole("⚠️ FIREBASE: Configuración no disponible. Usando simulación local.");
            updateStatus("DB Offline. Usando modo Local.", false);
            // Carga datos locales si no hay DB
            loadProfilesLocal(); 
            return;
        }

        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        const initialToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        
        if (initialToken) {
            await signInWithCustomToken(auth, initialToken);
        } else {
            await signInAnonymously(auth);
        }

        userId = auth.currentUser?.uid || crypto.randomUUID();
        
        logConsole(`✅ FIREBASE: Conectado. UID: ${userId}`);
        updateStatus(`DB Online. User: ${userId.substring(0, 8)}...`, true);

        // Una vez autenticado, iniciar listeners de datos en tiempo real
        loadProfilesFromDB();
        loadInventory();
        loadDosingHistory(); // NUEVO: Cargar historial
        
    } catch (error) {
        logConsole(`❌ FIREBASE ERROR: Fallo en la conexión/autenticación: ${error.message}`);
        updateStatus("DB Offline. Error de conexión.", false);
        console.error("Firebase Init Error:", error);
    }
}

// --- FUNCIÓN CENTRAL: GESTIÓN DE MÓDULOS (toggleModule) ---

/**
 * Gestiona el estado y foco de una ventana.
 */
function toggleModule(moduleId, forceClose = false) {
    const moduleElement = document.getElementById(moduleId);
    const inspectorItem = document.getElementById(`item-${moduleId}`);

    if (!moduleElement || !inspectorItem) {
        logConsole(`❌ Error: Módulo o ítem ${moduleId} no encontrado.`);
        return;
    }
    
    // Módulo permanente (Sim o Console)
    if (forceClose && permanentModules.includes(moduleId)) {
         logConsole(`⚠️ Módulo ${moduleId} es un componente de sistema Fijo y no puede ser cerrado.`);
         bringToFront(moduleElement);
         return;
    }

    // Lógica para módulos flotantes (no permanentes)
    if (!permanentModules.includes(moduleId)) {
        if (forceClose && moduleState[moduleId]) {
            // CERRAR MÓDULO (Flotante)
            moduleElement.style.display = 'none';
            inspectorItem.classList.remove('active');
            moduleState[moduleId] = false;
            moduleElement.classList.remove('focused');
            moduleElement.style.zIndex = BASE_Z_INDEX_FLOATING; 
            logConsole(`Módulo ${moduleId} ha sido CERRADO.`);
            return;
        } 
        
        // ABRIR O ENFOCAR MÓDULO (Flotante)
        if (!moduleState[moduleId]) {
            moduleElement.style.display = 'block';
            inspectorItem.classList.add('active');
            moduleState[moduleId] = true;
            logConsole(`Módulo ${moduleId} ABIERTO.`);
        }
    }

    // Enfocar
    bringToFront(moduleElement);
    logConsole(`Módulo ${moduleId} ENFOCADO.`);
}


function bringToFront(elmnt) {
    // 1. Quitar foco a todos los módulos flotantes (y el 3D)
    document.querySelectorAll('.module-window, #module-sim').forEach(mod => {
        mod.classList.remove('focused');
        if (!fixedModules.includes(mod.id)) {
            mod.style.zIndex = BASE_Z_INDEX_FLOATING;
        }
    });

    // 2. Aplicar foco al elemento actual. 
    elmnt.classList.add('focused');
}


// --- FUNCIÓN CENTRAL: PANEL INSPECTOR (HORIZONTAL BAR) ---
function initInspectorPanel() {
    const inspectorPanel = document.getElementById('moduleInspector');
    
    allModules.forEach(module => {
        const item = document.createElement('div');
        item.id = `item-${module.id}`;
        item.className = `inspector-item`;
        item.innerText = module.title.replace(' (FIJO)', ''); 
        
        item.onclick = () => toggleModule(module.id, false); 
        
        inspectorPanel.appendChild(item);
        
        // Inicializar el estado visual del panel y la ventana
        const moduleElement = document.getElementById(module.id);
        if (moduleState[module.id]) {
            item.classList.add('active');
            if (moduleElement && moduleElement.classList.contains('module-window')) {
                 moduleElement.style.display = 'block';
            }
            if(moduleElement) bringToFront(moduleElement); 
        } else if (moduleElement && moduleElement.classList.contains('module-window')) {
            moduleElement.style.display = 'none';
        }

        if (moduleElement) {
            moduleElement.addEventListener('mousedown', () => bringToFront(moduleElement));
        }
    });
    logConsole("Barra de Comandos Horizontal operativa. Módulos fijos (3D, CONSOLE) iniciados.");
}


// --- LÓGICA DE UI MODULAR (ARRATRABLE DENTRO DE CONTAINER) ---
// (Función dragElement sin cambios, se mantiene la del paso anterior)
function dragElement(elmnt) {
    if (fixedModules.includes(elmnt.id)) return; 
    
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = elmnt.querySelector('.window-header'); 
    const container = document.getElementById('desktopContainer');
    
    if (!header) return; 

    header.onmousedown = (e) => {
        e.preventDefault();
        bringToFront(elmnt);
        dragMouseDown(e);
    };

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        
        const desktopRect = container.getBoundingClientRect();
        const dx = e.clientX - pos3;
        const dy = e.clientY - pos4;
        
        pos3 = e.clientX;
        pos4 = e.clientY;

        let newTop = (elmnt.offsetTop + dy);
        let newLeft = (elmnt.offsetLeft + dx);
        
        const maxTop = container.clientHeight - elmnt.clientHeight;
        const maxLeft = container.clientWidth - elmnt.clientWidth;
        
        elmnt.style.top = Math.max(0, Math.min(maxTop, newTop)) + "px";
        elmnt.style.left = Math.max(0, Math.min(maxLeft, newLeft)) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}


// --- FUNCIÓN DE UTILIDAD: CONSOLA Y ESTADO ---
function logConsole(message) {
    const log = document.getElementById('consoleLog');
    const timestamp = new Date().toLocaleTimeString();
    log.innerHTML += `<div>[${timestamp}] ${message}</div>`;
    log.scrollTop = log.scrollHeight;
}

function updateStatus(text, isOnline = true) {
    const statusText = document.getElementById('statusText');
    statusText.innerText = `STATUS: ${text}`;
    statusText.style.color = isOnline ? '#39ff14' : '#ff00ff';
}

// --- LÓGICA DE DATOS: Perfiles ---

function loadProfilesLocal() {
    // Datos de ejemplo para el modo sin DB
    const data = [
         { id: 'sim-veg', nombre: "Vegetativo Standard", N: 150, P: 50, K: 200, EC: 1.8, pH: 5.8 },
         { id: 'sim-flow', nombre: "Floración Alta", N: 100, P: 80, K: 250, EC: 2.2, pH: 6.2 },
    ];
    data.forEach(profile => profileCache[profile.nombre] = profile);
    
    const selectElement = document.getElementById('perfilPlanta');
    selectElement.innerHTML = data.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');
    
    logConsole(`✅ ${data.length} perfiles cargados (Simulación/Local).`);
}

// NUEVO: Carga perfiles de nutrientes y mantiene sincronizado el selector de cálculo
async function loadProfilesFromDB() {
    if (!db) return loadProfilesLocal();
    
    updateStatus("Cargando perfiles (DB)...", true);
    const profilesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/nutrient_profiles`);
    const selectElement = document.getElementById('perfilPlanta');
    const listElement = document.getElementById('profilesList');

    onSnapshot(profilesCollectionRef, (snapshot) => {
        selectElement.innerHTML = ''; // Limpiar el selector
        listElement.innerHTML = ''; // Limpiar la lista del módulo de edición
        profileCache = {}; // Reiniciar caché

        if (snapshot.empty) {
            logConsole("Perfiles: Colección vacía. Inicializando perfiles de ejemplo.");
            setInitialProfilesData(profilesCollectionRef);
            return;
        }

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const id = doc.id;
            profileCache[data.nombre] = {...data, id};
            
            // 1. Llenar el <select> en el módulo de cálculo
            selectElement.innerHTML += `<option value="${data.nombre}">${data.nombre}</option>`;
            
            // 2. Llenar la lista en el módulo de edición
            listElement.innerHTML += `
                <li class="p-1 border-b border-neon-green/30 flex justify-between items-center text-xs">
                    <span>${data.nombre} (N:${data.N}, P:${data.P}, K:${data.K})</span>
                    <button class="text-neon-pink ml-2 px-1 hover:bg-neon-pink hover:text-black" onclick="deleteNutrientProfile('${id}', event)">[ ELIMINAR ]</button>
                </li>
            `;
        });
        
        logConsole(`✅ ${snapshot.size} perfiles cargados y sincronizados.`);
    }, (error) => {
        logConsole(`❌ ERROR en onSnapshot de Perfiles: ${error.message}`);
    });
}

// Función para inicializar datos de perfiles si está vacío
async function setInitialProfilesData(profilesCollectionRef) {
    try {
        await setDoc(doc(profilesCollectionRef, "vegetativo"), { 
            nombre: "Vegetativo Standard", N: 150, P: 50, K: 200, EC: 1.8, pH: 5.8 
        });
        await setDoc(doc(profilesCollectionRef, "floracion"), { 
            nombre: "Floración Alta", N: 100, P: 80, K: 250, EC: 2.2, pH: 6.2 
        });
        logConsole("Perfiles inicializados con datos de ejemplo en DB.");
    } catch (e) {
        logConsole(`❌ Falló la inicialización de perfiles: ${e.message}`);
    }
}

// NUEVO: Guarda o actualiza un perfil de nutrientes
async function saveNutrientProfile() {
    const nombre = document.getElementById('profileName').value.trim();
    const N = parseFloat(document.getElementById('profileN').value);
    const P = parseFloat(document.getElementById('profileP').value);
    const K = parseFloat(document.getElementById('profileK').value);
    const EC = parseFloat(document.getElementById('profileEC').value);
    const pH = parseFloat(document.getElementById('profilepH').value);

    if (!nombre || isNaN(N) || isNaN(P) || isNaN(K) || isNaN(EC) || isNaN(pH)) {
        logConsole("⚠️ Todos los campos de perfil deben ser válidos.");
        return;
    }

    const profileData = { nombre, N, P, K, EC, pH };
    const profilesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/nutrient_profiles`);
    
    // Generar un ID basado en el nombre para simplificar la identificación única
    const docId = nombre.toLowerCase().replace(/\s+/g, '_');

    try {
        await setDoc(doc(profilesCollectionRef, docId), profileData, { merge: true });
        logConsole(`✅ Perfil "${nombre}" guardado/actualizado.`);
        document.getElementById('profileName').value = ''; // Limpiar campo
    } catch (e) {
        logConsole(`❌ ERROR al guardar perfil: ${e.message}`);
        console.error("Save Profile Error:", e);
    }
}

// NUEVO: Elimina un perfil de nutrientes
async function deleteNutrientProfile(docId, event) {
    event.stopPropagation(); // Evita que se propague el evento si el botón está dentro de otro elemento
    if (!db) {
        logConsole("DB no conectada. La eliminación no es posible en modo local.");
        return;
    }
    
    const profilesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/nutrient_profiles`);

    try {
        await deleteDoc(doc(profilesCollectionRef, docId));
        logConsole(`🗑️ Perfil ID:${docId} eliminado correctamente.`);
    } catch (e) {
        logConsole(`❌ ERROR al eliminar perfil: ${e.message}`);
        console.error("Delete Profile Error:", e);
    }
}


// --- LÓGICA DE DATOS: Inventario (Con Alerta Visual) ---

// Modificada: Ahora usa onSnapshot y aplica estilos de alerta al inspector
async function loadInventory() {
    const inventoryBody = document.getElementById('inventoryBody');
    const inventoryItem = document.getElementById('item-module-inventory');
    
    if (!db) {
        logConsole("⚠️ Inventario: Usando datos estáticos (DB no conectada).");
        return;
    }

    const inventoryCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/inventory`);
    
    onSnapshot(inventoryCollectionRef, (snapshot) => {
        inventoryBody.innerHTML = '';
        let lowStockCount = 0;
        
        if (snapshot.empty) {
            // Inicializar si está vacío
            setInitialInventoryData(inventoryCollectionRef);
            return;
        }

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const stock = parseFloat(data.stock_kg || 0);
            const isLow = stock < LOW_STOCK_THRESHOLD; 
            
            if (isLow) lowStockCount++;

            const stockText = stock.toFixed(1);
            const lowTag = isLow ? `<span class="text-xs text-neon-pink">(LOW!)</span>` : '';

            const row = `
                <tr class="border-b border-neon-green/50 hover:bg-neon-blue/10">
                    <td class="p-1 text-left">${data.name}</td>
                    <td class="p-1 text-right ${isLow ? 'text-neon-pink font-bold' : 'text-neon-green'}">${stockText} ${lowTag}</td>
                    <td class="p-1 text-right">$${parseFloat(data.cost_per_kg || 0).toFixed(2)}</td>
                </tr>`;
            inventoryBody.innerHTML += row;
        });

        // --- LÓGICA DE ALERTA VISUAL ---
        if (lowStockCount > 0) {
            inventoryItem.classList.add('alert-low-stock');
            inventoryItem.innerText = `INVENTARIO DE SALES (${lowStockCount} LOW)`;
            logConsole(`🚨 ALERTA CRÍTICA: ${lowStockCount} sales por debajo del umbral de ${LOW_STOCK_THRESHOLD} Kg.`);
        } else {
            inventoryItem.classList.remove('alert-low-stock');
            inventoryItem.innerText = 'INVENTARIO DE SALES';
        }
        
        logConsole(`Inventario actualizado: ${snapshot.size} sales. ${lowStockCount} en alerta.`);
    }, (error) => {
        logConsole(`❌ ERROR en onSnapshot de Inventario: ${error.message}`);
    });
}

// Función para inicializar datos de inventario si está vacío
async function setInitialInventoryData(inventoryCollectionRef) {
    try {
        await setDoc(doc(inventoryCollectionRef, "calcium_nitrate"), { 
            name: "Nitrato de Calcio", 
            stock_kg: 15.0, 
            cost_per_kg: 3.50 
        });
        await setDoc(doc(inventoryCollectionRef, "monopotassium_phosphate"), { 
            name: "Fosfato Monopotásico", 
            stock_kg: 2.5, // Bajo stock inicial para probar alerta
            cost_per_kg: 6.10 
        });
        await setDoc(doc(inventoryCollectionRef, "magnesium_sulfate"), { 
            name: "Sulfato de Magnesio", 
            stock_kg: 22.8, 
            cost_per_kg: 1.90 
        });
        logConsole("Inventario inicializado con datos de ejemplo en DB.");
    } catch (e) {
        logConsole(`❌ Falló la inicialización del inventario: ${e.message}`);
    }
}

// --- LÓGICA DE DATOS: Historial (Nuevo) ---

async function loadDosingHistory() {
    const historyBody = document.getElementById('historyBody');
    if (!db) {
        historyBody.innerHTML = '<tr><td colspan="4" class="text-center text-neon-pink">DB Offline. Historial no disponible.</td></tr>';
        return;
    }
    
    // Colección de historial de dosificación. Usamos orderBy para que el más reciente esté arriba
    // NOTA: Firestore no permite orderBy sin índices, lo ordenaremos localmente
    const historyCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/dosing_history`);

    onSnapshot(historyCollectionRef, (snapshot) => {
        historyBody.innerHTML = ''; 
        let historyData = [];

        snapshot.docs.forEach(doc => {
            historyData.push(doc.data());
        });
        
        // Ordenar por timestamp (más reciente primero)
        historyData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (historyData.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="4" class="text-center text-neon-blue">No hay registros en el historial.</td></tr>';
            return;
        }

        historyData.forEach(entry => {
            const date = new Date(entry.timestamp);
            const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            const row = `
                <tr class="hover:bg-neon-green/10">
                    <td class="p-1">${dateStr}</td>
                    <td class="p-1 text-neon-pink">${entry.profile}</td>
                    <td class="p-1">${entry.volumen.toFixed(0)} L</td>
                    <td class="p-1 font-bold text-neon-blue">${entry.ec_final.split(' ')[0]}</td>
                </tr>
            `;
            historyBody.innerHTML += row;
        });
        
        logConsole(`Historial de dosificación sincronizado: ${historyData.length} registros.`);
    }, (error) => {
        logConsole(`❌ ERROR en onSnapshot de Historial: ${error.message}`);
    });
}


// --- Lógica de Módulos Operacionales ---

async function calcularDosis() {
    const volumen = parseFloat(document.getElementById('volumenTanque').value);
    const perfilSeleccionado = document.getElementById('perfilPlanta').value;
    const currentProfile = profileCache[perfilSeleccionado];
    
    if (!volumen || !currentProfile) {
        logConsole("⚠️ Selecciona un perfil y volumen válidos.");
        return;
    }
    
    updateStatus("Calculando...", true);
    logConsole(`🧪 Calculando dosis para "${perfilSeleccionado}" en ${volumen}L...`);

    // --- Simulación de Cálculo de Dosis ---
    // Usar los valores del perfil para calcular las dosis (simuladamente)
    const dosisSimulada = [
        { name: "Nitrato de Calcio", formula: "Ca(NO3)2", dosis_gramos: currentProfile.N * 0.5 * (volumen/100) / 1.5 },
        { name: "Fosfato Monopotásico", formula: "KH2PO4", dosis_gramos: currentProfile.P * 0.3 * (volumen/100) / 1.2 },
        { name: "Sulfato de Magnesio", formula: "MgSO4", dosis_gramos: currentProfile.K * 0.4 * (volumen/100) / 1.8 }, 
    ].map(d => ({...d, dosis_gramos: Math.max(0.1, d.dosis_gramos)})); // Asegurar dosis > 0.1g
    
    const ecEst = currentProfile.EC + (Math.random() * 0.2 - 0.1); // Pequeña variación
    const phEst = currentProfile.pH + (Math.random() * 0.2 - 0.1); 
    
    // Valores NPK para el gráfico
    const vals = {
        N: currentProfile.N,
        P: currentProfile.P,
        K: currentProfile.K
    };
    // --- Fin Simulación ---

    try {
        if (!moduleState['module-results']) {
            toggleModule('module-results', false);
        }

        document.getElementById('val-ec').innerText = ecEst.toFixed(2) + " mS/cm";
        document.getElementById('val-ph').innerText = phEst.toFixed(2);

        const tbody = document.getElementById('tablaDosisBody');
        tbody.innerHTML = '';
        
        dosisSimulada.forEach(item => {
            const row = `<tr class="border-b border-neon-green/50">
                <td class="p-1">${item.name} <span class="text-neon-pink text-xs">(${item.formula})</span></td>
                <td class="p-1 font-bold text-right">${item.dosis_gramos.toFixed(2)}</td>
            </tr>`;
            tbody.innerHTML += row;
        });
        
        if (!moduleState['module-npk-balance']) {
            toggleModule('module-npk-balance', false);
        }
        if(npkChart) {
            npkChart.data.datasets[0].data = [vals.N, vals.P, vals.K];
            npkChart.update();
        }
        
        startDosingAnimation();

        logConsole(`✅ Cálculo completado. EC Estimada: ${ecEst.toFixed(2)}, pH Estimado: ${phEst.toFixed(2)}.`);
        updateStatus("Cálculo completo. Listo para dosificar.", true);

    } catch (error) {
        logConsole("❌ Error interno en la simulación de cálculo.");
        console.error(error);
    } 
}

// Modificada: Ahora garantiza la actualización de Inventario y el log en Historial
async function enviarAProcesador() {
    logConsole("⏳ Comando [DOSIFICAR] enviado a Procesador Remoto (Simulación)...");
    updateStatus("Comando Dosificación en curso...", true);
    
    const dosisTable = document.getElementById('tablaDosisBody');
    const rows = dosisTable.querySelectorAll('tr');
    
    if (rows.length === 0) {
        logConsole("⚠️ No hay dosis calculada para enviar.");
        return;
    }

    const dosingLog = {
        timestamp: new Date().toISOString(),
        volumen: parseFloat(document.getElementById('volumenTanque').value || 0),
        profile: document.getElementById('perfilPlanta').value || 'Desconocido',
        dosis_aplicada: [],
        ec_final: document.getElementById('val-ec').innerText || 'N/A',
        ph_final: document.getElementById('val-ph').innerText || 'N/A',
    };
    
    const inventoryCollectionRef = db ? collection(db, `artifacts/${appId}/users/${userId}/inventory`) : null;
    const historyCollectionRef = db ? collection(db, `artifacts/${appId}/users/${userId}/dosing_history`) : null;

    // 1. Recorrer las dosis y simular la actualización de inventario
    const inventoryUpdatePromises = [];
    rows.forEach(row => {
        const name = row.cells[0].innerText.split('(')[0].trim();
        const dosisGrams = parseFloat(row.cells[1].innerText);
        const dosisKg = dosisGrams / 1000;
        
        dosingLog.dosis_aplicada.push({ name: name, grams: dosisGrams });
        
        if (inventoryCollectionRef) {
            // Se usa getDocs y updateDoc para encontrar la sal por nombre y actualizar su stock
            inventoryUpdatePromises.push(
                getDocs(query(inventoryCollectionRef)).then(snapshot => {
                    const docToUpdate = snapshot.docs.find(d => d.data().name === name);
                    if (docToUpdate) {
                        const currentStock = docToUpdate.data().stock_kg;
                        const newStock = Math.max(0, currentStock - dosisKg); 
                        
                        // Actualizar el documento por su ID (docToUpdate.id)
                        return updateDoc(doc(inventoryCollectionRef, docToUpdate.id), {
                            stock_kg: newStock
                        }).then(() => {
                            logConsole(`Inventario: ${name} reducido en ${dosisKg.toFixed(3)}kg.`);
                        });
                    }
                })
            );
        }
    });
    
    // 2. Ejecutar todas las actualizaciones de inventario y loguear el historial
    try {
        await Promise.all(inventoryUpdatePromises);
        
        if (historyCollectionRef) {
             // El ID es generado automáticamente por setDoc sin especificar doc()
             await setDoc(doc(historyCollectionRef), dosingLog);
             logConsole("💾 Historial de dosificación y stock ACTUALIZADOS en Firestore.");
        }
        
        setTimeout(() => {
            logConsole(`📡 Respuesta PI: Dosificación completada. Sistema en espera.`);
            updateStatus("Dosificación completada.", true);
        }, 1500);
        
    } catch (error) {
        logConsole(`❌ ERROR al loguear/actualizar inventario: ${error.message}`);
        updateStatus("Dosificación completada con ERROR de DB.", false);
        console.error("Dosing/Inventory Error:", error);
    }
}

// --- Otras funciones (sin cambios mayores) ---

function agregarSal() {
    const formula = document.getElementById('chemFormula').value;
    const ppm = parseFloat(document.getElementById('chemPpm').value);

    if (formula && ppm > 0) {
        salesAgua.push({ formula: formula, ppm: ppm });
        
        const lista = document.getElementById('listaSales');
        const li = document.createElement('li');
        li.innerText = `🔹 ${formula}: ${ppm.toFixed(1)} ppm`;
        lista.appendChild(li);
        
        document.getElementById('chemFormula').value = '';
        document.getElementById('chemPpm').value = '';
        logConsole(`Sal agregada: ${formula} a ${ppm} ppm.`);
    } else {
        logConsole("⚠️ Ingresa fórmula y concentración válidas para agregar sal.");
    }
}

async function analizarAgua() {
    if (salesAgua.length === 0) {
        logConsole("⚠️ Agrega al menos una sal para analizar.");
        return;
    }

    logConsole("🔬 Analizando muestra de agua (Simulación)...");
    updateStatus("Analizando composición...", true);

    setTimeout(() => {
        logConsole("--- REPORTE QUÍMICO SIMULADO ---");
        salesAgua.forEach(salt => {
             logConsole(`[ION] ${salt.formula} contribuye ${salt.ppm * 0.8} ppm de iones. EC base incrementada.`);
        });
        
        salesAgua = []; 
        document.getElementById('listaSales').innerHTML = '';
        updateStatus("Análisis de agua completado.", true);
    }, 1500);
}

function runDiagnosis() {
    const symptom = document.getElementById('symptomSelector').value;
    const resultDiv = document.getElementById('diagnosisResult');
    logConsole(`🔎 Iniciando diagnóstico para síntoma: ${symptom}...`);
    
    let diagnosis = {
        clorosis_hojas_viejas: {
            nutriente: "Nitrógeno (N)",
            recomendacion: "Aumentar la fuente de Nitrato o Amonio en la próxima dosificación. Verifica el pH, un pH alto (arriba de 6.5) puede bloquear la absorción de N."
        },
        necrosis_bordes: {
            nutriente: "Potasio (K) o Calcio (Ca)",
            recomendacion: "Si es en hojas nuevas: Es posible deficiencia de Calcio. Si es en hojas viejas: Podría ser Potasio. Revisa la EC, si está muy alta puede ser toxicidad de sales."
        },
        hojas_curvadas: {
            nutriente: "Calcio (Ca) o Boro (B)",
            recomendacion: "Es un problema de movilidad. Asegúrate de que tu fuente de Calcio esté balanceada y que el pH esté en el rango 5.5-6.0 para facilitar su absorción."
        },
        tallos_púrpura: {
            nutriente: "Fósforo (P)",
            recomendacion: "Deficiencia severa de Fósforo, especialmente común con temperaturas bajas. Asegúrate de usar una fuente rica en Fosfato Monopotásico."
        }
    };

    const currentDiagnosis = diagnosis[symptom];
    resultDiv.innerHTML = `
        <p class="text-neon-pink">HIPÓTESIS PRINCIPAL:</p>
        <p class="font-bold">${currentDiagnosis.nutriente}</p>
        <p class="mt-1">${currentDiagnosis.recomendacion}</p>
    `;
    logConsole(`✅ Diagnóstico completado. Posible deficiencia de ${currentDiagnosis.nutriente}.`);
}

// --- SIMULACIÓN 3D (Three.js + OrbitControls) ---
// (Funciones de simulación 3D sin cambios, se mantienen las del paso anterior)

function handleResize() {
    const simModule = document.getElementById('module-sim');
    if (!renderer) return; 

    const width = simModule.clientWidth; 
    const height = simModule.clientHeight; 

    if (camera && renderer) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }
}

function createPipe(start, end, radius, color) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const pipeGeometry = new THREE.CylinderGeometry(radius, radius, length, 32);
    const pipeMaterial = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.5 });
    const pipe = new THREE.Mesh(pipeGeometry, pipeMaterial);
    pipe.position.addVectors(start, end).divideScalar(2);
    pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return pipe;
}

function createDosingPump() {
    const pumpGroup = new THREE.Group();
    const bodyGeometry = new THREE.BoxGeometry(0.8, 0.6, 0.4);
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x800080 }); 
    const pumpBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
    const motorGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8);
    const motorMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff }); 
    const motor = new THREE.Mesh(motorGeometry, motorMaterial);
    motor.position.set(0.4, 0.2, 0);
    motor.rotation.z = Math.PI / 2;
    pumpBody.position.y += 0.3; 
    pumpGroup.add(pumpBody);
    pumpGroup.add(motor);
    pumpGroup.position.set(3.5, 1.5, 0); 
    return pumpGroup;
}

function createSensor(name, color, position) {
    const sensorGroup = new THREE.Group();
    const floatGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const floatMaterial = new THREE.MeshBasicMaterial({ color: color, wireframe: true });
    const floatCube = new THREE.Mesh(floatGeometry, floatMaterial);
    const probeGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2.0, 4); 
    const probeMaterial = new THREE.MeshBasicMaterial({ color: 0x39ff14 }); 
    const probe = new THREE.Mesh(probeGeometry, probeMaterial);
    probe.position.y = -1.0; 
    floatCube.position.y = 0.5; 
    sensorGroup.add(floatCube);
    sensorGroup.add(probe);
    sensorGroup.name = name;
    sensorGroup.position.copy(position);
    return sensorGroup;
}

function createPlant() {
    const group = new THREE.Group();
    const stemGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1.5, 8); 
    const stemMaterial = new THREE.MeshBasicMaterial({ color: 0x39ff14 }); 
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.y = 1.5 + 0.75; 
    group.add(stem);
    const leafGeometry = new THREE.ConeGeometry(0.8, 1.0, 6); 
    const leafMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff }); 
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.position.y = 3.0; 
    group.add(leaf);
    return group;
}

function createRoots() {
    const rootGroup = new THREE.Group();
    const rootMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.6 });
    for (let i = 0; i < 6; i++) {
        const rootGeometry = new THREE.BoxGeometry(0.05, 2.0, 0.05);
        const root = new THREE.Mesh(rootGeometry, rootMaterial);
        const angle = i * Math.PI / 3;
        const radius = 1.5 + Math.random() * 0.3;
        root.position.x = Math.cos(angle) * radius;
        root.position.z = Math.sin(angle) * radius;
        root.position.y = -2.5; 
        rootGroup.add(root);
    }
    rootGroup.position.y = 2.0; 
    return rootGroup;
}

function initSimulation() {
    const simContent = document.getElementById('simContent');
    let canvas = document.getElementById('simulationCanvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'simulationCanvas';
        canvas.className = 'w-full h-full block'; 
        simContent.appendChild(canvas);
    }
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050c18); 

    const initialWidth = simContent.clientWidth || 600;
    const initialHeight = simContent.clientHeight || 450;
    camera = new THREE.PerspectiveCamera(75, initialWidth / initialHeight, 0.1, 1000);
    camera.position.set(4, 3, 5); 
    
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    handleResize(); 
    renderer.setPixelRatio(window.devicePixelRatio); 

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; 
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 2;
    controls.maxDistance = 15;
    controls.target.set(0, 0, 0); 

    const ambientLight = new THREE.AmbientLight(0x404040, 1.5); 
    scene.add(ambientLight);
    const neonLight = new THREE.DirectionalLight(0x39ff14, 2.5);
    neonLight.position.set(5, 5, 5);
    scene.add(neonLight);

    const geometryTank = new THREE.CylinderGeometry(2, 2, 4, 16); 
    const materialTank = new THREE.MeshPhongMaterial({ 
        color: 0x00ffff, 
        specular: 0x00ffff, 
        shininess: 80, 
        transparent: true, 
        opacity: 0.2,
        wireframe: true 
    });
    const tank = new THREE.Mesh(geometryTank, materialTank);
    tank.position.y = 0;
    scene.add(tank);

    const geometryWater = new THREE.PlaneGeometry(3.8, 3.8);
    const materialWater = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff, 
        transparent: true, 
        opacity: 0.5 
    });
    waterLevel = new THREE.Mesh(geometryWater, materialWater);
    waterLevel.rotation.x = -Math.PI / 2;
    waterLevel.position.y = -1.5; 
    scene.add(waterLevel);
    
    const startPoint = new THREE.Vector3(2.5, 3, 0);
    const midPoint = new THREE.Vector3(2.5, 1.5, 0);
    const endPoint = new THREE.Vector3(2.0, -1.0, 0); 
    
    const pipe1 = createPipe(startPoint, midPoint, 0.05, 0x00ffff);
    const pipe2 = createPipe(midPoint, endPoint, 0.05, 0x00ffff);
    dosingPipe = new THREE.Group();
    dosingPipe.add(pipe1);
    dosingPipe.add(pipe2);
    scene.add(dosingPipe);

    const flowGeometry = new THREE.SphereGeometry(0.1, 8, 8); 
    const flowMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff }); 
    flowIndicator = new THREE.Mesh(flowGeometry, flowMaterial);
    flowIndicator.position.copy(startPoint);
    flowIndicator.visible = false;
    scene.add(flowIndicator);
    
    plant = createPlant();
    scene.add(plant);
    
    roots = createRoots();
    scene.add(roots);
    
    ecSensor = createSensor("EC Sensor", 0xffa500, new THREE.Vector3(1.0, -1.5, 1.0)); 
    phSensor = createSensor("PH Sensor", 0x8a2be2, new THREE.Vector3(-1.0, -1.5, 1.0)); 
    scene.add(ecSensor);
    scene.add(phSensor);
    
    dosingPump = createDosingPump();
    scene.add(dosingPump);


    const animate = function () {
        requestAnimationFrame(animate);

        controls.update(); 
        
        const wave = Math.sin(Date.now() * 0.005) * 0.05;
        waterLevel.position.y = -1.5 + wave; 
        ecSensor.position.y = -1.5 + wave + 0.5; 
        phSensor.position.y = -1.5 + wave + 0.5;

        plant.rotation.y += 0.005;
        plant.rotation.z = Math.sin(Date.now() * 0.001) * 0.05;
        
        if (isPumping) {
            const motor = dosingPump.children.find(c => c.geometry.type === 'CylinderGeometry');
            if(motor) {
                motor.rotation.x += 0.5; 
            }
        }

        if (flowIndicator.visible) {
            flowAnimationTime += 0.01; 
            let currentPoint;
            
            if (flowAnimationTime < 1.0) {
                currentPoint = new THREE.Vector3().lerpVectors(startPoint, midPoint, flowAnimationTime);
            } else if (flowAnimationTime < 2.0) {
                currentPoint = new THREE.Vector3().lerpVectors(midPoint, endPoint, flowAnimationTime - 1.0);
            } else {
                flowIndicator.visible = false;
                flowAnimationTime = 0;
                isPumping = false; 
                logConsole("Flujo de nutrientes finalizado en la simulación 3D.");
            }
            
            if (currentPoint) {
                flowIndicator.position.copy(currentPoint);
            }
        }

        renderer.render(scene, camera);
    };

    animate();
    logConsole("🎬 Visor 3D avanzado (Low-Poly) iniciado. Sensores, raíces y bomba añadidos.");
    
    window.addEventListener('resize', handleResize);
    const simModule = document.getElementById('module-sim');
    new ResizeObserver(handleResize).observe(simModule);
}

function startDosingAnimation() {
    logConsole("💦 SIMULACIÓN: Nutrientes inyectados. Nivel de turbidez temporal...");
    const originalColor = new THREE.Color(0x00ffff); 
    
    flowIndicator.visible = true;
    flowAnimationTime = 0;
    isPumping = true; 
    
    waterLevel.material.color.set(0xff00ff);
    waterLevel.material.opacity = 0.8;
    
    setTimeout(() => {
        waterLevel.material.color.set(originalColor);
        waterLevel.material.opacity = 0.5;
        logConsole("💦 SIMULACIÓN: Mezcla homogénea alcanzada.");
    }, 3000); 
}


// --- GRÁFICO NPK (Chart.js) ---
function initChart() {
    const chartCanvas = document.getElementById('npkChart');
    if (!chartCanvas) {
        logConsole("❌ Error: Canvas NPK no encontrado. Asegúrate de que el módulo esté cargado.");
        return;
    }
    
    const ctx = chartCanvas.getContext('2d');
    npkChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['N', 'P', 'K'],
            datasets: [{
                label: 'PPM Final',
                data: [0, 0, 0],
                backgroundColor: ['#3498db', '#2ecc71', '#e74c3c'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#39ff14' },
                    grid: { color: 'rgba(57, 255, 20, 0.2)' }
                },
                x: {
                    ticks: { color: '#39ff14' },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Balance NPK', color: '#00ffff', font: { size: 10 } }
            }
        }
    });
    logConsole("📊 Gráfico de Balance NPK inicializado en su propio módulo.");
}


// --- EVENTOS PRINCIPALES ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar el Panel Inspector y el estado de los módulos
    initInspectorPanel();

    // 2. Inicializar la Simulación 3D (Visor grande)
    initSimulation();
    
    // 3. Inicializar el Gráfico NPK (Módulo flotante)
    initChart();
    
    // 4. Inicializar Firebase (Llama a todos los listeners de datos)
    initFirebase();
    
    // 5. Inicializar el arrastre de módulos
    ['module-calc', 'module-results', 'module-analyze', 'module-npk-balance', 'module-inventory', 'module-diagnosis', 'module-history', 'module-profiles'].forEach(id => {
        const moduleElement = document.getElementById(id);
        if(moduleElement) {
            dragElement(moduleElement);
        }
    });

    updateStatus("Sistema en línea. Esperando comandos.", true);
});

// Exportaciones para el HTML
window.toggleModule = toggleModule; 
window.dragElement = dragElement;
window.calcularDosis = calcularDosis;
window.enviarAProcesador = enviarAProcesador;
window.agregarSal = agregarSal;
window.analizarAgua = analizarAgua;
window.runDiagnosis = runDiagnosis; 
// NUEVAS EXPORTACIONES
window.saveNutrientProfile = saveNutrientProfile;
window.deleteNutrientProfile = deleteNutrientProfile;