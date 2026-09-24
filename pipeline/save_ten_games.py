"""Fetch specific Lichess games by ID (with computer analysis) and save them as NDJSON."""
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).parent

# Read variables from pipeline/.env into the environment, then get the token.
load_dotenv(SCRIPT_DIR / ".env")
token = os.getenv("LICHESS_TOKEN")
if not token:
    raise SystemExit("LICHESS_TOKEN not found. Check that pipeline/.env exists and defines it.")

output_path = SCRIPT_DIR / "data" / "games.ndjson"
output_path.parent.mkdir(exist_ok=True)

game_ids = "oLSivxSu,LYQcNgMD,ni6NmWt6,voTAREjy,CIcEstSb,izzrW3mR,1GVzRaJa,Gh4xf3rK,uBjrzQwY,ZXlxQXne"
url = "https://lichess.org/api/games/export/_ids"
headers = {
    "Accept": "application/x-ndjson",
    "Content-Type": "text/plain",
    "Authorization": f"Bearer {token}",
}
params = {
    "evals": "true",   # include computer analysis (eval, best move, judgment)
    "clocks": "true",  # optional: include clock times per move
}

response = requests.post(url, headers=headers, params=params, data=game_ids, timeout=30)
response.raise_for_status()

with open(output_path, "w", encoding="utf-8") as f:
    f.write(response.text)

print(f"Saved {len(response.text.splitlines())} games to {output_path}")