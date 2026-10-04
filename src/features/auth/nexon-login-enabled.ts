/**
 * 넥슨 로그인 진입점(로그인 화면의 넥슨 블록 · 더보기 맨 위 버튼)을 세우는가.
 *
 * 넥슨 프렌즈 프로그램의 프로덕션 승인 전에는 테스트 사용자만 로그인되어 `false` 로 둔다.
 * 승인이 나면 이 값만 `true` 로 바꾸는 OTA 로 켠다. 스킴 · `expo-web-browser` 는 바이너리에 이미 있다.
 */
export const NEXON_LOGIN_ENABLED = false
