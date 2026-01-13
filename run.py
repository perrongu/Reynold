#!/usr/bin/env python3
"""
Reynolds Flow Demo - Launch Script
Starts the FastAPI server and opens the browser automatically.
"""

import importlib
import subprocess
import sys
import time
import webbrowser
from pathlib import Path


def check_dependencies():
    """Check if required dependencies are installed."""
    return all(importlib.util.find_spec(name) is not None for name in ("fastapi", "uvicorn"))


def install_dependencies():
    """Install dependencies if needed."""
    requirements_path = Path(__file__).parent / "backend" / "requirements.txt"
    if not requirements_path.exists():
        print("Error: requirements.txt not found")
        sys.exit(1)
    
    print("Installing dependencies...")
    try:
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-r", str(requirements_path), "-q"
        ])
        print("Dependencies installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"Error installing dependencies: {e}")
        sys.exit(1)


def main():
    # Check and install dependencies
    if not check_dependencies():
        install_dependencies()
    
    # Import after installation (runtime import to avoid static analyzer warnings)
    uvicorn = importlib.import_module("uvicorn")
    
    # Configuration
    host = "127.0.0.1"
    port = 8000
    url = f"http://{host}:{port}"
    
    # Add backend directory to path
    backend_path = Path(__file__).parent / "backend"
    sys.path.insert(0, str(backend_path))
    
    print("\n" + "=" * 60)
    print("  Reynolds Flow Demo")
    print("  Interactive Reynolds Number Visualization")
    print("=" * 60)
    print(f"\nStarting server on {url}")
    print("Press Ctrl+C to stop\n")
    
    # Open browser after a short delay
    def open_browser():
        time.sleep(1.5)
        try:
            webbrowser.open(url)
        except Exception:
            pass  # Silently fail if browser can't be opened
    
    import threading
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Start server
    try:
        uvicorn.run(
            "main:app",
            host=host,
            port=port,
            reload=False,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n\nServer stopped")
    except Exception as e:
        print(f"\nError starting server: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
