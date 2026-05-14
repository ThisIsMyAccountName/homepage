export type CellState = "empty" | "filled" | "marked";
export type Grid = CellState[][];
export type Solution = boolean[][];

export interface NonogramPuzzle {
  solution: Solution;
  rowClues: number[][];
  colClues: number[][];
  rows: number;
  cols: number;
}

function generateSolution(
  rows: number,
  cols: number,
  rng: () => number
): Solution {
  for (let attempt = 0; attempt < 50; attempt++) {
    const fillRate = 0.4 + rng() * 0.15;
    const solution: Solution = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => rng() < fillRate)
    );
    const rowsOk = solution.every(
      (row) => row.some(Boolean) && !row.every(Boolean)
    );
    const colsOk = Array.from({ length: cols }, (_, c) =>
      solution.map((r) => r[c])
    ).every((col) => col.some(Boolean) && !col.every(Boolean));
    if (rowsOk && colsOk) return solution;
  }
  // Fallback: checkerboard pattern
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => (r + c) % 3 !== 0)
  );
}

export function computeClues(line: boolean[]): number[] {
  const clues: number[] = [];
  let count = 0;
  for (const cell of line) {
    if (cell) {
      count++;
    } else if (count > 0) {
      clues.push(count);
      count = 0;
    }
  }
  if (count > 0) clues.push(count);
  return clues.length > 0 ? clues : [0];
}

export function computeRowClues(solution: Solution): number[][] {
  return solution.map((row) => computeClues(row));
}

export function computeColClues(solution: Solution): number[][] {
  const cols = solution[0].length;
  return Array.from({ length: cols }, (_, c) =>
    computeClues(solution.map((r) => r[c]))
  );
}

export function generatePuzzle(
  rows: number,
  cols: number,
  rng: () => number = Math.random
): NonogramPuzzle {
  const solution = generateSolution(rows, cols, rng);
  return {
    solution,
    rowClues: computeRowClues(solution),
    colClues: computeColClues(solution),
    rows,
    cols,
  };
}

export function emptyGrid(rows: number, cols: number): Grid {
  return Array.from({ length: rows }, () =>
    Array<CellState>(cols).fill("empty")
  );
}

export function isLineSatisfied(
  userLine: CellState[],
  clue: number[]
): boolean {
  const groups: number[] = [];
  let count = 0;
  for (const cell of userLine) {
    if (cell === "filled") {
      count++;
    } else if (count > 0) {
      groups.push(count);
      count = 0;
    }
  }
  if (count > 0) groups.push(count);
  const actual = groups.length > 0 ? groups : [0];
  return JSON.stringify(actual) === JSON.stringify(clue);
}

export function isComplete(grid: Grid, solution: Solution): boolean {
  for (let r = 0; r < solution.length; r++) {
    for (let c = 0; c < solution[r].length; c++) {
      if ((grid[r][c] === "filled") !== solution[r][c]) return false;
    }
  }
  return true;
}

/** Returns only cells the player wrongly filled (filled but should be empty). */
export function getErrors(grid: Grid, solution: Solution): [number, number][] {
  const errors: [number, number][] = [];
  for (let r = 0; r < solution.length; r++) {
    for (let c = 0; c < solution[r].length; c++) {
      if (grid[r][c] === "filled" && !solution[r][c]) {
        errors.push([r, c]);
      }
    }
  }
  return errors;
}

export function encodeSolution(solution: Solution): string {
  const bits = solution
    .flat()
    .map((b) => (b ? "1" : "0"))
    .join("");
  const padded = bits.padEnd(Math.ceil(bits.length / 4) * 4, "0");
  let hex = "";
  for (let i = 0; i < padded.length; i += 4) {
    hex += parseInt(padded.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

export function decodeSolution(
  str: string,
  rows: number,
  cols: number
): Solution | null {
  try {
    const totalBits = rows * cols;
    let bits = "";
    for (const ch of str) {
      bits += parseInt(ch, 16).toString(2).padStart(4, "0");
    }
    if (bits.length < totalBits) return null;
    const solution: Solution = [];
    for (let r = 0; r < rows; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < cols; c++) {
        row.push(bits[r * cols + c] === "1");
      }
      solution.push(row);
    }
    return solution;
  } catch {
    return null;
  }
}

/** Each cell encoded as '0'=empty, '1'=filled, '2'=marked */
export function encodeGrid(grid: Grid): string {
  return grid
    .flat()
    .map((cell) => (cell === "filled" ? "1" : cell === "marked" ? "2" : "0"))
    .join("");
}

export function decodeGrid(
  str: string,
  rows: number,
  cols: number
): Grid | null {
  if (str.length !== rows * cols) return null;
  try {
    const grid: Grid = [];
    for (let r = 0; r < rows; r++) {
      const row: CellState[] = [];
      for (let c = 0; c < cols; c++) {
        const ch = str[r * cols + c];
        row.push(ch === "1" ? "filled" : ch === "2" ? "marked" : "empty");
      }
      grid.push(row);
    }
    return grid;
  } catch {
    return null;
  }
}
