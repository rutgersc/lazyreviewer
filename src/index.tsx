import { createRoot } from "@opentui/react";
import { createCliRenderer } from "@opentui/core";
import App from "./App";

const renderer = await createCliRenderer({
  useMouse: true,
});
createRoot(renderer).render(<App />);