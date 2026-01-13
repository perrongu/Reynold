/**
 * Application principale - Orchestration de tous les modules
 */

import { CFD2DRenderer } from './cfd2d.js?v=20260113i';
import { UIManager } from './ui.js?v=20260113h';
import { WebSocketManager } from './websocket.js?v=20260109n';

class ReynoldsFlowApp {
    constructor() {
        this.renderer = null;
        this.uiManager = null;
        this.wsManager = null;
        
        // État courant
        this.currentData = {
            reynolds: 0,
            regime: 'laminar',
            turbulence_factor: 0
        };
        
        this.presets = {};
        
        this._init();
    }
    
    async _init() {
        console.log('🌊 Initialisation Reynolds Flow Demo...');
        
        // Initialiser le rendu CFD 2D
        const container = document.getElementById('canvas-container');
        this.renderer = new CFD2DRenderer(container);
        
        // Initialiser l'UI
        this.uiManager = new UIManager();
        this._setupUICallbacks();
        
        // Charger les presets
        await this._loadPresets();
        
        // Initialiser WebSocket
        this.wsManager = new WebSocketManager();
        this._setupWebSocketCallbacks();
        await this.wsManager.connect();
        
        // Envoyer les valeurs initiales
        this._sendCurrentValues();
        
        // Démarrer la boucle de rendu
        this._startRenderLoop();
        
        console.log('✅ Initialisation terminée');
    }
    
    async _loadPresets() {
        try {
            const response = await fetch('/api/presets');
            this.presets = await response.json();
            console.log('📦 Presets chargés:', Object.keys(this.presets));
        } catch (e) {
            console.warn('⚠️ Impossible de charger les presets:', e);
            // Presets par défaut
            this.presets = {
                water: { velocity: 1.0, diameter: 0.1, density: 998, viscosity: 0.001 },
                oil: { velocity: 0.5, diameter: 0.1, density: 900, viscosity: 0.1 },
                air: { velocity: 5.0, diameter: 0.1, density: 1.2, viscosity: 0.000018 },
                honey: { velocity: 0.1, diameter: 0.05, density: 1400, viscosity: 2.0 }
            };
        }
    }
    
    _setupUICallbacks() {
        // Changement de valeur des sliders
        this.uiManager.onChange = (values) => {
            // Mettre à jour le rendu (diamètre inclus)
            this.renderer.setInputs({
                velocity: values.velocity,
                diameter: values.diameter
            });
            this._sendCurrentValues();
        };
        
        // Sélection d'un preset (seulement densité et viscosité)
        this.uiManager.onPreset = (presetName) => {
            if (this.presets[presetName]) {
                const preset = this.presets[presetName];
                // Ne mettre à jour que density et viscosity
                this.uiManager.setValues({
                    density: preset.density,
                    viscosity: preset.viscosity
                });
                this._sendCurrentValues();
            }
        };
    }
    
    _setupWebSocketCallbacks() {
        this.wsManager.onMessage = (data) => {
            if (data.error) {
                console.error('Erreur serveur:', data.error);
                return;
            }
            
            this.currentData = data;
            
            // Mettre à jour l'UI
            this.uiManager.updateResults(data);
            
            // Mettre à jour le rendu CFD avec le nombre de Reynolds
            const { velocity, diameter } = this.uiManager.getValues();
            this.renderer.setInputs({
                velocity,
                diameter,
                reynolds: data.reynolds,
                turbulence_factor: data.turbulence_factor,
                turbulence_intensity: data.turbulence_intensity
            });
        };
        
        this.wsManager.onConnect = () => {
            this.uiManager.setConnected(true);
        };
        
        this.wsManager.onDisconnect = () => {
            this.uiManager.setConnected(false);
        };
    }
    
    _sendCurrentValues() {
        const values = this.uiManager.getValues();
        this.wsManager.send(values);
    }
    
    _startRenderLoop() {
        let last = performance.now();
        const animate = () => {
            requestAnimationFrame(animate);
            
            const now = performance.now();
            const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
            last = now;
            this.renderer.tick(dt);
        };
        
        animate();
    }
    
    dispose() {
        this.wsManager.disconnect();
        this.renderer.dispose();
    }
}

// Démarrer l'application au chargement
window.addEventListener('DOMContentLoaded', () => {
    window.app = new ReynoldsFlowApp();
});

// Cleanup propre
window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.dispose();
    }
});
