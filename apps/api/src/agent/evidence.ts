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
  /** Human-readable list of what was searched or opened, shown on a dead end. */
  readonly searched: string[] = [];

  add(range: LineRange): void {
    this.ranges.push(range);
  }

  noteSearch(label: string): void {
    if (!this.searched.includes(label)) this.searched.push(label);
  }

  get isEmpty(): boolean {
    return this.ranges.length === 0;
  }

  covers(c: LineRange): boolean {
    return this.ranges.some((r) => r.path === c.path && r.startLine <= c.endLine && c.startLine <= r.endLine);
  }
}
