import type { TourConfig } from "./src/config.ts";

// Settings shared by every tour. A script can override voice and music.
export default {
  locale: "pt-BR",
  colorScheme: "light",
  theme: {
    primary: "#2563eb",
    accent: "#60a5fa",
  },
  voice: { provider: "piper", model: "pt_BR-faber-medium" },
} satisfies TourConfig;
