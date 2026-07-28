# 온보딩 (Onboarding)

> **범위**: API 키 입력·계정(메이플 ID) 선택·전체 캐릭터 예열. 설정에서의 계정 변경/연결 해제는 [settings.md](./settings.md).
> **관련 소스**: `app/onboarding/` · `features/onboarding/` · `nexon/character` · `storage/api-key` · `storage/character-basic-cache` · `storage/scheduler-cache` · `AccountSelectionList` · `ApiKeyForm`.
> **관련 ADR**: [[ADR-007]] [[ADR-016]] [[ADR-015]] [[ADR-006]] [[ADR-053]]. **관련 문서**: [../foundation/nexon-api.md](../foundation/nexon-api.md), [../foundation/architecture.md](../foundation/architecture.md).

## 정책
- **키 입력**: `openapi.nexon.com` 링크 + 샘플 이미지 + 설명 문구로 가볍게 안내(앱 내 단계별 위저드 아님). 키는 `storage/` 보안 영역에 저장.
- **계정 선택**: 키 제출 즉시 `character/list` 호출(별도 검증 엔드포인트 없이 이 호출 자체가 키 검증). `account_list` 가 2개 이상이면 "어느 메이플 ID를 쓸지" 선택 화면. 선택은 이후 설정에서 변경 가능. `storage/` 에는 `apiKey` 와 선택 `accountId` 만 저장(캐릭터 목록은 캐싱 안 함).
- **예열([[ADR-016]])**: 계정 확정 즉시 온보딩을 끝내지 않고, 그 계정 **전체 캐릭터**(추적 대상 무관) 데이터를 진행률 바와 함께 미리 받는다 — 이후 스케줄러·피커 첫 진입 시 로딩 없이 뜨게 하기 위함. `OnboardingStatus` 에 `'prefetching'` 추가, 각 캐릭터에 `character/basic` → (`access_flag: true` 만) `scheduler/character-state` 순서의 독립 파이프라인을 병렬 실행하고 하나 끝날 때마다 즉시 캐시 기록 + 진행률 갱신. 개별 실패는 그 캐릭터만 캐시 없이 넘어가고 전체를 막지 않는다. 전체 완료 시 `'completed'`. 캐릭터 많은 계정은 수 초 걸릴 수 있음(사용자 수용).

## UI

### API 키 검증 중 — 폼 유지 + 버튼 스피너 (2026-07-16)
키 제출 시 화면을 이동시키지 않고 `ApiKeyForm` 을 그대로 유지한다(정상 경로 1초 미만이라 "확인 중" 문구가 깜빡이는 게 거슬림 → 문구 제거). `verifyingApiKey` 동안 `isSubmitting` 으로 유지, 입력값·위치 그대로, 제출 버튼 내용만 "확인"→스피너로 바꾸고 비활성화. 예열(prefetching)처럼 수 초 이상 걸리는 작업은 제외(진행률 바 표시).
```
버튼 스피너: h-5 w-5 rounded-full border-2 border-bg/30 border-t-bg animate-spin motion-reduce:animate-none
접근성: aria-busy, aria-label="확인 중", 스피너 aria-hidden
```

### 계정(메이플 ID) 선택 목록 — `AccountSelectionList`, 2026-07-16, [[ADR-006]]
각 계정 = [대표 캐릭터 얼굴 아바타 36px 원형] + 텍스트 2줄. 1줄 `[월드 엠블럼] {월드} · {이름} · Lv.{레벨}`, 2줄 `text-text-muted` `캐릭터 {N}개`. **직업 미표시**(이름이 길면 넘겨서 대신 월드를 첫 줄로). 월드 엠블럼 `src/assets/worlds/*`, `h-[18px] w-auto object-contain shrink-0`, 미매핑 월드는 텍스트만. 1줄 `truncate`, 텍스트 컬럼 `min-w-0`. 월드→엠블럼 매핑은 `world-emblems.json`(챌린저스1~4 모두 `challengers`). 컴포넌트는 온보딩 페이지형 레이아웃에 맞춰 자체 카드 없이 `w-full space-y-4` — 설정 계정 변경 모달이 이걸 카드로 감싸 재사용(모달 `card={false}`).

