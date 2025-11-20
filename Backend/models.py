from pydantic import BaseModel
from typing import List, Dict

# Modelo para lo que envía el Frontend
class InputParameters(BaseModel):
    volumen_tanque: float
    perfil_seleccionado: str

# Modelo para lo que devuelve el Backend
class FertilizerDose(BaseModel):
    nombre: str
    dosis_gramos: float
    formula: str = "Sal" # Simplificado

class DoseResult(BaseModel):
    exito: bool
    mensaje: str
    dosis: List[FertilizerDose]
    ec_estimada: float
    ph_estimado: float
    analisis_final: Dict[str, float] # Ej: {"N": 150.1, "P": 50.0}