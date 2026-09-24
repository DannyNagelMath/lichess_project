import chess
import json
import chess.svg
from pathlib import Path

output_path = Path(__file__).parent / "data" / "games.ndjson"

games = []
with open(output_path, encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line:
            games.append(json.loads(line))



moves = games[0]["moves"].split()      # SAN moves, one string per ply
analysis = games[0]["analysis"]         # same length (or shorter, if game ended early)
your_color = "White" if games[0]["players"]["white"]["user"]["id"] == "mugglesman1982" else "Black"
board = chess.Board()
flagged_positions = []

def render_posistion(fen, n):
    board = chess.Board(fen)
    svg_data = chess.svg.board(board, size=400)

    with open(f"position{n}.svg", "w") as f:
        f.write(svg_data)


for ply_idx, (san, ana) in enumerate(zip(moves, analysis)):
    if "judgment" in ana:
        color = "White" if ply_idx % 2 == 0 else "Black"
        if color == your_color:
            fen_before = board.fen()
            move_number = ply_idx // 2 + 1
            board.push_san(san)
            fen_after = board.fen()
            flagged_positions.append({
                "move_number": move_number,
                "color": color,
                "san": san,
                "judgment": ana["judgment"]["name"],
                "fen_before": fen_before,
                "fen_after": fen_after,
            })
        else:
            board.push_san(san)
    else:
        board.push_san(san)

for n, pos in enumerate(flagged_positions):
    temp_fen = pos["fen_before"]
    # render_posistion(temp_fen, n)


for pos in flagged_positions:
    print(pos["fen_before"])

