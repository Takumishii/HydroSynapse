import esbuild from "esbuild";

const build = async () => {
    // THREE + OrbitControls
    await esbuild.build({
        entryPoints: ["node_modules/three/build/three.module.js"],
        bundle: true,
        format: "esm",
        outfile: "public/libs/three.js",
    });

    await esbuild.build({
        entryPoints: ["node_modules/three/examples/jsm/controls/OrbitControls.js"],
        bundle: true,
        format: "esm",
        outfile: "public/libs/OrbitControls.js",
    });

    // Chart.js
    await esbuild.build({
        entryPoints: ["node_modules/chart.js/auto/auto.js"],
        bundle: true,
        format: "esm",
        outfile: "public/libs/chart.js",
    });

    console.log("📦 Librerías compiladas correctamente.");
};

build().catch(() => process.exit(1));
