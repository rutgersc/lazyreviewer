import { createRoot } from "@opentui/react";
import { createCliRenderer } from "@opentui/core";
import { ensureCredentialsFileSync } from "./config/credentials-config";
import { DarkColors, detectSchemeFromBackground, setColorScheme } from "./colors";
import App from "./App";

ensureCredentialsFileSync();

const renderer = await createCliRenderer({
  useMouse: true,
  // The debug console (z) defaults to 30% height and a 0.7-alpha background, which leaves the app
  // bleeding through the logs. Its own text colors are bright-on-dark, so it stays dark regardless
  // of the terminal scheme detected below.
  consoleOptions: {
    sizePercent: 60,
    backgroundColor: DarkColors.BACKGROUND,
    titleBarColor: DarkColors.TRACK,
  },
});

// Detect terminal color scheme via OSC 11 (background color query)
const palette = await renderer.getPalette({ timeout: 1000 });
setColorScheme(detectSchemeFromBackground(palette.defaultBackground));

createRoot(renderer).render(<App />);