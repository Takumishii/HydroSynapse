# chemistry_engine/stoichiometry_engine.py

from __future__ import annotations
from typing import Dict
import json
import os

class StoichiometryEngine:
    """
    Cálculos estequiométricos:
      - g ↔ mol
      - Preparación de soluciones molares
      - Macronutrientes requeridos para plantas
    """

    # Masa molar de elementos principales usados en hidroponía
    MOLAR_MASS = {
        "H": 1.008,
        "C": 12.01,
        "N": 14.01,
        "O": 16.00,
        "P": 30.97,
        "S": 32.06,
        "K": 39.10,
        "Ca": 40.08,
        "Mg": 24.31,
        "B": 10.81,
        "F": 19.00
    }

    def __init__(self):
        pass

    # -----------------------------
    # Conversiones básicas
    # -----------------------------
    def grams_to_moles(self, grams: float, molar_mass: float) -> float:
        return grams / molar_mass

    def moles_to_grams(self, moles: float, molar_mass: float) -> float:
        return moles * molar_mass

    # -----------------------------
    # SOLUCIÓN MOLAR DE UN COMPUESTO
    # -----------------------------
    def solution_molar(self, formula: str, molarity_M: float, volume_L: float) -> Dict:
        """
        Devuelve cuántos gramos necesitas para preparar una solución molar:
          gramos = molaridad * volumen * masa molar del compuesto
        """

        from .reactions import parse_formula  # reutilizamos tu parser avanzado
        counts = parse_formula(formula)

        # Calcular masa molar del compuesto
        M = 0
        for elem, qty in counts.items():
            if elem not in self.MOLAR_MASS:
                raise ValueError(f"Masa molar desconocida para el elemento {elem}")
            M += qty * self.MOLAR_MASS[elem]

        grams_needed = molarity_M * volume_L * M

        return {
            "success": True,
            "formula": formula,
            "molar_mass": round(M, 4),
            "molarity": molarity_M,
            "volume_L": volume_L,
            "grams_required": round(grams_needed, 4),
        }
