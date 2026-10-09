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

// Register the service worker for installability and offline shell.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is best-effort */
    });
  });
}
