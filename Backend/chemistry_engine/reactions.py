# chemistry_engine/reactions.py

from __future__ import annotations
from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, List, Tuple

import sympy as sp


def parse_formula(formula: str) -> Dict[str, int]:
    """
    Parsea una fórmula química (con paréntesis anidados) en un dict {elemento: cantidad}.
    Ejemplos soportados:
      - "H2O"
      - "Ca(NO3)2"
      - "K2SO4"
      - "Mg(OH)2"
      - con paréntesis anidados tipo "Ca3(PO4)2"
    """

    i = 0
    n = len(formula)

    def parse_group() -> Dict[str, int]:
        nonlocal i
        counts = defaultdict(int)

        while i < n:
            char = formula[i]

            if char == '(':
                i += 1  # saltar '('
                inner_counts = parse_group()
                if i < n and formula[i] == ')':
                    i += 1  # saltar ')'
                # leer multiplicador
                start = i
                while i < n and formula[i].isdigit():
                    i += 1
                mult_str = formula[start:i]
                mult = int(mult_str) if mult_str else 1
                for elem, cnt in inner_counts.items():
                    counts[elem] += cnt * mult

            elif char == ')':
                # final de grupo, retornar al nivel superior
                break

            elif char.isalpha():
                # elemento: mayus + opcional minus
                elem = char
                i += 1
                if i < n and formula[i].islower():
                    elem += formula[i]
                    i += 1
                # leer subíndice
                start = i
                while i < n and formula[i].isdigit():
                    i += 1
                num_str = formula[start:i]
                num = int(num_str) if num_str else 1
                counts[elem] += num

            else:
                # caracteres inesperados, simplemente avanzar
                i += 1

        return counts

    return dict(parse_group())


@dataclass
class BalancedReaction:
    reactants: List[Tuple[str, int]]  # [(formula, coeficiente entero), ...]
    products: List[Tuple[str, int]]

    def to_string(self) -> str:
        def side_to_str(side: List[Tuple[str, int]]) -> str:
            parts = []
            for f, c in side:
                if c == 1:
                    parts.append(f)
                else:
                    parts.append(f"{c} {f}")
            return " + ".join(parts)

        return f"{side_to_str(self.reactants)} -> {side_to_str(self.products)}"


class ReactionBalancer:
    """
    Balanceador de ecuaciones químicas por álgebra lineal usando Sympy.

    Uso:
        balancer = ReactionBalancer()
        result = balancer.balance(["NH3", "O2"], ["NO", "H2O"])
        print(result.to_string())  # ej: "4 NH3 + 5 O2 -> 4 NO + 6 H2O"
    """

    def __init__(self):
        self.atomic_masses = {
            "H": 1.008, "He": 4.003, "Li": 6.94, "Be": 9.012,
            "B": 10.81, "C": 12.01, "N": 14.01, "O": 16.00,
            "F": 19.00, "Na": 22.99, "Mg": 24.31, "Al": 26.98,
            "Si": 28.09, "P": 30.97, "S": 32.06, "Cl": 35.45,
            "K": 39.10, "Ca": 40.08, "Mn": 54.94, "Fe": 55.85,
            "Cu": 63.55, "Zn": 65.38, "Mo": 95.95
        }

    def molar_mass(self, formula: str) -> float:
        d = parse_formula(formula)
        total = 0.0
        for elem, count in d.items():
            if elem not in self.atomic_masses:
                raise ValueError(f"Elemento desconocido: {elem}")
            total += self.atomic_masses[elem] * count
        return total


    def balance(
        self,
        reactants: List[str],
        products: List[str]
    ) -> BalancedReaction:
        """
        Devuelve una reacción balanceada con coeficientes enteros mínimos.
        Lanza ValueError si no se puede balancear.
        """
        compounds = reactants + products
        compounds_parsed = [parse_formula(f) for f in compounds]

        # 1. Construir lista de elementos
        elements = sorted({
            elem
            for comp_dict in compounds_parsed
            for elem in comp_dict.keys()
        })

        # 2. Construir matriz de conservación (una ecuación por elemento)
        #    Reactivos: coef positivos, Productos: coef negativos
        rows = []
        for elem in elements:
            row = []
            for i, comp_dict in enumerate(compounds_parsed):
                count = comp_dict.get(elem, 0)
                if i < len(reactants):
                    row.append(count)       # lado izquierdo
                else:
                    row.append(-count)      # lado derecho (negativo)
            rows.append(row)

        A = sp.Matrix(rows)

        # 3. Buscar el espacio nulo (Ax = 0)
        nullspace = A.nullspace()
        if not nullspace:
            raise ValueError("No se encontró solución no trivial para balancear la reacción.")

        # Tomar el primer vector de la base del espacio nulo
        sol = nullspace[0]  # vector columna
        lcm_den = sp.lcm([term.q for term in sol])  # mínimo común múltiplo de denominadores
        integer_coeffs = [int(term * lcm_den) for term in sol]

        # normalizar para que el MCD sea 1 y el primer coeficiente positivo
        gcd_all = abs(sp.gcd(integer_coeffs))
        integer_coeffs = [c // gcd_all for c in integer_coeffs]

        # Si todos son negativos, los invertimos
        if all(c < 0 for c in integer_coeffs):
            integer_coeffs = [-c for c in integer_coeffs]

        # 4. Separar lados
        reactant_coeffs = integer_coeffs[:len(reactants)]
        product_coeffs = integer_coeffs[len(reactants):]

        balanced_reactants = list(zip(reactants, reactant_coeffs))
        balanced_products = list(zip(products, product_coeffs))

        return BalancedReaction(
            reactants=balanced_reactants,
            products=balanced_products
        )
