import * as THREE from "../public/libs/three.js";
import { OrbitControls } from "../public/libs/OrbitControls.js";

export function init3DSimulation() {
    const container = document.getElementById("simContent");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });

    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x00ff99 });
    const cube = new THREE.Mesh(geo, mat);
    scene.add(cube);

    const light = new THREE.PointLight(0xffffff, 1);
    light.position.set(5, 5, 5);
    scene.add(light);

    camera.position.set(3, 3, 3);
    controls.update();

    function animate() {
        requestAnimationFrame(animate);
        cube.rotation.y += 0.01;
        renderer.render(scene, camera);
    }
    animate();
}
