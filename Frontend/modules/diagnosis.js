// modules/diagnosis.js

// Esta función se engancha desde renderer.js
export function setupDiagnosis() {
    // También dejamos runDiagnosis global, como antes
    window.runDiagnosis = runDiagnosis;
}

/**
 * Llama al backend (/api/deficiency/plan) y muestra:
 *  - explicación completa (description + recommendation)
 *  - nutrientes implicados (primarios / secundarios)
 *  - plan cuantitativo: gramos de sales para corregir Δppm en el volumen actual
 */
export async function runDiagnosis() {
    const symptom = document.getElementById("symptomSelector").value;
    const resultDiv = document.getElementById("diagnosisResult");

    // Usamos el mismo volumen del módulo de cálculo
    const volInput = document.getElementById("volumenTanque");
    const volume_L = parseFloat(volInput?.value || "100") || 100;

    resultDiv.innerHTML = `<span class="text-neon-blue text-xs">Analizando síntomas...</span>`;

    try {
        const res = await fetch("http://localhost:8000/api/deficiency/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                symptom_code: symptom,
                volume_L: volume_L
                // En el futuro puedes pasar current_profile o tissue_analysis aquí
            })
        });

        const data = await res.json();
        console.log("Diagnóstico recibido:", data);

        if (!data.success) {
            resultDiv.innerHTML = `
                <p class="text-neon-pink text-xs">Error en diagnóstico:</p>
                <p class="text-xs">${data.error || "No se pudo generar un diagnóstico."}</p>
            `;
            return;
        }

        // Estructura devuelta por ChemicalEngine.build_correction_plan
        const diag = data.diagnosis || {};
        const corrections = data.corrections || [];

        const primary = (diag.primary_nutrients || []).join(", ") || "—";
        const secondary = (diag.secondary_nutrients || []).join(", ") || "—";
        const description = diag.description || "Sin descripción.";
        const recommendation = diag.recommendation || "";

        let corrHtml = "";
        if (corrections.length > 0) {
            corrHtml += `
                <h4 class="mt-2 text-neon-pink text-xs">
                    PLAN DE CORRECCIÓN (Volumen: ${data.volume_L} L)
                </h4>
                <ul class="mt-1 list-disc pl-4 text-xs space-y-1">
            `;
            corrections.forEach(c => {
                const fert = c.fertilizer || "—";
                const grams = (c.grams_required != null) ? `${c.grams_required} g` : "N/D";
                const warning = c.warning ? `<span class="text-neon-pink"> (${c.warning})</span>` : "";
                corrHtml += `
                    <li>
                        Nutriente <b>${c.nutrient}</b>: objetivo +${c.delta_ppm} ppm. <br/>
                        Fertilizante recomendado: <b>${fert}</b> → <b>${grams}</b>${warning}
                    </li>
                `;
            });
            corrHtml += `</ul>`;
        } else {
            corrHtml = `<p class="mt-2 text-xs">No se generó un plan cuantitativo de corrección.</p>`;
        }

        resultDiv.innerHTML = `
            <p class="text-neon-pink text-xs">HIPÓTESIS PRINCIPAL</p>
            <p class="font-bold text-sm">Nutrientes clave: ${primary}</p>
            <p class="text-xs">Posibles secundarios: ${secondary}</p>

            <p class="mt-1 text-xs">${description}</p>

            <p class="mt-2 text-xs">
                <span class="font-bold">Recomendación general:</span> ${recommendation}
            </p>

            ${corrHtml}
        `;
    } catch (err) {
        console.error(err);
        resultDiv.innerHTML = `
            <p class="text-neon-pink text-xs">Error de conexión con el backend.</p>
        `;
    }
}
