import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import posthog from "./lib/posthog";
import { getUserId } from "./lib/userId";

posthog.identify(getUserId());

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
