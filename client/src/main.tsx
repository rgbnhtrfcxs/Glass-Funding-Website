import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "mapbox-gl/dist/mapbox-gl.css";

const rootElement = document.getElementById("root")!;

createRoot(rootElement).render(<App />);

window.requestAnimationFrame(() => {
  document.body.classList.add("is-page-loaded");
});
