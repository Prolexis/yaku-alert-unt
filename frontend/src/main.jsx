import React from "react";
import ReactDOM from "react-dom/client";
import "leaflet/dist/leaflet.css";
import App from "./App.jsx";
import YakuMobileApp from "./components/mobile/YakuMobileApp.jsx";
import { isMobileAppEntry } from "./services/api.js";
import "./index.css";

const RootComponent = isMobileAppEntry() ? YakuMobileApp : App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>
);
