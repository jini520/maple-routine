import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { defineCustomElements as defineJeepSqliteElements } from 'jeep-sqlite/loader'
import './index.css'
import App from './App.tsx'
import { notifyLiveUpdateReady } from './native/live-update'
import { useLiveUpdateStore } from './features/live-update/store'

// notifyAppReady는 네트워크 요청 이전, 번들 실행 직후 가장 먼저 호출해야 한다 —
// 타임아웃 안에 호출하지 않으면 플러그인이 직전 정상 번들로 자동 롤백한다(ADR-022).
void notifyLiveUpdateReady()
// 부팅 백그라운드 체크는 스토어를 경유해, 발견된 업데이트가 설정 화면 UI에 곧바로 반영된다(ADR-026).
void useLiveUpdateStore.getState().checkOnBoot()

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
