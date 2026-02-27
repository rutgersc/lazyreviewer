import { createRoot } from "@opentui/react";
import { createCliRenderer } from "@opentui/core";
import { ensureEnvFileSync } from "./config/dotenv-config";
import App from "./App";

ensureEnvFileSync();

const renderer = await createCliRenderer({
  useMouse: true,
});
createRoot(renderer).render(<App />);