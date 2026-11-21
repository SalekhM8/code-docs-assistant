import { round } from "./util";

/** Adds two numbers. */
export function add(a: number, b: number): number {
  return a + b;
}

export const multiply = (a: number, b: number): number => a * b;

/** Keeps a running total. */
export class Calculator {
  private total = 0;

  /** Adds a value to the running total. */
  plus(value: number): this {
    this.total = add(this.total, value);
    return this;
  }

  /** Returns the total, rounded to two places. */
  result(): number {
    return round(this.total, 2);
  }
}
