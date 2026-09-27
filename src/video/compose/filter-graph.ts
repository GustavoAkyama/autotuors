/** Inputs and filters of an ffmpeg command, built up piece by piece. */
export class FilterGraph {
  readonly inputs: string[] = [];
  readonly filters: string[] = [];
  private count = 0;

  /** Adds an input (its ffmpeg arguments) and returns its index. */
  input(...args: string[]) {
    this.inputs.push(...args);
    return this.count++;
  }

  add(...filters: string[]) {
    this.filters.push(...filters);
  }
}
