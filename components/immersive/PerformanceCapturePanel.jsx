"use client";

import { useEffect, useRef, useState } from "react";
import { createPerformanceCapture } from "./PerformanceCapture.js";

export default function PerformanceCapturePanel({ stateRef, locale, onClose }) {
  const capture = useRef(null);
  const downloadResource = useRef(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const english = locale === "en";
  useEffect(() => {
    const session = createPerformanceCapture({
      view: window,
      readState: () => stateRef.current,
      onFinish(value) { setRunning(false); setReport(value); },
    });
    capture.current = session;
    return () => {
      session.dispose(); capture.current = null;
      const resource = downloadResource.current;
      if (resource) { clearTimeout(resource.timer); URL.revokeObjectURL(resource.url); downloadResource.current = null; }
    };
  }, [stateRef]);
  function start() {
    setError(""); setReport(null);
    if (capture.current?.start()) setRunning(true);
    else setError(english ? "Keep this page visible to start." : "Gardez cette page visible pour commencer.");
  }
  function cancel() { capture.current?.cancel(); setRunning(false); setReport(null); }
  function download() {
    if (!report) return;
    let url;
    try {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `vistaire-performance-${report.startedAt.replace(/[:.]/g, "-")}.json`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      // Keep the URL alive long enough for Safari to consume the download.
      const previous = downloadResource.current;
      if (previous) { clearTimeout(previous.timer); URL.revokeObjectURL(previous.url); }
      const resource = { url, timer: setTimeout(() => {
        URL.revokeObjectURL(resource.url);
        if (downloadResource.current === resource) downloadResource.current = null;
      }, 30_000) };
      downloadResource.current = resource;
      url = null;
      // The download is user-triggered and wholly local. No upload is made.
      setError("");
    } catch {
      setError(english ? "Download could not start. Try again." : "Le téléchargement n’a pas pu démarrer. Réessayez.");
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }
  return (
    <aside className="performance-capture" aria-label={english ? "Local performance capture" : "Mesure locale des performances"}>
      <div className="performance-capture-heading">
        <strong>{english ? "Local diagnostic" : "Diagnostic local"}</strong>
        <button type="button" onClick={onClose} aria-label={english ? "Close diagnostic" : "Fermer le diagnostic"}>×</button>
      </div>
      <p role="status">
        {running
          ? (english ? "Recording. Scroll normally for 20 seconds." : "Mesure en cours. Faites défiler normalement pendant 20 secondes.")
          : report
            ? (report.complete
              ? (english ? "Capture ready. Download the file to share it." : "Mesure prête. Téléchargez le fichier pour le partager.")
              : (english ? "Partial capture saved. The page was interrupted or recording stopped." : "Mesure partielle conservée : page interrompue ou arrêt de la mesure."))
            : (english ? "20 seconds, only after you start. Data stays on this device." : "20 secondes, uniquement à votre demande. Les données restent sur cet appareil.")}
      </p>
      <div className="performance-capture-actions">
        {running ? <>
          <button type="button" onClick={() => capture.current?.stop()}>{english ? "Stop" : "Arrêter"}</button>
          <button type="button" onClick={cancel}>{english ? "Cancel" : "Annuler"}</button>
        </> : <>
          <button type="button" onClick={start}>{english ? "Record 20 seconds" : "Mesurer 20 secondes"}</button>
          {report && <button type="button" onClick={download}>{english ? "Download JSON" : "Télécharger JSON"}</button>}
        </>}
      </div>
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
