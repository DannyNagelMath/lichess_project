import { Chessground } from 'chessground';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import { loadMistakes } from './mistakes';

const boardElement = document.getElementById('board');
if (!boardElement) {
  throw new Error('index.html is missing <div id="board">');
}

Chessground(boardElement, {});

const mistakes = await loadMistakes();
console.log('Loaded mistakes:', mistakes);