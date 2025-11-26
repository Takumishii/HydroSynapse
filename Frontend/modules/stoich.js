export async function balanceEquation() {
    const reactants = document
        .getElementById("eqReactants").value.split(",").map(s => s.trim());

    const products = document
        .getElementById("eqProducts").value.split(",").map(s => s.trim());

    const res = await fetch("http://localhost:8000/api/balance_reaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactants, products })
    });

    const data = await res.json();
    const box = document.getElementById("eqResult");

    if (!data.success) {
        box.innerText = "Error: " + data.error;
        return;
    }

    box.innerHTML = `<b>Ecuación balanceada:</b><br>${data.equation}`;
}
