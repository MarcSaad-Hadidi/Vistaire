import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles.css";
import "./pages/public-theme.css";
import { bindJourneyViewport } from "./JourneyViewport.js";

const PublicPages = lazy(() => import("./pages/PublicPageRouter.jsx"));
const pathname = location.pathname.replace(/\/+$/, "") || "/";
if (pathname === "/" || pathname === "/en") {
  const releaseViewport = bindJourneyViewport();
  if (import.meta.hot) import.meta.hot.dispose(releaseViewport);
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {pathname === "/" || pathname === "/en" ? (
      <div data-immersive-vistaire><App locale={pathname === "/en" ? "en" : "fr"} /></div>
    ) : (
      <Suspense
        fallback={
          <div className="preloader" role="status">
            Préparons votre expérience.
          </div>
        }
      >
        <PublicPages pathname={pathname} />
      </Suspense>
    )}
  </React.StrictMode>,
);
