from flask import Flask, jsonify, request
# Importaciones de módulos locales
from calculator import NutrientCalculatorService 
from chemistry_engine import WaterAnalyzerService
from database import SQLiteDatabase 
from models import DoseResult, FertilizerDose # Importación de modelos Pydantic
import json
import os
from datetime import datetime

app = Flask(__name__)

# --- INICIALIZACIÓN DE SERVICIOS ---

# 1. Inicializar la Base de Datos SQLite
db_manager = SQLiteDatabase() 

# 2. Cargar perfiles desde SQLite
try:
    available_profiles = db_manager.get_all_profiles()
except Exception as e:
    print(f"Error cargando perfiles iniciales de SQLite: {e}")
    available_profiles = []

# 3. Inicializar los servicios de lógica
calc_service = NutrientCalculatorService(external_profiles=available_profiles)
# Asumo que WaterAnalyzerService existe en chemistry_engine.py
class WaterAnalyzerService:
    """Mock para el servicio de análisis de agua."""
    def analyze_water(self, compounds):
        # Simula un análisis, devolviendo una estructura de datos
        report = []
        total_ppm = 0
        for c in compounds:
            report.append(f"-> {c['formula']} aportó {c['ppm']} ppm. (Simulado)")
            total_ppm += c['ppm']
        report.append(f"Total de sales simulado: {total_ppm} ppm.")
        return {"success": True, "report": report}

water_analyzer = WaterAnalyzerService() 

# --- ENDPOINTS ---

@app.route('/api/calculate_doses', methods=['POST'])
def calculate_doses_endpoint():
    """Calcula las dosis requeridas y guarda el resultado en el historial local."""
    data = request.json
    volumen_tanque = data.get('volumen_tanque')
    perfil_name = data.get('perfil_seleccionado')

    try:
        resultado = calc_service.calculate(volumen_tanque, perfil_name)
        
        # Utilizamos .dict() de Pydantic para obtener un diccionario serializable
        if not resultado.exito:
             return jsonify(resultado.dict()), 500

        # Guardar en el Historial de SQLite
        # Serializamos la lista de objetos FertilizerDose a una lista de diccionarios
        dosis_serializada = [d.dict() for d in resultado.dosis]
        
        db_manager.save_new_recipe_history(
            volumen_L=volumen_tanque,
            perfil_usado=perfil_name,
            ec_final=resultado.ec_estimada,
            dosis_json=json.dumps(dosis_serializada) 
        )

        # Devolvemos la respuesta como un diccionario serializado
        return jsonify(resultado.dict()) 

    except Exception as e:
        # En caso de cualquier error no capturado, devolvemos un error Pydantic
        error_result = DoseResult(
            exito=False, 
            mensaje=f"Error interno en el cálculo: {str(e)}", 
            dosis=[], ec_estimada=0.0, ph_estimado=0.0, analisis_final={}
        )
        return jsonify(error_result.dict()), 500

@app.route('/api/profiles', methods=['GET'])
def get_profiles_endpoint():
    """Endpoint para que el frontend obtenga todos los perfiles (base y personalizados) de SQLite."""
    try:
        profiles = db_manager.get_all_profiles() 
        return jsonify({"success": True, "profiles": profiles})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/profiles/save', methods=['POST'])
def save_profile_endpoint():
    data = request.json

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
            data["nombre"],
            data["N"],
            data["P"],
            data["K"],
            data["Ca"],
            data["Mg"]
        ))

        conn.commit()
        conn.close()

        return jsonify({"success": True})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/control/dosificar', methods=['POST'])
def dosificar_endpoint():
    data = request.json
    # Lógica de dosificación simulada
    return jsonify({"exito": True, "mensaje": f"Comando de dosificación recibido: {data.get('comando')}"})

@app.route('/api/analyze_water', methods=['POST'])
def analyze_water_endpoint():
    data = request.json
    compounds = data.get('compounds', [])
    try:
        report = water_analyzer.analyze_water(compounds)
        return jsonify(report)
    except Exception as e:
        return jsonify({"success": False, "error": f"Error al analizar el agua: {str(e)}"}), 500


if __name__ == '__main__':
    # Usamos un print para indicar el inicio del servidor
    print(f"HydroSynapse Backend iniciado. DB SQLite: {db_manager.db_path}. Escuchando en puerto 8000.")
    app.run(port=8000, debug=True)