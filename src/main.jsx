import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from "./i18n/LanguageContext";

// Register PWA Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("SW registered:", reg.scope))
      .catch((err) => console.warn("SW registration failed:", err));
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LanguageProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: { fontSize: "14px" },
        }}
        containerStyle={{
          zIndex: 999999, // ✅ ensures it shows above everything
        }}
      />
      <App />
    </LanguageProvider>
  </StrictMode>
);
