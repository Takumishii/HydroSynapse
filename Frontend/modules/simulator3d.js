import * as THREE from "../public/libs/three.js";
import { OrbitControls } from "../public/libs/OrbitControls.js";

let scene, camera, renderer, controls;
let waterLevel, flowIndicator, dosingPump;
let isPumping = false;
let flowAnimationTime = 0;

export function init3DSimulation() {
    const container = document.getElementById("simContent");

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050c18);

    const width = container.clientWidth;
    const height = container.clientHeight;

    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(4, 3, 5);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // --- Luces ---
    const ambient = new THREE.AmbientLight(0x404040, 1.5);
    scene.add(ambient);

    const neon = new THREE.DirectionalLight(0x39ff14, 2.5);
    neon.position.set(5, 5, 5);
    scene.add(neon);

    // --- Tanque ---
    const tankGeo = new THREE.CylinderGeometry(2, 2, 4, 16);
    const tankMat = new THREE.MeshPhongMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.2,
        wireframe: true
    });
    const tank = new THREE.Mesh(tankGeo, tankMat);
    scene.add(tank);

    // --- Agua ---
    const waterGeo = new THREE.PlaneGeometry(3.8, 3.8);
    const waterMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.5
    });
    waterLevel = new THREE.Mesh(waterGeo, waterMat);
    waterLevel.rotation.x = -Math.PI / 2;
    waterLevel.position.y = -1.5;
    scene.add(waterLevel);

    // --- Planta ---
    const plant = createPlant();
    scene.add(plant);

    // --- Raíces ---
    const roots = createRoots();
    scene.add(roots);

    // --- Sensores ---
    const ecSensor = createSensor("EC Sensor", 0xffa500, new THREE.Vector3(1.0, -1.5, 1.0));
    const phSensor = createSensor("PH Sensor", 0x8a2be2, new THREE.Vector3(-1.0, -1.5, 1.0));
    scene.add(ecSensor, phSensor);

    // --- Bomba ---
    dosingPump = createPump();
    scene.add(dosingPump);

    // --- Tubo de dosificación + indicador de flujo ---
    const start = new THREE.Vector3(2.5, 3, 0);
    const mid = new THREE.Vector3(2.5, 1.5, 0);
    const end = new THREE.Vector3(2.0, -1.0, 0);

    const pipe1 = createPipe(start, mid);
    const pipe2 = createPipe(mid, end);
    scene.add(pipe1, pipe2);

    flowIndicator = createFlowIndicator(start);
    scene.add(flowIndicator);

    // --- Animación principal ---
    function animate() {
        requestAnimationFrame(animate);

        controls.update();

        // Efecto de agua
        const wave = Math.sin(Date.now() * 0.005) * 0.05;
        waterLevel.position.y = -1.5 + wave;

        // Movimiento planta
        plant.rotation.y += 0.005;
        plant.rotation.z = Math.sin(Date.now() * 0.001) * 0.05;

        // Flujo
        updateFlowAnimation(start, mid, end);

        renderer.render(scene, camera);
    }

    animate();

    // Resize
    new ResizeObserver(() => resize(container)).observe(container);
}

/* --------------------- FUNCIONES AUXILIARES --------------------- */

function resize(container) {
    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function createPipe(a, b) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const length = dir.length();

    const geo = new THREE.CylinderGeometry(0.05, 0.05, length, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

    const pipe = new THREE.Mesh(geo, mat);
    pipe.position.copy(a).add(b).divideScalar(2);
    pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());

    return pipe;
}

function createFlowIndicator(start) {
    const geo = new THREE.SphereGeometry(0.1, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff00ff });

    const sphere = new THREE.Mesh(geo, mat);
    sphere.position.copy(start);
    sphere.visible = false;

    return sphere;
}

function updateFlowAnimation(start, mid, end) {
    if (!flowIndicator.visible) return;

    flowAnimationTime += 0.01;

    let p = null;

    if (flowAnimationTime < 1.0)
        p = new THREE.Vector3().lerpVectors(start, mid, flowAnimationTime);
    else if (flowAnimationTime < 2.0)
        p = new THREE.Vector3().lerpVectors(mid, end, flowAnimationTime - 1.0);
    else {
        flowIndicator.visible = false;
        flowAnimationTime = 0;
        isPumping = false;
    }

    if (p) flowIndicator.position.copy(p);
}

function createSensor(name, color, pos) {
    const g = new THREE.Group();

    const body = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const floatCube = new THREE.Mesh(body, new THREE.MeshBasicMaterial({
        color,
        wireframe: true
    }));

    const probe = new THREE.CylinderGeometry(0.05, 0.05, 2.0, 4);
    const probeMesh = new THREE.Mesh(probe, new THREE.MeshBasicMaterial({ color: 0x39ff14 }));
    probeMesh.position.y = -1.0;

    floatCube.position.y = 0.5;

    g.add(floatCube, probeMesh);
    g.position.copy(pos);

    return g;
}

function createPump() {
    const g = new THREE.Group();

    const body = new THREE.BoxGeometry(0.8, 0.6, 0.4);
    const pumpBody = new THREE.Mesh(body, new THREE.MeshBasicMaterial({ color: 0x800080 }));

    const motor = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8);
    const motorMesh = new THREE.Mesh(motor, new THREE.MeshBasicMaterial({ color: 0xff00ff }));
    motorMesh.position.set(0.4, 0.2, 0);
    motorMesh.rotation.z = Math.PI / 2;

    pumpBody.position.y += 0.3;

    g.add(pumpBody, motorMesh);
    g.position.set(3.5, 1.5, 0);

    return g;
}

function createPlant() {
    const g = new THREE.Group();

    const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 1.5, 8),
        new THREE.MeshBasicMaterial({ color: 0x39ff14 })
    );
    stem.position.y = 2.25;

    const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.8, 1.0, 6),
        new THREE.MeshBasicMaterial({ color: 0x00ffff })
    );
    leaf.position.y = 3.0;

    g.add(stem, leaf);
    return g;
}

function createRoots() {
    const rootGroup = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.6 });

    for (let i = 0; i < 6; i++) {
        const root = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.0, 0.05), mat);
        const ang = i * Math.PI / 3;

        root.position.x = Math.cos(ang) * (1.5 + Math.random() * 0.3);
        root.position.z = Math.sin(ang) * 1.5;
        root.position.y = -2.5;

        rootGroup.add(root);
    }

    rootGroup.position.y = +2.0;
    return rootGroup;
}

export function startDosingAnimation() {
    flowIndicator.visible = true;
    isPumping = true;
}
