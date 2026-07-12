import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { defineCustomElements as defineJeepSqliteElements } from 'jeep-sqlite/loader'
import './index.css'
import App from './App.tsx'

// jeep-sqlite는 웹 플랫폼에서 @capacitor-community/sqlite의 IndexedDB 기반 폴리필로 쓰인다 (ADR-003).
// autoSave가 기본값(false)이면 쓰기가 메모리에만 남고 새로고침 시 유실되므로 반드시 켠다.
if (Capacitor.getPlatform() === 'web') {
  defineJeepSqliteElements(window)
  const jeepSqliteEl = document.createElement('jeep-sqlite')
  jeepSqliteEl.setAttribute('autoSave', 'true')
  document.body.appendChild(jeepSqliteEl)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
