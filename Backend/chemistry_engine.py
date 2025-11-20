import re
from sympy import symbols, Eq, solve # type: ignore
from typing import Dict, List

# Tabla Periódica Simplificada (Pesos Atómicos)
ATOMIC_WEIGHTS = {
    'H': 1.008, 'O': 15.999, 'N': 14.007, 'P': 30.974, 'K': 39.098,
    'Ca': 40.078, 'Mg': 24.305, 'S': 32.065, 'Cl': 35.453, 'Na': 22.990,
    'C': 12.011, 'Fe': 55.845
}

class ChemicalCompound:
    """
    Clase que representa un compuesto químico (ej: CaCl2).
    Usa algoritmos de parsing para entender la fórmula.
    """
    def __init__(self, formula: str, concentration_ppm: float):
        self.formula = formula
        self.concentration = concentration_ppm
        self.elements = self._parse_formula(formula)
        self.molar_mass = self._calculate_molar_mass()

    def _parse_formula(self, formula: str) -> Dict[str, int]:
        """Algoritmo para interpretar strings químicos (ej: 'NO3' -> {N:1, O:3})"""
        # Regex para encontrar Elemento + Numero (Ej: Ca, Cl2)
        pattern = r"([A-Z][a-z]?)(\d*)"
        matches = re.findall(pattern, formula)
        
        composition = {}
        for element, count in matches:
            if element not in ATOMIC_WEIGHTS:
                raise ValueError(f"Elemento desconocido: {element}")
            
            count = int(count) if count else 1
            composition[element] = composition.get(element, 0) + count
        
        return composition

    def _calculate_molar_mass(self) -> float:
        """Calcula el peso molecular total sumando los pesos atómicos"""
        mass = 0.0
        for element, count in self.elements.items():
            mass += ATOMIC_WEIGHTS[element] * count
        return mass

    def get_element_ppm(self, element_symbol: str) -> float:
        """
        Aplica Balance Estequiométrico:
        (Peso del Elemento en la fórmula / Peso Total) * Concentración
        """
        if element_symbol not in self.elements:
            return 0.0
        
        element_mass_in_compound = ATOMIC_WEIGHTS[element_symbol] * self.elements[element_symbol]
        fraction = element_mass_in_compound / self.molar_mass
        return fraction * self.concentration

class WaterAnalyzerService:
    """
    Servicio principal que orquesta el análisis del agua.
    """
    def __init__(self):
        # Estándares agrícolas generales (Ejemplo)
        self.standards = {
            "N": {"min": 100, "max": 250},
            "P": {"min": 30, "max": 80},
            "K": {"min": 150, "max": 350},
            "Ca": {"min": 100, "max": 200},
            "Mg": {"min": 30, "max": 80}
        }

    def analyze_water(self, compounds_input: List[Dict]) -> Dict:
        """
        Recibe una lista de compuestos y retorna el análisis total de nutrientes.
        input ejemplo: [{"formula": "CaCl2", "ppm": 50}, ...]
        """
        total_nutrients = {"N": 0, "P": 0, "K": 0, "Ca": 0, "Mg": 0}
        report = []

        try:
            # 1. Procesar cada compuesto ingresado
            for item in compounds_input:
                compound = ChemicalCompound(item['formula'], float(item['ppm']))
                
                # Sumar aportes estequiométricos a los totales
                for nutrient in total_nutrients.keys():
                    aport = compound.get_element_ppm(nutrient)
                    total_nutrients[nutrient] += aport

            # 2. Generar Reporte y Sugerencias
            quality_report = self._generate_quality_report(total_nutrients)

            return {
                "success": True,
                "nutrients": total_nutrients,
                "report": quality_report
            }

        except Exception as e:
            return {"success": False, "error": str(e)}

    def _generate_quality_report(self, nutrient_totals: Dict) -> List[str]:
        suggestions = []
        for nut, value in nutrient_totals.items():
            std = self.standards[nut]
            if value < std['min']:
                suggestions.append(f"⚠️ Déficit de {nut}: {value:.1f} ppm (Mínimo: {std['min']}). Se recomienda agregar sales ricas en {nut}.")
            elif value > std['max']:
                suggestions.append(f"⛔ Exceso de {nut}: {value:.1f} ppm (Máximo: {std['max']}). Podría causar toxicidad o bloqueo.")
            else:
                suggestions.append(f"✅ {nut} Óptimo ({value:.1f} ppm).")
        return suggestions