import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./theme.css";

const queryClient = new QueryClient();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("missing root element");
}

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <div className="app-root">
        <App />
      </div>
    </QueryClientProvider>
  </StrictMode>,
);

// Apply saved display preferences before first paint.
try {
  const brightness = Number(localStorage.getItem("dh-brightness"));
  if (Number.isFinite(brightness) && brightness >= 40 && brightness <= 100) {
    document.documentElement.style.setProperty("--app-brightness", String(brightness / 100));
  }
  if (localStorage.getItem("dh-smooth-scroll") === "off") {
    document.documentElement.style.scrollBehavior = "auto";
  }
} catch { /* best-effort */ }

// Register the service worker for installability and offline shell.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is best-effort */
    });
  });
}