### 예열 진행률 바 — [[ADR-016]]
진행률 바 프리미티브([../foundation/design-system.md](../foundation/design-system.md)) 재사용 + "캐릭터 정보를 준비하고 있어요 (18/45)" `text-sm text-text-muted`. **세로 중앙 배치**(2026-07-16): 예열은 온보딩 유일의 수 초 대기 화면이라 상단 붙임보다 중앙이 대기 화면다움. 컨테이너 `min-h-[calc(100dvh-var(--sa-top)-var(--sa-bottom))]` + `flex items-center justify-center`(온보딩엔 하단 탭바 없어 `--sa-bottom` 까지 빼야 정중앙). 설정의 재인증 예열(`AccountFlowStatus`, 모달 안)은 대상 아님.

### 추적 캐릭터 선택 단계 — 후보 목록 로딩 ([[ADR-053]], 구현 완료 2026-07-29)
`ContentCharacterStep`([[ADR-035]] 결정 13)은 캐릭터 관리 피커와 같은 `getCharacterPickerRoster` 를 쓰므로 같은 정책을 따른다(원문은 [content-scheduler.md](./content-scheduler.md) "캐릭터 관리 피커 — 후보 목록 로딩"): **활성(`access_flag: true`)이 확인된 캐릭터만** 표시, 표시할 캐시가 없으면 **스피너 → 조회 완료 후 한 번에** 목록(캐시가 있으면 기존 [[ADR-016]] 즉시 표시 + 개별 patch 유지), 조회가 끝났는데 목록이 비면 **"활성 캐릭터 없음"과 "조회 실패"를 구분**해 안내한다.
- 이 단계는 예열([[ADR-016]]) 직후라 정상 경로에서는 캐시가 항상 따뜻하다 — 콜드 스타트 분기는 예열이 통째로 실패했을 때만 밟는다. 그래서 여기서는 특히 **"조회 실패"를 빈 상태로 위장하지 않는 것**이 중요하다(선택할 캐릭터가 없으면 CTA가 비활성이라 온보딩이 진행 불가 상태로 멈춘다).
- 모달이 아니라 페이지라 판정 분기는 `ContentCharacterStep` 안의 `RosterBody` 가 직접 그린다(피커와 동일한 우선순위·마크업). **실패 문구만 다르다** — 여기엔 "닫고 다시 열기"가 없으므로 "캐릭터 목록을 불러오지 못했어요 — 네트워크를 확인한 뒤 앱을 다시 실행해주세요". 빈 상태 문구("표시할 캐릭터가 없어요")는 피커와 같다.

## 열린 질문
- 캐릭터 관리 피커 개선([[ADR-015]]) 잔여: Nexon `character/look` 이미지 얼굴 크롭 쿼리 공식 지원 여부(미지원 시 CSS 근사), 개선을 다른 캐릭터 선택 UI로 확장할지.

## 폐기된 정책 (history)
- ~~키 제출 시 폼을 지우고 "캐릭터 목록을 확인하고 있어요..." 문구 표시~~ → 폼 유지 + 버튼 스피너로 변경(2026-07-16). 설정 계정 변경(`AccountFlowStatus` `verifying`)엔 문구가 남아 있으나 별도 단계 통일 예정.
- ~~선택 계정의 `character_list` 를 캐싱~~ → 캐싱 안 함, 매번 재조회(2026-07-11). 상세 [../foundation/architecture.md](../foundation/architecture.md).
- ~~계정 선택 목록에 직업 표기~~ → 직업 생략, 월드를 첫 줄로([[ADR-015]] 캐릭터 카드와 통일).
- ~~캐시가 없으면 `character/list` 응답으로 `access_flag` 미상 캐릭터까지 먼저 표시~~ → 활성 확인된 캐릭터만 표시, 콜드 스타트는 스피너([[ADR-053]], 2026-07-29).
