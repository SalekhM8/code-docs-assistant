export interface LineRange {
  path: string;
  startLine: number;
  endLine: number;
}

/**
 * Everything the model was shown in one answer run: chunk ranges from searches and the
 * ranges it read. The citation checker accepts only citations that overlap this evidence.
 */
export class Evidence {
  private readonly ranges: LineRange[] = [];
  /** Ranges cited, and checked, in earlier answers of this conversation that the model can still see. */
  private readonly prior: LineRange[] = [];
  /** Human-readable list of what was searched or opened, shown on a dead end. */
  readonly searched: string[] = [];

  add(range: LineRange): void {
    this.ranges.push(range);
  }

  /** Lets a follow-up repeat a citation from an earlier turn without retrieving the code again. */
  addPrior(range: LineRange): void {
    this.prior.push(range);
  }

  /** Every file path seen in this run or cited earlier, for resolving shortened paths. */
  paths(): string[] {
    return [...new Set([...this.ranges, ...this.prior].map((r) => r.path))];
  }

  noteSearch(label: string): void {
    if (!this.searched.includes(label)) this.searched.push(label);
  }

  get isEmpty(): boolean {
    return this.ranges.length === 0;
  }

  covers(c: LineRange): boolean {
    return [...this.ranges, ...this.prior].some((r) => r.path === c.path && r.startLine <= c.endLine && c.startLine <= r.endLine);
  }
}
