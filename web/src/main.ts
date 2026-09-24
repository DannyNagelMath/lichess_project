import { Chessground } from 'chessground';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

const boardElement = document.getElementById('board');
if (!boardElement) {
  throw new Error('index.html is missing <div id="board">');
}

Chessground(boardElement, {});