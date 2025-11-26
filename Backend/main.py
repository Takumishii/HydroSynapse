# main.py
from flask import Flask, jsonify, request
from database import SQLiteDatabase
from calculator import NutrientCalculatorService
from models import DoseResult, FertilizerDose
import json
from datetime import datetime
import os

# ------------------ MOTOR QUÍMICO AVANZADO ------------------
try:
    # Usa el __init__.py de chemistry_engine que ya exporta ChemicalEngine
    from chemistry_engine import ChemicalEngine
    MOTOR_QUIMICO = True
except Exception as e:
    print("⚠️ Motor químico avanzado NO detectado. Razón:", e)
    ChemicalEngine = None
    MOTOR_QUIMICO = False

app = Flask(__name__)

# ---------------------------------------------------------------------------------------
# 🧱 INICIALIZACIÓN DE SERVICIOS
# ---------------------------------------------------------------------------------------
db_manager = SQLiteDatabase()

try:
    available_profiles = db_manager.get_all_profiles()
except Exception as e:
    print(f"Error cargando perfiles iniciales: {e}")
    available_profiles = []

# Tu calculadora estequiométrica de nutrientes (Ax = b)
calc_service = NutrientCalculatorService(external_profiles=available_profiles)

# Instancia del motor químico de alto nivel
chem_engine = ChemicalEngine() if MOTOR_QUIMICO and ChemicalEngine is not None else None


# ---------------------------------------------------------------------------------------
# 🔥 ENDPOINT PRINCIPAL: CÁLCULO DE NUTRIENTES (YA EXISTENTE)
# ---------------------------------------------------------------------------------------
@app.route("/api/calculate_doses", methods=["POST"])
def calculate_doses_endpoint():
    data = request.json or {}
    volumen = data.get("volumen_tanque")
    perfil = data.get("perfil_seleccionado")

    try:
        resultado = calc_service.calculate(volumen, perfil)

        if not resultado.exito:
            return jsonify(resultado.dict()), 500

        # Guardar en historial
        dosis_json = json.dumps([d.dict() for d in resultado.dosis])
        db_manager.save_new_recipe_history(
            volumen_L=volumen,
            perfil_usado=perfil,
            ec_final=resultado.ec_estimada,
            dosis_json=dosis_json
        )

        return jsonify(resultado.dict())

    except Exception as e:
        error = DoseResult(
            exito=False,
            mensaje=f"Error interno: {str(e)}",
            dosis=[],
            ec_estimada=0.0,
            ph_estimado=0.0,
            analisis_final={}
        )
        return jsonify(error.dict()), 500


# ---------------------------------------------------------------------------------------
# 📌 PERFILES
# ---------------------------------------------------------------------------------------
@app.route("/api/profiles", methods=["GET"])
def get_profiles_endpoint():
    try:
        profiles = db_manager.get_all_profiles()
        return jsonify({"success": True, "profiles": profiles})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/profiles/save", methods=["POST"])
def save_profile_endpoint():
    data = request.json or {}

    required = ["nombre", "N", "P", "K", "Ca", "Mg"]
    for r in required:
        if r not in data:
            return jsonify({"success": False, "message": f"Falta campo: {r}"}), 400

    try:
        conn = db_manager._get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO profiles (nombre, N, P, K, Ca, Mg)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(nombre) DO UPDATE SET
                N = excluded.N,
                P = excluded.P,
                K = excluded.K,
                Ca = excluded.Ca,
                Mg = excluded.Mg;
        """, (
            data["nombre"], data["N"], data["P"], data["K"], data["Ca"], data["Mg"]
        ))

        conn.commit()
        conn.close()

        return jsonify({"success": True})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# ---------------------------------------------------------------------------------------
# ⚗️ ANÁLISIS DE AGUA (DE MOMENTO: MODO SIMPLE)
# ---------------------------------------------------------------------------------------
@app.route("/api/analyze_water", methods=["POST"])
def analyze_water_endpoint():
    data = request.json or {}
    compounds = data.get("compounds", [])

    try:
        # Modo simple: solo sumamos ppm y generamos un reporte textual
        report = []
        total_ppm = 0
        for c in compounds:
            formula = c.get("formula", "?")
            ppm = float(c.get("ppm", 0))
            report.append(f"-> {formula} aportó {ppm} ppm (simulado)")
            total_ppm += ppm
        report.append(f"Total de sales simulado: {total_ppm} ppm.")

        return jsonify({"success": True, "report": report})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ---------------------------------------------------------------------------------------
# 🍃 DIAGNÓSTICO DE DEFICIENCIAS + PLAN DE CORRECCIÓN (MOTOR QUÍMICO)
# ---------------------------------------------------------------------------------------
@app.route("/api/deficiency/plan", methods=["POST"])
def deficiency_plan_endpoint():
    if chem_engine is None:
        return jsonify({"success": False, "error": "Motor químico no instalado"}), 500

    data = request.json or {}
    symptom_code = data.get("symptom_code")
    volume_L = float(data.get("volume_L") or 0)

    current_profile = data.get("current_profile")      # opcional: dict con N,P,K,Ca,Mg
    tissue_analysis = data.get("tissue_analysis")      # opcional

    if not symptom_code:
        return jsonify({"success": False, "error": "Falta 'symptom_code'"}), 400

    try:
        plan = chem_engine.build_correction_plan(
            symptom_code=symptom_code,
            volume_L=volume_L,
            current_profile=current_profile,
            tissue_analysis=tissue_analysis,
        )
        status = 200 if plan.get("success") else 400
        return jsonify(plan), status
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ---------------------------------------------------------------------------------------
# ⚛️ BALANCEO ESTEQUIOMÉTRICO GENERAL
# ---------------------------------------------------------------------------------------
@app.route("/api/balance_reaction", methods=["POST"])
def balance_reaction_endpoint():
    if chem_engine is None:
        return jsonify({"success": False, "error": "Motor químico no instalado"}), 500

    data = request.json or {}
    reactants = data.get("reactants") or []
    products = data.get("products") or []

    if not reactants or not products:
        return jsonify({
            "success": False,
            "error": "Debes enviar listas 'reactants' y 'products', ej: ['NH3','O2'], ['NO','H2O']"
        }), 400

    try:
        result = chem_engine.balance_reaction(reactants, products)
        status = 200 if result.get("success") else 400
        return jsonify(result), status
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/molar_solution", methods=["POST"])
def molar_solution():
    if chem_engine is None:
        return jsonify({"success": False, "error": "Motor químico no instalado"}), 500

    data = request.json or {}
    compound = data.get("compound")
    volume = float(data.get("volume_L") or 0)

    try:
        sol = chem_engine.prepare_molar_solution(compound, volume)
        return jsonify(sol)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500



# ---------------------------------------------------------------------------------------
# ARRANQUE
# ---------------------------------------------------------------------------------------
if __name__ == "__main__":
    print("HydroSynapse Backend iniciado.")
    print("DB:", db_manager.db_path)
    print("Motor químico avanzado:", "✔️ ACTIVADO" if chem_engine else "❌ NO DETECTADO")
    app.run(port=8000, debug=True)
