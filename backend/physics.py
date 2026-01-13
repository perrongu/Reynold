"""
Calculs physiques pour le nombre de Reynolds et la classification des régimes d'écoulement.
"""
from dataclasses import dataclass
from enum import Enum
from typing import Tuple


class FlowRegime(str, Enum):
    LAMINAR = "laminaire"
    TRANSITION = "transition"
    TURBULENT = "turbulent"


# Seuils classiques pour écoulement en conduite
RE_LAMINAR_MAX = 2300
RE_TURBULENT_MIN = 4000


@dataclass
class FlowParameters:
    """Paramètres d'entrée pour le calcul du Reynolds."""
    velocity: float      # m/s
    diameter: float      # m
    density: float       # kg/m³
    viscosity: float     # Pa·s (viscosité dynamique)


@dataclass
class FlowResult:
    """Résultat du calcul avec toutes les informations utiles."""
    reynolds: float
    regime: FlowRegime
    turbulence_factor: float  # 0.0 (laminaire pur) à 1.0 (turbulent pur)
    kinematic_viscosity: float  # m²/s
    turbulence_intensity: float  # Intensité turbulente théorique (%)
    
    def to_dict(self) -> dict:
        return {
            "reynolds": self.reynolds,
            "regime": self.regime.value,
            "turbulence_factor": self.turbulence_factor,
            "kinematic_viscosity": self.kinematic_viscosity,
            "turbulence_intensity": self.turbulence_intensity
        }


def calculate_reynolds(params: FlowParameters) -> float:
    """
    Calcule le nombre de Reynolds.
    
    Re = (ρ × v × D) / μ
    
    où:
        ρ = densité (kg/m³)
        v = vitesse (m/s)
        D = diamètre caractéristique (m)
        μ = viscosité dynamique (Pa·s)
    """
    if params.viscosity <= 0:
        raise ValueError("La viscosité doit être positive")
    
    return (params.density * params.velocity * params.diameter) / params.viscosity


def determine_regime(reynolds: float) -> FlowRegime:
    """Détermine le régime d'écoulement basé sur le nombre de Reynolds."""
    if reynolds < RE_LAMINAR_MAX:
        return FlowRegime.LAMINAR
    elif reynolds > RE_TURBULENT_MIN:
        return FlowRegime.TURBULENT
    else:
        return FlowRegime.TRANSITION


def calculate_turbulence_intensity(reynolds: float) -> float:
    """
    Calcule l'intensité turbulente théorique basée sur des corrélations empiriques.
    
    Pour un écoulement en conduite :
    - Laminaire : I ≈ 0%
    - Transition : I ≈ 1-5%
    - Turbulent : I ≈ 0.16 * Re^(-1/8) (corrélation de Prandtl-Karman)
    
    Returns:
        Intensité turbulente en fraction (0.05 = 5%)
    """
    if reynolds < RE_LAMINAR_MAX:
        return 0.0
    elif reynolds > RE_TURBULENT_MIN:
        # Corrélation empirique pour turbulence pleinement développée
        return 0.16 * (reynolds ** (-1.0/8.0))
    else:
        # Zone de transition : interpolation
        t = (reynolds - RE_LAMINAR_MAX) / (RE_TURBULENT_MIN - RE_LAMINAR_MAX)
        turb_intensity = 0.16 * (RE_TURBULENT_MIN ** (-1.0/8.0))
        return t * turb_intensity


def calculate_turbulence_factor(reynolds: float) -> float:
    """
    Calcule un facteur de turbulence normalisé entre 0 et 1.
    
    - 0.0 : écoulement parfaitement laminaire
    - 0.5 : zone de transition
    - 1.0 : écoulement pleinement turbulent
    
    Utilise une interpolation smooth pour la transition.
    """
    if reynolds <= RE_LAMINAR_MAX:
        # Zone laminaire : facteur proportionnel jusqu'au seuil
        return min(reynolds / RE_LAMINAR_MAX * 0.3, 0.3)
    elif reynolds >= RE_TURBULENT_MIN:
        # Zone turbulente : asymptote vers 1.0
        # Utilise une fonction tanh pour saturer progressivement
        excess = (reynolds - RE_TURBULENT_MIN) / RE_TURBULENT_MIN
        return 0.7 + 0.3 * (1 - 1 / (1 + excess))
    else:
        # Zone de transition : interpolation linéaire entre 0.3 et 0.7
        t = (reynolds - RE_LAMINAR_MAX) / (RE_TURBULENT_MIN - RE_LAMINAR_MAX)
        return 0.3 + t * 0.4


def analyze_flow(params: FlowParameters) -> FlowResult:
    """
    Analyse complète de l'écoulement.
    
    Retourne le nombre de Reynolds, le régime, et le facteur de turbulence.
    """
    reynolds = calculate_reynolds(params)
    regime = determine_regime(reynolds)
    turbulence_factor = calculate_turbulence_factor(reynolds)
    kinematic_viscosity = params.viscosity / params.density
    turbulence_intensity = calculate_turbulence_intensity(reynolds)
    
    return FlowResult(
        reynolds=reynolds,
        regime=regime,
        turbulence_factor=turbulence_factor,
        kinematic_viscosity=kinematic_viscosity,
        turbulence_intensity=turbulence_intensity
    )


# Presets de fluides courants (à 20°C environ)
FLUID_PRESETS = {
    "water": FlowParameters(
        velocity=1.0,
        diameter=0.1,
        density=998.0,      # kg/m³
        viscosity=0.001002  # Pa·s
    ),
    "oil": FlowParameters(
        velocity=0.5,
        diameter=0.1,
        density=900.0,      # kg/m³
        viscosity=0.1       # Pa·s (huile moteur)
    ),
    "air": FlowParameters(
        velocity=5.0,
        diameter=0.1,
        density=1.204,      # kg/m³
        viscosity=0.0000181 # Pa·s
    ),
    "honey": FlowParameters(
        velocity=0.1,
        diameter=0.05,
        density=1400.0,     # kg/m³
        viscosity=2.0       # Pa·s
    )
}
