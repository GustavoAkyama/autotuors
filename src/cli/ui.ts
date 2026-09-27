import { parseArgs } from "node:util";
import { missingRequirements } from "../requirements.ts";
import { startServer } from "../server/index.ts";

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "4321" },
    "no-open": { type: "boolean", default: false },
  },
});

for (const problem of missingRequirements())
  console.warn(`Atenção: ${problem}`);

startServer({ port: Number(values.port), open: !values["no-open"] });
