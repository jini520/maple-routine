import { installFakePreferences } from '@core/storage/__tests__/fake-preferences'
import { installNoopNativePorts } from '@core/native/__tests__/fake-native-ports'

// 저장소 포트의 테스트 기본값([[ADR-128]]). 포트 역전 전에는 `@capacitor/preferences` 모듈이 어느
// 테스트에서나 그냥 import돼 동작했다 — 그 자리를 인메모리 포트가 대신한다. 이것이 없으면 앱을
// 렌더하기만 하는 테스트(부팅 시 drop-effect 복원 등)가 "포트 미주입" 에러를 던진다.
// 저장 동작 자체를 검증하는 테스트는 자기 beforeEach에서 다시 설치해 격리된 store를 받는다.
// setupFiles는 테스트 파일마다 한 번 도므로 파일 간에는 이미 격리된다.
installFakePreferences()

// 네이티브 포트도 같은 이유로 기본값을 깐다 — 옛 어댑터들이 테스트 환경(플랫폼 `web`)에서 no-op
// 이었던 그 동작을 그대로 재현한다.
installNoopNativePorts()
