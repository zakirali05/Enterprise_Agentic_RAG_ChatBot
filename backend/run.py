"""
Backend Server Runner
=====================
Launches Uvicorn server for the Enterprise Copilot FastAPI application.
Usage:
    python run.py
"""

import uvicorn
import os

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"Starting Enterprise Copilot Backend on http://{host}:{port}")
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
