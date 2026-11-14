import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { I18nProvider } from "./i18n";
import "./styles.css";

/** The 3D style sample is opt-in and loaded on demand, so the game never pays for it. */
const PaperLab = lazy(() => import("./three/PaperLab"));
const showPaperLab =
  new URLSearchParams(location.search).get("lab") === "paper3d";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      {showPaperLab ? (
        <Suspense fallback={null}>
          <PaperLab />
        </Suspense>
      ) : (
        <App />
      )}
    </I18nProvider>
  </React.StrictMode>,
);
