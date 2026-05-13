/**
 * Parameterized Sudoku puzzle generator.
 *
 * Supports:
 * - 6x6 (2x3 boxes, digits 1-6)
 * - 9x9 (3x3 boxes, digits 1-9)
 * - 16x16 (4x4 boxes, values 1-16 displayed as hex 1-G)
 */

export type CellValue = number | null;
export type Board = CellValue[][];

export interface SudokuConfig {
  size: number; // 6, 9, or 16
  boxRows: number; // rows per box
  boxCols: number; // cols per box
  symbols: string[]; // display symbols for values 1..size
  defaultClues: number; // default number of clues
}

export const CONFIGS: Record<number, SudokuConfig> = {
  6: {
    size: 6,
    boxRows: 2,
    boxCols: 3,
    symbols: ["1", "2", "3", "4", "5", "6"],
    defaultClues: 14,
  },
  9: {
    size: 9,
    boxRows: 3,
    boxCols: 3,
    symbols: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
    defaultClues: 30,
  },
  16: {
    size: 16,
    boxRows: 4,
    boxCols: 4,
    symbols: [
      "1", "2", "3", "4", "5", "6", "7", "8",
      "9", "A", "B", "C", "D", "E", "F", "G",
    ],
    defaultClues: 110,
  },
};

/** Create a blank grid */
function emptyGrid(size: number): Board {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

/** Check if placing `num` at (row, col) is valid */
function isValid(
  board: Board,
  row: number,
  col: number,
  num: number,
  config: SudokuConfig
): boolean {
  const { size, boxRows, boxCols } = config;

  // Check row
  for (let c = 0; c < size; c++) {
    if (board[row][c] === num) return false;
  }

  // Check column
  for (let r = 0; r < size; r++) {
    if (board[r][col] === num) return false;
  }

  // Check box
  const boxRowStart = Math.floor(row / boxRows) * boxRows;
  const boxColStart = Math.floor(col / boxCols) * boxCols;
  for (let r = boxRowStart; r < boxRowStart + boxRows; r++) {
    for (let c = boxColStart; c < boxColStart + boxCols; c++) {
      if (board[r][c] === num) return false;
    }
  }

  return true;
}

/** Shuffle array in place (Fisher-Yates) */
function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Fill the grid using backtracking with randomized candidates */
function fillGrid(board: Board, config: SudokuConfig, rng: () => number = Math.random): boolean {
  const { size } = config;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row][col] === null) {
        const candidates = shuffle(
          Array.from({ length: size }, (_, i) => i + 1),
          rng
        );
        for (const num of candidates) {
          if (isValid(board, row, col, num, config)) {
            board[row][col] = num;
            if (fillGrid(board, config, rng)) return true;
            board[row][col] = null;
          }
        }
        return false;
      }
    }
  }
  return true;
}

/**
 * Count solutions (up to limit) for uniqueness checking.
 * For 16x16 we limit depth to keep generation fast.
 */
function countSolutions(
  board: Board,
  config: SudokuConfig,
  limit: number = 2
): number {
  const { size } = config;
  let count = 0;

  function solve(): boolean {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (board[row][col] === null) {
          for (let num = 1; num <= size; num++) {
            if (isValid(board, row, col, num, config)) {
              board[row][col] = num;
              if (solve()) {
                // found
              }
              board[row][col] = null;
            }
          }
          return false;
        }
      }
    }
    count++;
    return count >= limit;
  }

  solve();
  return count;
}

/** Deep copy a board */
function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

/**
 * Generate a Sudoku puzzle of the given size.
 *
 * @param size - 6, 9, or 16
 * @param clues - Optional override for number of given cells
 * @param rng - Optional seeded RNG for deterministic generation
 */
export function generatePuzzle(
  size: number = 9,
  clues?: number,
  rng: () => number = Math.random
): {
  puzzle: Board;
  solution: Board;
  config: SudokuConfig;
} {
  const config = CONFIGS[size];
  if (!config) throw new Error(`Unsupported size: ${size}`);

  const targetClues = clues ?? config.defaultClues;

  // Generate complete grid
  const solution = emptyGrid(size);
  fillGrid(solution, config, rng);

  // Remove cells while maintaining unique solution
  const puzzle = cloneBoard(solution);
  const totalCells = size * size;
  const positions = shuffle(
    Array.from({ length: totalCells }, (_, i) => [
      Math.floor(i / size),
      i % size,
    ] as [number, number]),
    rng
  );

  let removed = 0;
  const target = totalCells - targetClues;

  // For 16x16, skip uniqueness check (too slow) — use symmetric removal instead
  if (size === 16) {
    for (const [row, col] of positions) {
      if (removed >= target) break;
      if (puzzle[row][col] !== null) {
        puzzle[row][col] = null;
        removed++;
      }
    }
  } else {
    for (const [row, col] of positions) {
      if (removed >= target) break;

      const backup = puzzle[row][col];
      puzzle[row][col] = null;

      const testBoard = cloneBoard(puzzle);
      if (countSolutions(testBoard, config, 2) === 1) {
        removed++;
      } else {
        puzzle[row][col] = backup;
      }
    }
  }

  return { puzzle, solution, config };
}

/**
 * Solve a puzzle (find its unique solution).
 * Returns the solved board, or null if unsolvable.
 */
export function solvePuzzle(puzzle: Board, size: number): Board | null {
  const config = CONFIGS[size];
  if (!config) return null;

  const board = cloneBoard(puzzle);

  function solve(): boolean {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (board[row][col] === null) {
          for (let num = 1; num <= size; num++) {
            if (isValid(board, row, col, num, config)) {
              board[row][col] = num;
              if (solve()) return true;
              board[row][col] = null;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  return solve() ? board : null;
}

/** Check if the board is completely filled */
export function isBoardComplete(board: Board): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (cell === null) return false;
    }
  }
  return true;
}

/** Get all cells that don't match the solution */
export function getErrors(board: Board, solution: Board): [number, number][] {
  const errors: [number, number][] = [];
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const val = board[row][col];
      if (val !== null && val !== solution[row][col]) {
        errors.push([row, col]);
      }
    }
  }
  return errors;
}

/**
 * Encode a board state as a compact string for URL sharing.
 * Each cell is encoded as a single char: '0' for empty, or the symbol index + 1.
 */
export function encodeBoard(board: Board): string {
  const chars: string[] = [];
  for (const row of board) {
    for (const cell of row) {
      if (cell === null) {
        chars.push("0");
      } else {
        // For size<=9: use digit. For size 16: use hex-like
        chars.push(cell.toString(36));
      }
    }
  }
  return chars.join("");
}

/** Decode a board from encoded string */
export function decodeBoard(encoded: string, size: number): Board | null {
  if (encoded.length !== size * size) return null;
  const board: Board = [];
  for (let r = 0; r < size; r++) {
    const row: CellValue[] = [];
    for (let c = 0; c < size; c++) {
      const ch = encoded[r * size + c];
      if (ch === "0") {
        row.push(null);
      } else {
        const val = parseInt(ch, 36);
        if (isNaN(val) || val < 1 || val > size) return null;
        row.push(val);
      }
    }
    board.push(row);
  }
  return board;
}
