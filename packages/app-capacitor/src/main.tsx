import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { defineCustomElements as defineJeepSqliteElements } from 'jeep-sqlite/loader'
import './index.css'
import App from './App.tsx'
import { useLiveUpdateStore } from '@core/features/live-update/store'
import { setPreferencesPort, setSqlitePort } from '@core/storage/ports'
import { capacitorPreferencesPort } from './storage/adapters/capacitor-preferences'
import { capacitorSqlitePort } from './storage/adapters/capacitor-sqlite'
import { installCapacitorNativePorts } from './native/adapters'

// 저장소·네이티브 포트 주입은 **그것을 건드리는 어떤 코드보다 먼저** 와야 한다([[ADR-128]]) — 바로
// 아래 checkOnBoot()부터 Preferences를 읽고 라이브 업데이트를 확인한다(그 실패 경로는 스플래시까지
// 건드린다, [[ADR-117]]). 주입 전 접근은 조용히 넘어가지 않고 던지므로, 순서가 틀리면 무음 실패가
// 아니라 에러로 드러난다.
setPreferencesPort(capacitorPreferencesPort)
setSqlitePort(capacitorSqlitePort)
installCapacitorNativePorts()

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
