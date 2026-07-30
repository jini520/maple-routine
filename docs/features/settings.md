# 설정 (Settings)

> **범위**: API 키 관리·계정(메이플 ID) 변경·연결 해제·테마 선택·스케줄 관리 방법(트래킹 모드)·데이터 관리·앱 업데이트·footer 표기. 다른 기능 설명에 흩어져 있던 요구사항을 통합 정리.
> **관련 소스**: `app/settings/` · `features/settings/`(`changeApiKey`) · `storage/api-key`(`clearAuthConfig`) · `storage/cache-data`(`clearCacheData`/`getCacheDataSizes`) · `features/onboarding`(`RESET`) · `features/tracking-mode`(`copy.ts`) · `AccountFlowStatus` · `SettingsRow` · `TrackingModeModal`/`TrackingModeSelector` · `ThemeSelector`/`ThemeSwatchDots` · `CacheDataSection`/`CacheClearConfirm`.
> **관련 ADR**: [[ADR-007]] [[ADR-008]] [[ADR-009]] [[ADR-004]] [[ADR-035]] [[ADR-026]] [[ADR-027]] [[ADR-050]] [[ADR-051]] [[ADR-052]] [[ADR-058]]. **관련 문서**: [onboarding.md](./onboarding.md), [theme.md](./theme.md), [live-update.md](./live-update.md), [../foundation/nexon-api.md](../foundation/nexon-api.md), [../persistence/lifecycle.md](../persistence/lifecycle.md).

## 정책
진입 경로는 **하단 탭바 4번째 탭**(별도 헤더 아이콘 아님, 확정 2026-07-12).

- **계정(메이플 ID) 변경**: API 키 재입력 없이, 저장된 키로 `character/list` 를 다시 호출해 계정 선택 UI(`AccountSelectionList` 재사용)를 다시 보여주고 선택된 `accountId` 만 갱신. **계정이 1개여도 선택 UI를 보여준다**([[ADR-051]]) — 온보딩과 설정 두 경로가 "계정 수와 무관하게 항상 선택 화면 경유, 사용자가 '계속하기'로 확정해야 저장·예열" 이라는 같은 규칙을 공유한다(상세 [onboarding.md](./onboarding.md)). 계정 관련 로컬 기록(보스 수익·드랍 히스토리)은 삭제하지 않음([[ADR-008]] 참조 무결성). 이전 계정 캐릭터 기록도 보존, 현재 계정 캐릭터만 노출.
- **연결 해제(로그아웃)**: `storage/api-key.ts` 의 `clearAuthConfig()` + `features/onboarding` 의 `RESET` 이벤트를 재사용해 온보딩 화면으로 복귀(신규 로직 없이 기존 두 조각 연결). 키 무효화 복구 경로도 이것(재온보딩).
- **데이터 관리(캐시 데이터 삭제)**: 지울 데이터를 **2그룹 중 선택**해서 지운다([[ADR-058]]) — "일반 데이터"(동기화 캐시·추적 목록·수동 추적 항목·공유 진행 원장·파티 설정)와 "보스 수익·드롭 기록"(복구 불가). 인증·사용자 설정 5개(`KEEP_KEYS`)는 어떤 선택에서도 보존되므로 이 기능으로 온보딩으로 돌아가지 않는다 — 연결 해제는 별도. 범위의 정확한 정의와 그룹 경계의 근거는 [../persistence/lifecycle.md](../persistence/lifecycle.md).
- **테마 선택**: 레테/렌/머쉬맘/혼테일 중 선택 → 즉시 반영. 상세 [theme.md](./theme.md).
- **스케줄 관리 방법(트래킹 모드)**: 자동/수동 전역 토글([[ADR-035]]). 상세는 아래 UI.
- **footer 표기**(확정 2026-07-13): 화면 맨 아래에 앱 버전(`package.json`)·카피라이트("© {연도} 메이플 루틴")·이용약관 제6조④ 요구 영문 문구 "Data based on NEXON Open API"(원문 그대로, 의역 금지). 앱 전역 footer는 만들지 않음.

## UI

