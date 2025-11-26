export function setupResultsModule() {
    window.showResults = function(result) {
        document.getElementById("val-ec").textContent = result.ec_estimada + " mS/cm";
        document.getElementById("val-ph").textContent = result.ph_estimado;

        const body = document.getElementById("tablaDosisBody");
        body.innerHTML = "";

        result.dosis.forEach(d => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${d.nombre}</td>
                <td class="text-right">${d.dosis_gramos}</td>
            `;
            body.appendChild(tr);
        });
    };

    window.enviarAProcesador = function() {
        alert("Comando enviado (placeholder)");
    };
}
