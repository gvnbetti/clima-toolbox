"""Shared settings for the validation scripts. Override with environment variables."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                                   # validation/
EPLUS = os.environ.get("EPLUS", "energyplus")                  # EnergyPlus 25.2.0 executable
EP_VERSION = "25.2"                                            # version line written into every model
WORK = os.environ.get("WORK", os.path.join(ROOT, "_work"))     # scratch: models, hourly outputs (not kept in git)
WX = os.path.join(ROOT, "weather", "files")                    # weather files, written by weather/fetch.py and weather/app_epw.js
os.makedirs(WORK, exist_ok=True)