### 설정 리스트 행 + 모달 — 2026-07-13
카드형 섹션 나열이 아니라 **하나의 리스트 컨테이너**(`rounded-[14px] bg-surface border border-border px-6`) 안에 행(`SettingsRow`)을 `divide-y divide-border` 로 이어붙임. 각 행 `py-4`, 왼쪽 라벨(`text-sm font-medium text-text`, 위험 동작은 `text-error`) + 오른쪽(기본 `ChevronRight text-text-muted`, `showChevron={false}` 가능), 행 전체가 버튼이라 탭하면 해당 모달. "계정 변경"·"스케줄 관리 방법"·"테마" 3개 행은 이 패턴, "연결 해제"만 확인 모달 직접 연다.
- **모달**: 공용 `components/Modal`([../foundation/design-system.md](../foundation/design-system.md)) — 계정 변경 모달·계정 선택 목록은 `card={false}` 로 자체 카드를 담음.
- **테마 대표 컬러 점(`ThemeSwatchDots`)**: 테마 `primary`/`secondary`/`error` 3토큰을 `h-4 w-4 rounded-full` 점으로 겹쳐(`-space-x-1`). 테마 행 오른쪽 배지(점 3개 + 현재 테마 이름)와 테마 모달 선택지에 재사용. `job-themes.json` 직접 import(비활성 테마 색도 미리보기해야 해 CSS 커스텀 프로퍼티로 부족).
- **캐시 데이터 삭제 행/모달(`CacheDataSection`/`CacheClearConfirm`)**: 행 라벨은 위험 동작이라 `text-error`, 오른쪽에 총 용량(`getCacheDataSizes()` 그룹별 값의 합). 모달은 체크박스 2행(`role="checkbox"`, 행 전체가 탭 영역) — 각 행에 그룹 이름·설명·그룹 용량, "보스 수익·드롭 기록" 행에는 복구 불가 경고. **보존 항목("유지됨") 줄은 두지 않는다**([[ADR-058]] 결정 9). **기본은 두 그룹 모두 체크**라 열고 바로 삭제하면 기존 전체 삭제와 같고, 전부 해제하면 삭제 버튼이 비활성이다([[ADR-058]] 결정 6). 삭제 중에는 두 버튼과 체크박스가 비활성(`isClearing`). 삭제 후 흐름은 선택과 무관하게 동일 — 타임아웃 경쟁 → 스플래시 → `closeBossProfitDb()` → 리로드([[ADR-050]], 결정 7). **실패·타임아웃이면 리로드 뒤에 토스트로 알린다**([[ADR-065]] 결정 3) — 리로드가 화면 신호를 파괴하므로 `storage/pending-notice`(sessionStorage)에 플래그를 남기고 부팅 후 "캐시를 일부만 삭제했습니다"를 띄운다. 리로드를 막거나 부분 삭제를 되돌리는 조치는 하지 않는다. Preferences가 아니라 sessionStorage인 이유는 "리로드는 넘기되 앱 종료와 함께 사라진다"가 이 알림의 수명이기 때문이다.
- **스케줄 관리 방법 행/모달(`TrackingModeModal`/`TrackingModeSelector`, [[ADR-035]] 결정 1)**: 자동/수동 전역 전환. 행 라벨·모달 제목 "스케줄 관리 방법"(2026-07-25 개편, 이전 "트래킹 모드" — 내부 컴포넌트/store 이름은 `TrackingMode*` 그대로). 오른쪽 배지에 현재 모드("자동"/"수동"). 옵션 목록은 `ThemeSelector` 와 동일 선택 카드 패턴(`aria-pressed`, 선택 시 `border-primary bg-primary-tint`). 옵션 문구는 온보딩 `TrackingModeStep` 과 공용 카피(`features/tracking-mode/copy.ts`) 공유. 수동 전환 시 `setMode` 가 시드([[ADR-035]] 결정 14(a)) 끝날 때까지 resolve 안 돼 그동안 옵션 비활성 + `MapleSpinner` "적용하고 있어요" + **오버레이 클릭 닫힘 금지**(저장 도중 못 닫음 원칙). 같은 모드 재선택은 즉시 닫힘.

## 후속 task (미구현)
- 크래시 리포팅 opt-in 토글([[ADR-008]], `lib/error-reporting` 미구현), 알림 권한 재요청 안내, 미예약 알림 개수 표시([[ADR-004]] 64개 한도 우선순위 정책 자체가 미구현).

## 열린 질문
- 설정 화면 섹션 순서/그룹핑(계정/알림/개인정보 등) 미논의.
- 계정 변경 시 실수 방지 확인 다이얼로그 넣을지 — [[ADR-051]] 이후 맥락이 달라졌다. 계정이 1개여도 선택 목록을 반드시 보고 "계속하기"로 확정하게 되어 확정 행위 자체가 이미 한 번 있으므로, 다이얼로그를 더한다면 "실수 방지"보다는 "기존 계정 데이터 영향 고지" 쪽 이유가 필요하다.

## 폐기된 정책 (history)
- ~~"API 키 재입력" 행/모달(`ApiKeyModal`)~~ → 제거(2026-07-25). 키 무효화 복구는 "연결 해제" 후 재온보딩. [[ADR-008]] 재입력 유도 배너는 미구현 보류(설정 store `changeApiKey` 로직은 되살릴 여지로 남겨 둠).
- ~~"트래킹 모드" 행/모달 제목~~ → "스케줄 관리 방법"으로 개명(2026-07-25, 내부 이름은 유지).
- ~~"데이터 관리"(캐시 삭제) 섹션이 "앱 업데이트" 아래~~ → 위로 올림(2026-07-25).
