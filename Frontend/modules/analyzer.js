let sales = [];

export function agregarSal() {
    const formula = document.getElementById("chemFormula").value;
    const ppm = parseFloat(document.getElementById("chemPpm").value);

    if (!formula || isNaN(ppm)) {
        alert("Datos inválidos");
        return;
    }

    sales.push({ formula, ppm });

    const ul = document.getElementById("listaSales");
    const li = document.createElement("li");
    li.textContent = `${formula} - ${ppm} ppm`;
    ul.appendChild(li);
}

export async function analizarAgua() {
    try {
        const res = await fetch("http://localhost:8000/api/analyze_water", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ compounds: sales })
        });

        const data = await res.json();
        console.log("Análisis químico:", data);

        alert(JSON.stringify(data.report, null, 2));
    } catch (err) {
        console.error(err);
    }
}

export function setupAnalyzer() {
    window.agregarSal = agregarSal;
    window.analizarAgua = analizarAgua;
}
