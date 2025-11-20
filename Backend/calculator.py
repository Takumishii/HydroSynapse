import json
import numpy as np
import os
# IMPORTACIÓN CORRECTA DE SUS MODELOS DE PYDANTIC
from models import DoseResult, FertilizerDose 
from typing import Dict, List, Any

class NutrientCalculatorService:
    """
    Servicio central de cálculo de recetas de nutrientes basado en álgebra lineal 
    (resolviendo Ax=b).
    """
    def __init__(self, external_profiles: list = None):
        # Cargar datos al iniciar el servicio
        self.base_path = os.path.dirname(os.path.abspath(__file__))
        
        # Cargar perfiles base desde JSON (para referencias estáticas)
        self.json_profiles = self._load_json('data/profiles.json')
        self.fertilizers = self._load_json('data/fertilizers.json')
        
        # Almacenar perfiles externos (los cargados desde SQLite)
        self.external_profiles = {p['nombre']: p for p in external_profiles} if external_profiles else {}
        
        self.nutrient_order = ["N", "P", "K", "Ca", "Mg"]
        
        self.selected_ferts = [
            "NitratoCalcio", "NitratoPotasio", "FosfatoMonopot", 
            "SulfatoMagnesio", "NitratoAmonio"
        ]

    def _load_json(self, path):
        """Carga un archivo JSON relativo al script."""
        full_path = os.path.join(self.base_path, path)
        with open(full_path, 'r') as f:
            return json.load(f)
            
    def get_profile_data(self, profile_name: str) -> Dict[str, Any]:
        """Busca un perfil, primero en los externos (SQLite), luego en los base (JSON)."""
        # 1. Buscar en perfiles externos (SQLite)
        if profile_name in self.external_profiles:
            return self.external_profiles[profile_name]
            
        # 2. Buscar en perfiles base (JSON)
        if profile_name in self.json_profiles:
            return self.json_profiles[profile_name]
            
        raise ValueError(f"Perfil de planta '{profile_name}' no encontrado.")


    def calculate(self, volumen: float, perfil_nombre: str) -> DoseResult:
        """
        Calcula las dosis de fertilizante necesarias para alcanzar el perfil target 
        en un volumen dado.
        """
        try:
            target_profile = self.get_profile_data(perfil_nombre)
            vector_b = np.array([target_profile[nut] for nut in self.nutrient_order])

            # Construcción de la matriz A (Coeficientes)
            matrix_data = []
            for nut in self.nutrient_order:
                row = []
                for fert_name in self.selected_ferts:
                    percent = self.fertilizers[fert_name].get(nut, 0)
                    row.append(percent * 10) # Coeficiente en ppm por gramo/litro
                matrix_data.append(row)
            
            matrix_A = np.array(matrix_data)

            # Resolver Ax = b (x = gramos por litro)
            x_concentracion = np.linalg.solve(matrix_A, vector_b)

            dosis_finales: List[FertilizerDose] = []
            analisis_simulado = {nut: 0.0 for nut in self.nutrient_order}
            total_sales_g_l = 0.0

            for i, fert_name in enumerate(self.selected_ferts):
                gramos_por_litro = max(0, x_concentracion[i]) 
                dosis_total = gramos_por_litro * volumen
                total_sales_g_l += gramos_por_litro
                
                # Obtener la fórmula química para la tabla
                formula_str = self.fertilizers[fert_name].get('formula', 'Sal')

                dosis_finales.append(FertilizerDose(
                    nombre=fert_name,
                    dosis_gramos=round(dosis_total, 2),
                    formula=formula_str
                ))

                # Verificación inversa y análisis simulado
                for j, nut in enumerate(self.nutrient_order):
                    aporte = gramos_por_litro * matrix_A[j][i]
                    analisis_simulado[nut] = round(analisis_simulado[nut] + aporte, 2)


            ec_estimada = round(total_sales_g_l * 1.0, 2) 

            return DoseResult(
                exito=True,
                mensaje="Cálculo óptimo realizado",
                dosis=dosis_finales,
                ec_estimada=ec_estimada,
                ph_estimado=5.8, # Valor ideal hardcodeado por ahora
                analisis_final=analisis_simulado
            )

        except np.linalg.LinAlgError:
            return self._error_response("No se encontró solución matemática exacta (Matriz singular).")
        except ValueError as e:
            return self._error_response(str(e))
        except Exception as e:
            return self._error_response(f"Error de cálculo: {str(e)}")

    def _error_response(self, msg: str) -> DoseResult:
        """Crea una respuesta de error con la estructura Pydantic."""
        return DoseResult(
            exito=False, 
            mensaje=msg, 
            dosis=[], 
            ec_estimada=0.0, 
            ph_estimado=0.0, 
            analisis_final={}
        )