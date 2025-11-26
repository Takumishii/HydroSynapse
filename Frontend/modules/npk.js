import Chart from "../public/libs/chart.js";

let chart = null;

export function initNPKChart() {
    const ctx = document.getElementById("npkChart");

    chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["N", "P", "K"],
            datasets: [{
                label: "Balance",
                data: [0, 0, 0]
            }]
        }
    });
}
