import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { ToastProvider } from './components/ui.tsx';
import './styles/global.css';
import './styles/game.css';
import './styles/motion.css';

const container = document.getElementById('root');
if (!container) throw new Error('elemen #root tidak ditemukan');

createRoot(container).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
