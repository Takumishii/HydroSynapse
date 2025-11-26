# chemistry_engine/concentration_engine.py

from __future__ import annotations
from dataclasses import dataclass
from typing import Dict


@dataclass
class SolutionContext:
    """
    Contexto de la solución en la que estamos trabajando.
    Asumimos agua con densidad ~1 kg/L (válido para soluciones hidropónicas).
    """
    volume_L: float  # volumen del tanque en litros


class ConcentrationEngine:
    """
    Motor de conversión de unidades y cálculo de masas de fertilizantes.

    Incluye:
      - ppm <-> g/L
      - ppm <-> molaridad
      - cálculo de gramos de fertilizante necesarios para cambiar X ppm
        de un nutriente dado, respetando el % en el análisis del fertilizante.
    """

    def ppm_to_mg_per_L(self, ppm: float) -> float:
        """
        1 ppm ~= 1 mg/L en agua.
        """
        return ppm

    def mg_per_L_to_ppm(self, mg_per_L: float) -> float:
        return mg_per_L

    def g_per_L_to_ppm(self, g_per_L: float) -> float:
        """
        1 g/L = 1000 mg/L = 1000 ppm (agua).
        """
        return g_per_L * 1000.0

    def ppm_to_g_per_L(self, ppm: float) -> float:
        """
        ppm → g/L (en agua).
        """
        return ppm / 1000.0

    def molarity_to_ppm(self, molarity_M: float, molar_mass_g_mol: float) -> float:
        """
        Convierte molaridad (mol/L) a ppm asumiendo agua.
        ppm = (mol/L * g/mol * 1000 mg/g)
        """
        mg_per_L = molarity_M * molar_mass_g_mol * 1000.0
        return mg_per_L  # mg/L = ppm

    def ppm_to_molarity(self, ppm: float, molar_mass_g_mol: float) -> float:
        """
        Convierte ppm a molaridad (mol/L).
        ppm ~ mg/L.
        mol/L = (mg/L) / (1000 mg/g * g/mol)
        """
        mg_per_L = ppm
        mol_per_L = mg_per_L / (1000.0 * molar_mass_g_mol)
        return mol_per_L

    # ------------------------------------------------------------------ #
    # CÁLCULOS DE MASA DE FERTILIZANTE
    # ------------------------------------------------------------------ #

    def grams_of_fertilizer_for_delta_ppm(
        self,
        delta_ppm: float,
        volume_L: float,
        nutrient_fraction: float,
    ) -> float:
        """
        Calcula cuántos gramos de una sal hay que agregar para aumentar
        delta_ppm de UN nutriente dado.

        Parámetros:
          - delta_ppm: cuánto queremos subir el nutriente (N, P, etc.) en ppm.
          - volume_L: volumen de solución (L).
          - nutrient_fraction: fracción en masa del nutriente en la sal.
            Ej: Nitrato de Calcio con 15.5% N → nutrient_fraction = 0.155

        Fórmula:
          mg/L (nutriente) = delta_ppm
          mg/L (sal) = delta_ppm / nutrient_fraction
          g/L (sal) = mg/L / 1000
          gramos totales = g/L * volumen_L
        """
        if nutrient_fraction <= 0:
            raise ValueError("La fracción de nutriente debe ser > 0")

        mg_per_L_nutrient = delta_ppm
        mg_per_L_salt = mg_per_L_nutrient / nutrient_fraction
        g_per_L_salt = mg_per_L_salt / 1000.0
        total_grams = g_per_L_salt * volume_L
        return total_grams

    def nutrient_ppm_from_fertilizer(
        self,
        fertilizer_grams: float,
        volume_L: float,
        nutrient_fraction: float,
    ) -> float:
        """
        Dado cuántos gramos de sal agrego, devuelve a cuántos ppm equivale
        el nutriente objetivo en el tanque.
        """
        if volume_L <= 0:
            raise ValueError("El volumen debe ser mayor que cero.")

        total_nutrient_g = fertilizer_grams * nutrient_fraction
        g_per_L_nutrient = total_nutrient_g / volume_L
        ppm = self.g_per_L_to_ppm(g_per_L_nutrient)
        return ppm
