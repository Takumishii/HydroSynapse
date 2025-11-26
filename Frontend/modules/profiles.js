export async function loadProfilesToUI() {
    try {
        const res = await fetch("http://localhost:8000/api/profiles");
        const data = await res.json();

        if (!data.success) throw new Error("Error cargando perfiles");

        const sel = document.getElementById("perfilPlanta");
        sel.innerHTML = "";

        data.profiles.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.nombre;
            opt.textContent = p.nombre;
            sel.appendChild(opt);
        });

        console.log("Perfiles cargados:", data.profiles);

    } catch (err) {
        console.error("Error cargando perfiles:", err);
    }
}



// ✅ ESTA FUNCIÓN FALTABA
export async function saveNutrientProfile() {
    const nombre = document.getElementById("profileName").value;
    const N = +document.getElementById("profileN").value;
    const P = +document.getElementById("profileP").value;
    const K = +document.getElementById("profileK").value;
    const EC = +document.getElementById("profileEC").value;
    const pH = +document.getElementById("profilepH").value;

    if (!nombre) {
        alert("El perfil necesita un nombre.");
        return;
    }

    const payload = {
        nombre,
        N, P, K,
        EC,
        pH
    };

    try {
        const res = await fetch("http://localhost:8000/api/profiles/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!data.success) {
            alert("Error guardando perfil: " + data.message);
            return;
        }

        alert("Perfil guardado correctamente.");

        // recargar lista
        loadProfilesToUI();

    } catch (err) {
        console.error("Error guardando perfil:", err);
        alert("No se pudo conectar al backend.");
    }
}
