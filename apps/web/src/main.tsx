import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import './styles/globals.css';
import { AppProviders } from './app/providers';
import { AppRouter } from './app/router';

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </React.StrictMode>,
  );
}
