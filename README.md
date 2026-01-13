# 🌊 Reynolds Flow Demo

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An interactive web-based visualization of the **Reynolds number** demonstrating the transition between **laminar**, **transitional**, and **turbulent** flow regimes in a pipe.

## ✨ Features

- **Real-time CFD visualization** using HTML5 Canvas 2D
- **Physically accurate flow profiles**: Poiseuille (laminar) and 1/7 power law (turbulent)
- **Interactive parameter tuning**: velocity, diameter, density, viscosity
- **Fluid presets**: Water, Oil, Air, Honey (adjusts density & viscosity only)
- **Real-time WebSocket communication** for instant calculations
- **Color-coded flow regimes**: Blue (laminar) → Yellow (transition) → Red (turbulent)
- **Visual turbulence intensity** based on calculated Reynolds number

## 🚀 Quick Start

### Prerequisites

- Python 3.8 or higher
- Modern web browser (Chrome, Firefox, Edge, Safari)

### Installation & Run

```bash
# Clone the repository
git clone <repository-url>
cd Reynold

# Run the application (auto-installs dependencies)
python3 run.py
```

The browser will automatically open at `http://localhost:8000`.

### Manual Installation (Optional)

```bash
# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Run server
cd backend
uvicorn main:app --reload
```

## 🎛️ Usage

### Controls

- **Velocity (v)**: 0.01 to 10 m/s
- **Diameter (D)**: 0.01 to 1 m
- **Density (ρ)**: 0.5 to 2000 kg/m³
- **Viscosity (μ)**: 0.00001 to 5 Pa·s

### Fluid Presets

Click a preset button to load typical fluid properties (only density and viscosity are updated):
- **Water**: Standard Newtonian fluid
- **Oil**: High viscosity
- **Air**: Low density
- **Honey**: Very high viscosity

### Visual Interpretation

- **Blue streaks**: Laminar flow (Re < 2300) - smooth, parallel trajectories
- **Yellow streaks**: Transitional flow (2300 ≤ Re ≤ 4000) - beginning of turbulence
- **Red streaks**: Turbulent flow (Re > 4000) - chaotic mixing and eddies
- **Brightness gradient**: Center (faster) → Wall (slower) velocity profile
- **Turbulent mixing**: Visible chaotic transverse displacements increase with Reynolds number

## 🔬 Scientific Background

The Reynolds number characterizes flow regime:

```
Re = (ρ × v × D) / μ
```

Where:
- **ρ** (rho) = Fluid density (kg/m³)
- **v** = Flow velocity (m/s)
- **D** = Characteristic diameter (m)
- **μ** (mu) = Dynamic viscosity (Pa·s)

### Flow Regimes

| Reynolds | Regime | Characteristics |
|----------|--------|-----------------|
| Re < 2300 | **Laminar** | Parallel trajectories, parabolic velocity profile |
| 2300 ≤ Re ≤ 4000 | **Transition** | Intermittent instabilities |
| Re > 4000 | **Turbulent** | Chaotic mixing, flat velocity profile, thin boundary layer |

## 📁 Project Structure

```
Reynold/
├── backend/
│   ├── main.py              # FastAPI server + WebSocket handler
│   ├── physics.py           # Reynolds calculations & flow analysis
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── index.html           # Main HTML page
│   ├── css/
│   │   └── styles.css       # Dark theme styles
│   └── js/
│       ├── app.js           # Application orchestration
│       ├── cfd2d.js         # 2D CFD renderer (Canvas)
│       ├── ui.js            # UI management
│       └── websocket.js     # WebSocket client
├── docs/
│   └── archive/             # Historical documentation
├── run.py                   # Launch script
└── README.md
```

## 🛠️ Technology Stack

| Component | Technology |
|-----------|------------|
| Backend | FastAPI + uvicorn |
| Frontend | HTML5, CSS3, JavaScript ES6+ |
| Visualization | HTML5 Canvas 2D |
| Communication | WebSocket (native) |
| Physics Engine | Custom CFD particle advection |

## 🎨 Visual Features

### Laminar Flow (Re < 2300)
- Smooth, parallel particle trajectories
- Parabolic velocity profile (Poiseuille)
- Blue color scheme
- Minimal mixing

### Transitional Flow (2300 ≤ Re ≤ 4000)
- Intermittent turbulent bursts
- Yellow color scheme
- Beginning of transverse mixing

### Turbulent Flow (Re > 4000)
- Chaotic particle trajectories
- Flat velocity profile at center
- Thin boundary layer near walls
- Red color scheme
- Intense mixing and eddy structures
- Smaller turbulent structures at higher Re

## 🐛 Troubleshooting

### Port Already in Use

If port 8000 is already in use:
```bash
# Kill the process using port 8000
lsof -ti:8000 | xargs kill -9

# Or change the port in run.py
```

### Dependencies Not Installing

```bash
# Upgrade pip first
python3 -m pip install --upgrade pip

# Then install requirements
pip install -r backend/requirements.txt
```

### Browser Not Opening Automatically

Manually navigate to `http://localhost:8000` after the server starts.

## 📚 References

- **Schlichting & Gersten** (2017) - *Boundary Layer Theory*
- **Pope** (2000) - *Turbulent Flows*
- **White** (2011) - *Fluid Mechanics*

## 📄 License

MIT License - Free to use and modify.

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## 📝 Notes

- The visualization uses a simplified 2D CFD model for real-time performance
- Flow profiles are based on classical correlations (Poiseuille, 1/7 power law)
- Turbulence intensity follows Prandtl-Kármán correlation: I ≈ 0.16 × Re^(-1/8)
