import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { initializeThemePreference } from "./themeService.js";
import "./styles.css";

initializeThemePreference();

class StartupErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main role="alert" style={{ minHeight: "100dvh", display: "grid", placeContent: "center", justifyItems: "center", gap: 12, padding: 24, color: "#183b2a", background: "#f6f8f5", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      <strong style={{ fontSize: 22 }}>O Fortalfy demorou para abrir</strong>
      <span style={{ maxWidth: 320, lineHeight: 1.5 }}>Confira sua conexão e tente carregar a página novamente.</span>
      <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 44, marginTop: 8, padding: "0 20px", border: 0, borderRadius: 12, color: "white", background: "#24784b", font: "inherit", fontWeight: 700 }}>Tentar novamente</button>
    </main>;
  }
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`).catch(error => {
      console.error("Não foi possível registrar o modo offline do Fortalfy.", error);
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <StartupErrorBoundary><App /></StartupErrorBoundary>
    </HashRouter>
  </React.StrictMode>,
);
