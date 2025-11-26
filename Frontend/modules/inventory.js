export function loadInventory() {
    const inventory = [
        { name: "Nitrato de Calcio", stock: 12, cost: 1800 },
        { name: "Sulfato de Magnesio", stock: 4.5, cost: 1200 },
        { name: "Nitrato de Potasio", stock: 7, cost: 2100 }
    ];

    const body = document.getElementById("inventoryBody");

    inventory.forEach(i => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${i.name}</td>
            <td class="text-right">${i.stock}</td>
            <td class="text-right">$${i.cost}</td>
        `;
        body.appendChild(tr);
    });
}
