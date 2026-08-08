import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { defineCustomElements as defineJeepSqliteElements } from 'jeep-sqlite/loader'
import './index.css'
import App from './App.tsx'
import { useLiveUpdateStore } from './features/live-update/store'

// notifyAppReady()는 여기서 부르지 않는다 — App 마운트 useEffect로 옮겼다(ADR-117 결정 2).
// 번들 첫 문장에서 부르면 "정상"이 렌더 한 픽셀 전에 선언돼, 그 뒤에 죽는 번들이 SUCCESS로
// 찍히고 영구히 박힌다(자동 롤백이 다시는 안 걸린다).
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
