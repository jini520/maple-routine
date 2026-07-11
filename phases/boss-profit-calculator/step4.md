# Step 4: boss-profit-screen

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/PRD.md`의 "4. 주간 보스 수익 계산기" 섹션 전체
- `/docs/UI_GUIDE.md` — 디자인 톤·색상 규칙(있는 범위 내에서 참고, 미확정 항목은 기존 화면 스타일을 따른다)
- `src/app/boss-scheduler/BossScreen.tsx` — 레이아웃/에러 처리/빈 상태 패턴의 기준. 단, **이 화면은 캐릭터 선택 드롭다운이 없다**(아래 "작업" 참고) — 그 부분만 다르게 만든다.
- `src/features/boss-profit/store.ts` (이전 step 산출물 — `BossProfitRow`, `useBossProfitStore` 시그니처)
- `src/components/BossPortrait/BossPortrait.tsx` — 재사용할 공용 컴포넌트
- `src/features/schedule-sync/format.ts` — `formatScheduleSyncError`/`formatSyncedAt` 재사용

## 작업

`src/app/boss-profit/BossProfitScreen.tsx`를 TDD로 작성하라(`src/app/boss-profit/__tests__/BossProfitScreen.test.tsx` 먼저 작성).

**이 화면은 `boss-scheduler`/`content-scheduler`와 달리 캐릭터를 한 명씩 전환해 보는 화면이 아니라, 추적 중인 모든 캐릭터의 처치 보스를 하나로 합산해 보여주는 화면이다**(PRD "캐릭터 범위" 확정 사항 — "합산해 수익 확인"). 따라서 `CharacterSelectDropdown`은 쓰지 않는다.

1. 마운트 시 `useBossProfitStore().loadTrackedOcids()`를 1회만 호출한다(다른 화면과 동일 패턴).
2. **빈 상태**: `trackedOcids`가 `null`이거나 `[]`이면 "추적 중인 캐릭터가 없습니다 — 보스 스케줄러에서 캐릭터를 선택해주세요" 안내만 표시한다. **이 화면 안에 "캐릭터 관리" 버튼이나 `CharacterTrackingPicker`를 두지 마라** — PRD 확정 사항("이 화면 전용의 별도 캐릭터 추적 UI는 두지 않는다"). 캐릭터 추적 설정은 보스 스케줄러 화면에서만 한다.
3. **로딩/에러**: `status`가 `'idle'`/`'loading'`이면 "불러오는 중...", `'error'`면 `formatScheduleSyncError(error)`를 표시한다(다른 화면과 동일 패턴).
4. **상단 새로고침 버튼**: `refresh(trackedOcids ?? [])`를 호출한다.
5. **stale 안내**: `staleCharacterNames.length > 0`이면 "일부 캐릭터 동기화 실패: {이름들} — 마지막 동기화 결과를 표시 중입니다" 같은 문구를 상단에 표시한다(ADR-008, 숨기지 않는다).
6. **본문**: `rows`를 `periodLabel`("이번 주"/"이번 달")로 그룹핑해 섹션 2개(있는 것만)로 렌더링한다.
   - 각 섹션 헤더 아래, 그 섹션에 속한 각 `row`를 카드/리스트 항목으로 표시: `BossPortrait`(row의 `boss` 이름으로 조회 — 매핑 안 되면 플레이스홀더로 자연히 폴백), `characterName · boss · difficulty` 텍스트, 파티원 수 입력(숫자 input, `min=1` `max={row.maxPartySize}`), 결과 표시:
     - `priceMeso === null`이면 "가격 미확정" 배지(수익 계산 불가, 파티원 수 입력 UI는 그래도 노출해도 되고 숨겨도 된다 — 어차피 저장되지 않으므로 어느 쪽이든 무방하되 사용자에게 "가격 미확정"임은 명확히 보여라).
     - `priceMeso !== null`이고 `partySize === null`이면 "파티원 수를 입력해주세요" 안내.
     - `payoutMeso !== null`이면 "{payoutMeso.toLocaleString()} 메소" 형태로 표시.
   - 파티원 수 입력이 바뀌면(예: `onBlur` 또는 폼 제출) `setPartySize(row, 값)`을 호출한다. 실패(검증 에러)는 흐름을 막지 않고 입력 필드 아래 짧은 에러 문구로 표시한다(throw를 그대로 두면 안 됨 — 컴포넌트에서 catch 하라).
   - 섹션 상단에 "이번 주 합계"/"이번 달 합계"로 그 섹션의 `payoutMeso` 합(`null`인 항목은 합계에서 제외)을 표시한다.
7. `rows`가 비어있으면(추적 캐릭터는 있지만 아직 처치한 보스가 없음) 섹션 없이 "아직 처치한 보스가 없습니다" 빈 상태를 표시한다(에러 아님, PRD 원칙).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (`app/boss-profit/`)
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가? (화면이 `storage/`·`nexon/`을 직접 호출하지 않고 스토어만 구독하는지)
   - PRD "이 화면 전용의 별도 캐릭터 추적 UI는 두지 않는다" 규칙을 지켰는가?
3. `useBossProfitStore`를 모킹한 컴포넌트 테스트로: 빈 상태(추적 캐릭터 없음), 정상 목록 렌더링(이번 주/이번 달 섹션 분리), 가격 미확정 배지, 파티원 수 입력 시 `setPartySize` 호출, stale 캐릭터 안내 노출을 각각 검증하라.
4. 결과에 따라 `phases/boss-profit-calculator/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 이 화면에 "캐릭터 관리" 버튼·`CharacterTrackingPicker`를 넣지 마라(PRD 확정 사항, 위 참고).
- `CharacterSelectDropdown`을 재사용하지 마라 — 이 화면은 캐릭터 단일 선택 뷰가 아니라 합산 뷰다.
- "이번 주 / 월간 추이" 탭이나 히스토리 차트를 만들지 마라 — 1차 구현 범위는 "이번 주"(및 이번 달) 표시까지다(PRD·ARCHITECTURE.md 확정 사항, 물욕 아이템 드랍 구현 이후 후속 작업).
- `App.tsx`나 기존 `boss-scheduler`/`content-scheduler` 화면을 수정하지 마라(라우팅 연결은 다음 step에서 한다).
- 기존 테스트를 깨뜨리지 마라.
