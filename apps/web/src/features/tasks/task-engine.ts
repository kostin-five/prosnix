export type DifficultyLevel = 1 | 2 | 3;

export interface MathQuestion {
  expr: string;
  answer: number;
  options: number[];
}

function integer(random: () => number, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  return [...items].sort(() => random() - 0.5);
}

export function makeMathQuestion(
  level: DifficultyLevel,
  random: () => number = Math.random,
): MathQuestion {
  let expr: string;
  let answer: number;
  if (level === 1) {
    const left = integer(random, 8, 35);
    const right = integer(random, 5, 25);
    const subtract = random() < 0.45;
    answer = subtract ? left + right - right : left + right;
    expr = subtract ? `${left + right} − ${right}` : `${left} + ${right}`;
  } else if (level === 2) {
    const multiply = random() < 0.5;
    if (multiply) {
      const left = integer(random, 4, 14);
      const right = integer(random, 3, 12);
      answer = left * right;
      expr = `${left} × ${right}`;
    } else {
      const left = integer(random, 35, 90);
      const right = integer(random, 18, 65);
      answer = left + right;
      expr = `${left} + ${right}`;
    }
  } else {
    const left = integer(random, 6, 15);
    const right = integer(random, 3, 9);
    const tail = integer(random, 7, 28);
    answer = left * right + tail;
    expr = `${left} × ${right} + ${tail}`;
  }
  const offsets = shuffled([2, 3, 5, 7, 9, 11], random);
  const alternatives = new Set<number>();
  for (const offset of offsets) {
    alternatives.add(Math.max(0, answer + (random() < 0.5 ? -offset : offset)));
    if (alternatives.size === 2) break;
  }
  alternatives.delete(answer);
  while (alternatives.size < 2) alternatives.add(answer + alternatives.size + 1);
  return { expr, answer, options: shuffled([answer, ...alternatives].slice(0, 3), random) };
}

export function adaptDifficulty(
  level: DifficultyLevel,
  consecutiveCorrect: number,
  consecutiveWrong: number,
): DifficultyLevel {
  if (consecutiveCorrect >= 2) return Math.min(3, level + 1) as DifficultyLevel;
  if (consecutiveWrong >= 2) return Math.max(1, level - 1) as DifficultyLevel;
  return level;
}

export function memoryLength(level: DifficultyLevel): number {
  return level + 3;
}

export function makeMemorySequence(
  level: DifficultyLevel,
  random: () => number = Math.random,
): number[] {
  return Array.from({ length: memoryLength(level) }, () => integer(random, 0, 9));
}
