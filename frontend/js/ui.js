/**
 * Gestion de l'interface utilisateur - sliders et affichage
 */

export class UIManager {
    constructor() {
        // Éléments DOM
        this.sliders = {
            velocity: document.getElementById('velocity'),
            diameter: document.getElementById('diameter'),
            density: document.getElementById('density'),
            viscosity: document.getElementById('viscosity')
        };
        
        this.valueDisplays = {
            velocity: document.getElementById('velocity-value'),
            diameter: document.getElementById('diameter-value'),
            density: document.getElementById('density-value'),
            viscosity: document.getElementById('viscosity-value')
        };
        
        this.reynoldsDisplay = document.getElementById('reynolds-value');
        this.regimeBadge = document.getElementById('regime-badge');
        this.regimeIndicator = document.getElementById('regime-indicator');
        this.connectionStatus = document.getElementById('connection-status');
        this.presetButtons = document.querySelectorAll('.preset-btn');
        
        // État actuel
        this.values = {
            velocity: 1.0,
            diameter: 0.1,
            density: 1000,
            viscosity: 0.001
        };
        
        // Callbacks
        this.onChange = null;
        this.onPreset = null;
        
        // Initialisation
        this._setupEventListeners();
        this._updateAllDisplays();
    }
    
    _setupEventListeners() {
        // Sliders
        Object.keys(this.sliders).forEach(key => {
            const slider = this.sliders[key];
            
            slider.addEventListener('input', (e) => {
                this.values[key] = parseFloat(e.target.value);
                this._updateDisplay(key);
                this._clearActivePreset();
                
                if (this.onChange) {
                    this.onChange(this.values);
                }
            });
        });
        
        // Presets
        this.presetButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                this._setActivePreset(btn);
                
                if (this.onPreset) {
                    this.onPreset(preset);
                }
            });
        });
    }
    
    _updateDisplay(key) {
        const value = this.values[key];
        const display = this.valueDisplays[key];
        
        if (!display) return;
        
        switch (key) {
            case 'velocity':
                display.textContent = `${value.toFixed(2)} m/s`;
                break;
            case 'diameter':
                display.textContent = `${value.toFixed(2)} m`;
                break;
            case 'density':
                display.textContent = `${Math.round(value)} kg/m³`;
                break;
            case 'viscosity':
                // Format adaptatif selon l'ordre de grandeur
                if (value < 0.001) {
                    display.textContent = `${(value * 1000).toFixed(3)} mPa·s`;
                } else if (value < 0.1) {
                    display.textContent = `${value.toFixed(4)} Pa·s`;
                } else {
                    display.textContent = `${value.toFixed(2)} Pa·s`;
                }
                break;
        }
    }
    
    _updateAllDisplays() {
        Object.keys(this.values).forEach(key => {
            this._updateDisplay(key);
        });
    }
    
    _setActivePreset(activeBtn) {
        this.presetButtons.forEach(btn => btn.classList.remove('active'));
        activeBtn.classList.add('active');
    }
    
    _clearActivePreset() {
        this.presetButtons.forEach(btn => btn.classList.remove('active'));
    }
    
    setValues(values) {
        Object.keys(values).forEach(key => {
            if (this.sliders[key] && values[key] !== undefined) {
                this.values[key] = values[key];
                this.sliders[key].value = values[key];
                this._updateDisplay(key);
            }
        });
    }
    
    getValues() {
        return { ...this.values };
    }
    
    updateResults(data) {
        if (!data) return;
        
        // Reynolds number
        if (data.reynolds !== undefined) {
            const re = data.reynolds;
            let formatted;
            
            if (re >= 1e6) {
                formatted = `${(re / 1e6).toFixed(2)} × 10⁶`;
            } else if (re >= 1e3) {
                formatted = `${(re / 1e3).toFixed(1)} × 10³`;
            } else if (re >= 1) {
                formatted = re.toFixed(1);
            } else {
                formatted = re.toExponential(2);
            }
            
            this.reynoldsDisplay.textContent = formatted;
        }
        
        // Regime badge
        if (data.regime !== undefined) {
            const regime = data.regime.toLowerCase();
            // Map backend French values to English
            const regimeMap = {
                'laminaire': 'laminar',
                'transition': 'transition',
                'turbulent': 'turbulent'
            };
            const englishRegime = regimeMap[regime] || regime;
            this.regimeBadge.textContent = this._capitalizeFirst(englishRegime);
            this.regimeBadge.className = `result-badge ${englishRegime}`;
        }
        
        // Regime indicator position
        if (data.turbulence_factor !== undefined) {
            const factor = data.turbulence_factor;
            // Positionner l'indicateur (0-100%)
            const percent = Math.min(100, Math.max(0, factor * 100));
            this.regimeIndicator.style.left = `calc(${percent}% - 2px)`;
        }
    }
    
    setConnected(connected) {
        if (connected) {
            this.connectionStatus.classList.remove('disconnected');
            this.connectionStatus.classList.add('connected');
            this.connectionStatus.title = 'Connected';
        } else {
            this.connectionStatus.classList.remove('connected');
            this.connectionStatus.classList.add('disconnected');
            this.connectionStatus.title = 'Disconnected';
        }
    }
    
    _capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
