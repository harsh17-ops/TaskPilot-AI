import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './style.css';

/**
 * Client Application Entry Point
 * Mounts the React application tree into the HTML DOM root element.
 */
const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
