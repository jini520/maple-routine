/// <reference types="vite/client" />

/**
 * 빌드 시점에 주입되는 환경 변수.
 *
 * Vite 기본 `ImportMetaEnv` 는 인덱스 시그니처뿐이라, 이 값들을 객체로 넘기면 TS의 weak type
 * 검사에 걸린다(TS2559). 여기서 명시해두면 오타도 함께 잡힌다.
 */
interface ImportMetaEnv {
  /** OTA 채널. `'beta'` 면 베타 매니페스트를 보고, 테스트 광고도 함께 켠다([[ADR-024]], [[ADR-090]]). */
  readonly VITE_LIVE_UPDATE_CHANNEL?: string
  /** `'1'` 이면 Google 테스트 광고 단위를 쓴다 — `npm run build:test-ads` ([[ADR-090]]). */
  readonly VITE_ADS_TEST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
