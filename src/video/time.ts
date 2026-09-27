export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Wall-clock time in seconds, the unit of screencast frames. */
export const now = () => Date.now() / 1000;
