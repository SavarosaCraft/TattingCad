import React from 'react';
import ReactDOM from 'react-dom/client';
import TattingDesigner from './tattingindex.tsx';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Session 63 (review #6): a crash shows a "Save a copy / Restart /
        Close" screen instead of a blank window. */}
    <AppErrorBoundary>
      <TattingDesigner />
    </AppErrorBoundary>
  </React.StrictMode>
);
