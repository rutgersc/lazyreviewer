import { createRoot } from "@opentui/react";
import { createCliRenderer } from "@opentui/core";
import { ensureCredentialsFileSync } from "./config/credentials-config";
import { detectSchemeFromBackground, setColorScheme } from "./colors";
import App from "./App";

ensureCredentialsFileSync();

const renderer = await createCliRenderer({
  useMouse: true,
});

// Detect terminal color scheme via OSC 11 (background color query)
const palette = await renderer.getPalette({ timeout: 1000 });
setColorScheme(detectSchemeFromBackground(palette.defaultBackground));

createRoot(renderer).render(<App />);