# chemistry_engine/chemical_engine.py

from __future__ import annotations
import os
import json
from typing import Dict, Any, List

from .concentration_engine import ConcentrationEngine
from .deficiency_engine import DeficiencyEngine
from .reactions import ReactionBalancer, BalancedReaction


class ChemicalEngine:
    """
    Fachada de alto nivel para lógica química:

      - Diagnóstico de deficiencias + plan de corrección en ppm
      - Cálculo de gramos de sales para corregir esas deficiencias
      - Balanceo de ecuaciones químicas
      - Cálculo de soluciones 1 M (molar)

    Usa:
      - DeficiencyEngine
      - ConcentrationEngine
      - ReactionBalancer
      - fertilizers.json
    """

    def __init__(self, base_path: str | None = None):
        self.base_path = base_path or os.path.dirname(os.path.abspath(__file__))

        # Motores internos
        self.concentration = ConcentrationEngine()
        self.deficiency = DeficiencyEngine()
        self.reactions = ReactionBalancer()

        # Cargar datos de fertilizantes
        self.fertilizers: Dict[str, Dict[str, Any]] = self._load_fertilizers()

    # -------------------------------------------------------------- #
    # CARGA DE DATOS
    # -------------------------------------------------------------- #

    def _load_fertilizers(self) -> Dict[str, Dict[str, Any]]:
        path = os.path.join(self.base_path, "data", "fertilizers.json")
        if not os.path.exists(path):
            alt = os.path.join(os.path.dirname(self.base_path), "data", "fertilizers.json")
            if os.path.exists(alt):
                path = alt
            else:
                print(f"[ChemicalEngine] WARNING: fertilizers.json no encontrado")
                return {}

        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    # -------------------------------------------------------------- #
    # DIAGNÓSTICO + PLAN DE CORRECCIÓN
    # -------------------------------------------------------------- #

    def diagnose_deficiency(
        self,
        symptom_code: str,
        current_profile: Dict[str, float] | None = None,
        tissue_analysis: Dict[str, float] | None = None,
    ) -> Dict[str, Any]:
        return self.deficiency.diagnose(
            symptom_code=symptom_code,
            current_profile=current_profile,
            tissue_analysis=tissue_analysis,
        )

    def build_correction_plan(
        self,
        symptom_code: str,
        volume_L: float,
        current_profile: Dict[str, float] | None = None,
        tissue_analysis: Dict[str, float] | None = None,
    ) -> Dict[str, Any]:

        diag = self.diagnose_deficiency(
            symptom_code=symptom_code,
            current_profile=current_profile,
            tissue_analysis=tissue_analysis,
        )

        if not diag.get("success"):
            return diag

        target_delta_ppm: Dict[str, float] = diag["target_delta_ppm"]
        preferred_ferts: List[str] = diag["preferred_fertilizers"]

        corrections: List[Dict[str, Any]] = []

        for nutrient, delta_ppm in target_delta_ppm.items():
            fert_used = None
            fraction = None

            for fert_name in preferred_ferts:
                fert_info = self.fertilizers.get(fert_name)
                if fert_info and nutrient in fert_info and fert_info[nutrient] > 0:
                    fert_used = fert_name
                    fraction = fert_info[nutrient] / 100.0
                    break

            if fert_used is None:
                corrections.append({
                    "nutrient": nutrient,
                    "delta_ppm": delta_ppm,
                    "fertilizer": None,
                    "grams_required": None,
                    "warning": "No fertilizer provides this nutrient."
                })
                continue

            grams = self.concentration.grams_of_fertilizer_for_delta_ppm(
                delta_ppm=delta_ppm,
                volume_L=volume_L,
                nutrient_fraction=fraction,
            )

            corrections.append({
                "nutrient": nutrient,
                "delta_ppm": delta_ppm,
                "fertilizer": fert_used,
                "fertilizer_fraction": fraction,
                "grams_required": round(grams, 2),
            })

        return {
            "success": True,
            "symptom": symptom_code,
            "diagnosis": diag,
            "volume_L": volume_L,
            "corrections": corrections,
        }

    # -------------------------------------------------------------- #
    # BALANCEO DE ECUACIONES
    # -------------------------------------------------------------- #

    def balance_reaction(self, reactants: List[str], products: List[str]) -> Dict[str, Any]:
        try:
            balanced: BalancedReaction = self.reactions.balance(reactants, products)
            return {
                "success": True,
                "reactants": [{"formula": f, "coef": c} for f, c in balanced.reactants],
                "products": [{"formula": f, "coef": c} for f, c in balanced.products],
                "equation": balanced.to_string(),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    # -------------------------------------------------------------- #
    # SOLUCIONES MOLARES 1 M
    # -------------------------------------------------------------- #

    def prepare_molar_solution(self, formula: str, volume_L: float) -> Dict[str, Any]:
        """
        Calcula la masa de compuesto necesaria para preparar X litros de
        solución 1 molar.

        Fórmula:
            gramos = (masa molar) * (litros)
        """
        mm = self.reactions.molar_mass(formula)
        grams = mm * volume_L

        return {
            "success": True,
            "compound": formula,
            "volume_L": volume_L,
            "grams": round(grams, 3),
            "molar_mass": round(mm, 4),
        }
