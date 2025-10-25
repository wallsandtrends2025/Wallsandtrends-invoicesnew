import { BrowserRouter } from "react-router-dom";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { CurrencyService } from "./utils/CurrencyService";

// Initialize currency service with live rates on app startup
console.log('🚀 Initializing CurrencyService...');
CurrencyService.initialize().then(() => {
  console.log('✅ CurrencyService initialized successfully');
}).catch(error => {
  console.warn('⚠️ Failed to initialize live exchange rates:', error.message);
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
