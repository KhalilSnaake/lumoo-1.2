import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initCore } from "@lumoo/core";
import "./index.css";
import App from "./App";

initCore({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  authRedirectUrl: window.location.origin,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
