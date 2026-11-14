import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { initAntiqueVellumTextures } from './styles/vellumTexture.ts';
import './styles/parchment.css';

initAntiqueVellumTextures();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
