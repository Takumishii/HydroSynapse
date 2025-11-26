// --- CALCULO DE DOSIS ---
export function calcularDosis() {
    const volumen = parseFloat(document.getElementById("volumenTanque").value);
    const perfil = document.getElementById("perfilPlanta").value;

    fetch("http://localhost:8000/api/calculate_doses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            volumen_tanque: volumen,
            perfil_seleccionado: perfil
        })
    })
    .then(res => res.json())
    .then(data => {
        console.log("Resultado cálculo:", data);

        if (!data.exito) {
            alert("Error: " + data.mensaje);
            return;
        }

        window.showResults(data);
        toggleModule("module-results");
    })
    .catch(err => {
        console.error(err);
        alert("Error en conexión con backend");
    });
}


// --- ENVIAR A PROCESADOR ---
export function enviarAProcesador() {
    alert("⚠️ enviarAProcesador() aún no implementado");
    console.log("Simulación: enviando receta al procesador…");
}


// --- SETUP OPCIONAL ---
export function setupCalculatorHandlers() {
    // Aquí podrías agregar listeners si algún día los necesitas
}
