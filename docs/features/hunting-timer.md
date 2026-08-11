# 사냥 타이머 (Hunting Timer)

> **범위**: 30분 카운트다운 + 주기 사운드 상시 알림. 네이티브 상시 알림/Live Activity 구현.
> **관련 소스**: `app/hunting-timer/` · `features/hunting-timer/` · `native/hunting-timer`(커스텀 플러그인 Android/iOS + `.web.ts` 폴백).
> **관련 ADR**: [[ADR-005]] [[ADR-008]]. **관련 문서**: [../foundation/architecture.md](../foundation/architecture.md), [../foundation/error-resilience.md](../foundation/error-resilience.md).

## 정책
- 30분 카운트다운 타이머(1소재 단위). 진행 중 지정 주기(기본 1분/2분)마다 알림음 반복 재생해 솔 야누스 재설치 타이밍 알림. 5자석펫 등 더 긴 주기용으로 사용자가 분 단위 주기 직접 입력 가능.
- **앱 백그라운드/종료 상태에서도 동작**해야 함. 네이티브 타이머 앱처럼 알림창에 경과 시간이 항시 표시되는 상시 알림 형태([[ADR-005]]).
- **한 번에 하나의 타이머만** 실행(여러 캐릭터 동시 사냥 미지원).
- 알림음은 **기본 제공 사운드만**(사용자 업로드/커스텀 선택 없음).

## 네이티브 구현 ([[ADR-005]])
Capacitor 공식 플러그인이 커버 못 해 Swift/Kotlin 커스텀 플러그인을 직접 작성해 `native/hunting-timer` 로 노출.
- **Android**: Foreground Service + `Notification.Builder.setUsesChronometer(true)`(OS가 경과 시간 자동 갱신). 동일 서비스에서 주기 타이머로 알림음 재생.
- **iOS**: Live Activity(ActivityKit, iOS 16.1+)로 잠금화면/Dynamic Island에 경과 시간. 사운드는 Live Activity와 별도로 로컬 알림/백그라운드 오디오 세션으로 트리거. **iOS 16.1 미만은 폴백**(로컬 알림 + 사운드만).
- 타이머 정지 시 상시 알림/Live Activity 종료 및 예약 해제.

## 흐름
타이머 시작 → `features/hunting-timer` 가 주기(N분)를 `native/hunting-timer` 에 전달 → (Android) Foreground Service + Chronometer 알림 + 주기 사운드 / (iOS) Live Activity + 로컬 알림 사운드 → 정지 시 종료.

## 에러/엣지
- OS 알림 권한 거부 또는 Foreground Service/Live Activity 시작 실패 시, 상시 알림 UI 없이도 최소한 주기 사운드는 로컬 알림으로 폴백([[ADR-008]]).
- 앱 강제 종료 시 타이머 초기화 경고 표시. 재실행하면 진행 상태를 이어가지 않고 정지 상태로 시작.

## 구현 현황
- 아직 인터페이스만 정의됨. 실제 Android Foreground Service / iOS Live Activity 구현은 별도 task. 현재 web 폴백(`hunting-timer.web.ts`)은 메모리 변수라 새로고침하면 사라지며, 어떤 feature 도 아직 이 플러그인을 소비하지 않는다.
- **실기기에서는 폴백조차 안 쓰인다 — 세 메서드가 거부된다**(2026-08-11 확인). `registerPlugin('HuntingTimer', { web })` 에 등록된 것이 `web` 하나뿐이라 android·ios 는 구현을 못 찾고, 네이티브 플러그인도 없어 `PluginHeaders` 에도 없다 → `CapacitorException(UNIMPLEMENTED)` 이 **거부된 Promise** 로 나온다. 인메모리 폴백은 브라우저(`platform === 'web'`) 전용이다. RN 전환 어댑터(`packages/app-rn/.../rn-hunting-timer.ts`)도 같은 이유로 거부한다 — 폴백을 옮기면 웹 전용 동작을 네이티브로 승격시키는 것이고, `start()` 가 조용히 resolve 하면 화면은 타이머가 도는 줄 아는데 알림도 소리도 없다.
- 정식 구현 전 기술 스파이크(PoC)로 두 플랫폼 실현 가능성과 배터리 영향 검증 필요.
