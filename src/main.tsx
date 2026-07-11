import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { defineCustomElements as defineJeepSqliteElements } from 'jeep-sqlite/loader'
import './index.css'
import App from './App.tsx'

// jeep-sqlite는 웹 플랫폼에서 @capacitor-community/sqlite의 IndexedDB 기반 폴리필로 쓰인다 (ADR-003).
if (Capacitor.getPlatform() === 'web') {
  defineJeepSqliteElements(window)
  document.body.appendChild(document.createElement('jeep-sqlite'))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
