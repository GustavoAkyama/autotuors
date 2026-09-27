/**
 * Builds a script for `addInitScript` out of functions that run inside the page.
 *
 * Only their source goes to the page, so these functions can use browser globals,
 * their arguments and each other (by name, if listed in `helpers`), but nothing
 * else from their modules: no imports, no module constants. Declare helpers with
 * `function`, so they keep their names.
 */
export function pageScript<Arg>(
  entry: (arg: Arg) => void,
  helpers: ((...args: never[]) => unknown)[],
  arg: Arg,
) {
  return [
    "(() => {",
    ...helpers.map(String),
    `(${entry})(${JSON.stringify(arg)});`,
    "})();",
  ].join("\n");
}
