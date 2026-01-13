"""
Serveur FastAPI pour la démo interactive du nombre de Reynolds.
Gère les WebSockets pour la communication temps réel et sert les fichiers statiques.
"""
import json
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from physics import FlowParameters, analyze_flow, FLUID_PRESETS

# Configuration logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Chemins
BASE_DIR = Path(__file__).parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager pour le serveur."""
    logger.info("🚀 Démarrage du serveur Reynolds Demo")
    logger.info(f"📁 Frontend servi depuis: {FRONTEND_DIR}")
    yield
    logger.info("👋 Arrêt du serveur")


app = FastAPI(
    title="Reynolds Flow Demo",
    description="Démonstration interactive du nombre de Reynolds",
    version="1.0.0",
    lifespan=lifespan
)


# Monte les fichiers statiques
app.mount("/css", StaticFiles(directory=FRONTEND_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=FRONTEND_DIR / "js"), name="js")


@app.get("/")
async def serve_index():
    """Sert la page principale."""
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/api/presets")
async def get_presets():
    """Retourne les presets de fluides disponibles."""
    return {
        name: {
            "velocity": p.velocity,
            "diameter": p.diameter,
            "density": p.density,
            "viscosity": p.viscosity
        }
        for name, p in FLUID_PRESETS.items()
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Endpoint WebSocket pour les calculs temps réel.
    
    Reçoit: {"velocity": float, "diameter": float, "density": float, "viscosity": float}
    Envoie: {"reynolds": float, "regime": str, "turbulence_factor": float, "kinematic_viscosity": float, "turbulence_intensity": float}
    """
    await websocket.accept()
    client_id = id(websocket)
    logger.info(f"🔌 Client connecté: {client_id}")
    
    try:
        while True:
            # Réception des données
            data = await websocket.receive_text()
            
            try:
                params_dict = json.loads(data)
                
                # Validation et création des paramètres
                params = FlowParameters(
                    velocity=float(params_dict.get("velocity", 1.0)),
                    diameter=float(params_dict.get("diameter", 0.1)),
                    density=float(params_dict.get("density", 1000.0)),
                    viscosity=float(params_dict.get("viscosity", 0.001))
                )
                
                # Calcul
                result = analyze_flow(params)
                
                # Envoi du résultat
                await websocket.send_text(json.dumps(result.to_dict()))
                
            except (json.JSONDecodeError, ValueError, KeyError) as e:
                error_msg = {"error": str(e)}
                await websocket.send_text(json.dumps(error_msg))
                logger.warning(f"⚠️ Erreur de parsing: {e}")
                
    except WebSocketDisconnect:
        logger.info(f"🔌 Client déconnecté: {client_id}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
