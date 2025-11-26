export async function calcularMolar() {
    const compound = document.getElementById("molarCompound").value;
    const volume = parseFloat(document.getElementById("molarVolume").value);

    const res = await fetch("http://localhost:8000/api/molar_solution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compound, volume_L: volume })
    });

    const data = await res.json();

    if (!data.success) {
        document.getElementById("molarResult").innerText = "Error: " + data.error;
        return;
    }

    document.getElementById("molarResult").innerHTML =
        `<b>Masa necesaria:</b> ${data.grams} g<br>
         <b>Masa molar:</b> ${data.molar_mass} g/mol`;
}
