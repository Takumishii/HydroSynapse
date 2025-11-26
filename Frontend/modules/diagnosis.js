export function setupDiagnosis() {
    // esto solo pone la función en window
    window.runDiagnosis = runDiagnosis;
}

export function runDiagnosis() {
    const s = document.getElementById("symptomSelector").value;
    const out = document.getElementById("diagnosisResult");

    const results = {
        clorosis_hojas_viejas: "Posible deficiencia de Nitrógeno",
        necrosis_bordes: "Puede indicar exceso de sales",
        hojas_curvadas: "Posible deficiencia de Calcio",
        tallos_púrpura: "Bajo Fósforo"
    };

    out.textContent = results[s] || "Sin datos";
}
