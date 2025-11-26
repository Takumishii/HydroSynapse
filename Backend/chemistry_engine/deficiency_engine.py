# chemistry_engine/deficiency_engine.py

from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class DeficiencyHypothesis:
    """
    Representa una hipótesis de deficiencia para un síntoma dado.
    """
    primary_nutrients: List[str]      # Ej: ["N"], ["Ca", "B"]
    secondary_nutrients: List[str]    # Nutrientes que también pueden estar implicados
    description: str                  # Explicación detallada
    recommendation: str               # Texto amigable para el usuario
    target_delta_ppm: Dict[str, float]  # Objetivos típicos de corrección (Δ ppm)
    preferred_fertilizers: List[str]    # IDs de fertilizantes preferidos para corregir


class DeficiencyEngine:
    """
    Motor de diagnóstico de deficiencias.

    Recibe un "symptom_code" (ej: "hojas_curvadas") y devuelve:
      - Explicación detallada
      - Nutrientes implicados
      - Δ ppm sugeridos para corrección
      - Sales recomendadas para aplicar dicha corrección
    """

    def __init__(self):
        self._rules: Dict[str, DeficiencyHypothesis] = self._build_rules()

    # ------------------------------------------------------------------ #
    # REGLAS BASE
    # ------------------------------------------------------------------ #

    def _build_rules(self) -> Dict[str, DeficiencyHypothesis]:
        """
        Aquí defines todos los síntomas y sus interpretaciones.
        Puedes ir afinando esto con el tiempo.
        """
        rules: Dict[str, DeficiencyHypothesis] = {}

        # 1) Clorosis en hojas viejas → deficiencia de N (y a veces Mg)
        rules["clorosis_hojas_viejas"] = DeficiencyHypothesis(
            primary_nutrients=["N"],
            secondary_nutrients=["Mg"],
            description=(
                "La clorosis en hojas viejas suele indicar deficiencia de nitrógeno (N), "
                "pues es un nutriente móvil que se redistribuye hacia tejidos nuevos. "
                "En algunos casos puede coexistir con baja disponibilidad de Magnesio (Mg)."
            ),
            recommendation=(
                "Aumenta ligeramente la concentración de N (p.ej. +20–40 ppm) usando una fuente "
                "rica en nitratos (Nitrato de Calcio o Nitrato de Potasio) y revisa que el pH "
                "se mantenga en el rango 5.5–6.0 para evitar bloqueos."
            ),
            target_delta_ppm={"N": 30.0},  # valor típico sugerido
            preferred_fertilizers=["NitratoCalcio", "NitratoPotasio", "NitratoAmonio"],
        )

        # 2) Necrosis bordes hojas nuevas → K o Ca (exceso de sales también)
        rules["necrosis_bordes"] = DeficiencyHypothesis(
            primary_nutrients=["K", "Ca"],
            secondary_nutrients=["Mg"],
            description=(
                "La necrosis o 'quemadura' en bordes de hojas nuevas puede indicar problemas "
                "con el Potasio (K) o con el Calcio (Ca). También puede deberse a toxicidad "
                "por exceso de sales (EC demasiado alta)."
            ),
            recommendation=(
                "Verifica la EC de la solución. Si es muy alta, considera diluir o hacer un "
                "flush. Si la EC es correcta, aumenta ligeramente K (ej. +20 ppm) o revisa "
                "que el aporte de Ca sea suficiente a través de Nitrato de Calcio."
            ),
            target_delta_ppm={"K": 20.0},
            preferred_fertilizers=["NitratoPotasio"],
        )

        # 3) Hojas nuevas pequeñas/curvadas → Ca o B con explicación completa
        rules["hojas_curvadas"] = DeficiencyHypothesis(
            primary_nutrients=["Ca"],
            secondary_nutrients=["B"],
            description=(
                "Hojas nuevas deformadas, pequeñas o curvadas suelen indicar problemas de "
                "movilidad de Calcio (Ca) o deficiencia de Boro (B). El Calcio tiene "
                "movilidad muy limitada en la planta, por lo que depende fuertemente del "
                "flujo transpiratorio y de la concentración en la solución nutritiva."
            ),
            recommendation=(
                "Asegúrate de que tu solución aporte suficiente Calcio mediante Nitrato de Calcio. "
                "Mantén el pH en 5.5–6.0 para favorecer la absorción. Evita EC excesiva que "
                "pueda estresar las raíces. Si el problema persiste, evalúa un aporte foliar "
                "suave de Ca o B formulado específicamente para ello."
            ),
            target_delta_ppm={"Ca": 30.0},
            preferred_fertilizers=["NitratoCalcio"],
        )

        # 4) Tallos púrpura → P bajo + temperaturas bajas
        rules["tallos_púrpura"] = DeficiencyHypothesis(
            primary_nutrients=["P"],
            secondary_nutrients=[],
            description=(
                "Coloración púrpura en tallos o envés de hojas suele asociarse a deficiencia "
                "de Fósforo (P), especialmente bajo condiciones de baja temperatura. "
                "El fósforo es clave en energía (ATP) y en el desarrollo radicular."
            ),
            recommendation=(
                "Incrementa la dosis de Fósforo usando Fosfato Monopotásico, añadiendo "
                "unos +15–25 ppm de P. Asegúrate de que la temperatura de la solución no "
                "sea demasiado baja y que el pH esté en rango adecuado (5.5–6.2)."
            ),
            target_delta_ppm={"P": 20.0},
            preferred_fertilizers=["FosfatoMonopot"],
        )

        return rules

    # ------------------------------------------------------------------ #
    # API PÚBLICA
    # ------------------------------------------------------------------ #

    def diagnose(
        self,
        symptom_code: str,
        current_profile: Optional[Dict[str, float]] = None,
        tissue_analysis: Optional[Dict[str, float]] = None,
    ) -> Dict:
        """
        Devuelve un diagnóstico estructurado para un síntoma.

        current_profile: PPM objetivo (N, P, K, Ca, Mg) que usas en el tanque.
        tissue_analysis: Análisis foliar opcional (ppm o % relativos).
        """
        if symptom_code not in self._rules:
            return {
                "success": False,
                "symptom": symptom_code,
                "message": "Síntoma no registrado en las reglas internas.",
            }

        rule = self._rules[symptom_code]

        base = {
            "success": True,
            "symptom": symptom_code,
            "primary_nutrients": rule.primary_nutrients,
            "secondary_nutrients": rule.secondary_nutrients,
            "description": rule.description,
            "recommendation": rule.recommendation,
            "target_delta_ppm": rule.target_delta_ppm,
            "preferred_fertilizers": rule.preferred_fertilizers,
        }

        # Opcional: enriquecer con contexto de perfil actual
        if current_profile:
            base["current_profile"] = current_profile

        if tissue_analysis:
            base["tissue_analysis"] = tissue_analysis

        return base
