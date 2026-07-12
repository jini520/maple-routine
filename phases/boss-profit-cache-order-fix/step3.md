# Step 3: boss-scheduler-order-fix

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 ADR-017 "결정 2"와 "결정 3" 전체 — 특히 "실제로 보고된 증상은 보스 스케줄러뿐이지만 컨텐츠 스케줄러도 동일한 코드 패턴이라 같은 버그가 아직 드러나지 않았을 뿐일 수 있어, 두 화면 모두에 선제 적용한다" 부분(이 step은 실제 증상이 보고된 화면을 고친다)
- `/docs/ARCHITECTURE.md`의 "`CharacterSelectDropdown` 캐릭터 순서·초기 선택 (신규, 2026-07-12, [[ADR-017]])" 문단
- **`phases/boss-profit-cache-order-fix/step2.md`와 그 산출물** — `src/features/content-scheduler/store.ts`, `src/app/content-scheduler/ContentScreen.tsx`. 이번 step은 그 step에서 적용한 것과 **완전히 동일한 패턴**을 `boss-scheduler`에 적용하는 것이다. 반드시 이 두 파일의 최종 diff를 먼저 읽고, 같은 구조(state 필드명, 헬퍼 함수 형태, 액션 이름)를 `boss-scheduler`에도 그대로 반복하라 — 임의로 다른 이름이나 다른 구조를 쓰지 마라(두 화면의 코드 패턴이 어긋나는 것 자체가 ADR-017이 고치는 원래 버그의 원인이었다).
- `src/features/boss-scheduler/store.ts` (이번 step에서 수정할 파일)
- `src/app/boss-scheduler/BossScreen.tsx` (이번 step에서 함께 수정할 파일)
- `src/storage/character-basic-cache.ts`, `src/storage/character-selection.ts`
- `src/features/onboarding/representative-character.ts` (`compareByName`)
- `src/features/boss-scheduler/__tests__/store.test.ts`, `src/app/boss-scheduler/__tests__/BossScreen.test.tsx`

## 작업

`step2.md`에서 `content-scheduler`에 적용한 것과 동일한 변경을 `boss-scheduler`에 적용하라. 유일한 차이는 저장소 kind가 `'content'`가 아니라 `'boss'`라는 것, 그리고 `BossCharacterView`가 `dailyContents`/`weeklyContents` 대신 `weeklyBosses`/`monthlyBosses`/`weeklyBossClearCount`/`weeklyBossClearLimitCount`를 갖는다는 것뿐이다 — 정렬 로직은 `characterName`/`ocid`만 보므로 이 차이와 무관하다.

### (a) `features/boss-scheduler/store.ts`

- `BossSchedulerState`에 `selectedOcid: string | null` 추가.
- `BossSchedulerStore`에 `selectCharacter(ocid: string): Promise<void>` 액션 추가 — `setLastSelectedCharacter('boss', ocid)` 호출(kind가 `'boss'`인 것만 다르고 step 2와 동일).
- `loadTrackedOcids()`에서 `getLastSelectedCharacter('boss')`로 `selectedOcid` 초기값 시딩.
- `refresh(ocids)` 안의 캐시 단계(`cachedCharacters`)와 실시간 단계(`characters`) 양쪽에 레벨 내림차순 정렬 헬퍼(`sortByCachedLevel` — step 2와 동일한 이름·시그니처로, 이 파일 안에 지역 함수로 다시 작성. `content-scheduler/store.ts`에서 import하지 마라 — 두 스토어는 서로 다른 뷰 타입을 다루는 별개 모듈이다)를 적용.

### (b) `app/boss-scheduler/BossScreen.tsx`

- 로컬 `selectedOcid` `useState` 제거, store의 `selectedOcid`/`selectCharacter` 사용.
- `effectiveSelectedOcid` 계산 로직은 유지, store 값 참조로 교체.
- `CharacterSelectDropdown`의 `onSelect`를 store의 `selectCharacter`로 교체.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `storage/` 호출이 `features/boss-scheduler/store.ts` 안에만 있고 `BossScreen.tsx`에는 없는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. `src/features/boss-scheduler/__tests__/store.test.ts`에 step 2와 동일한 성격의 케이스를 추가하라:
   - 레벨 내림차순 정렬(동레벨은 `compareByName`), 레벨 캐시 없는 캐릭터는 맨 뒤
   - `loadTrackedOcids()`가 `getLastSelectedCharacter('boss')` 값으로 `selectedOcid`를 초기화
   - `selectCharacter(ocid)`가 상태 갱신 + `setLastSelectedCharacter('boss', ocid)` 호출
4. `src/app/boss-scheduler/__tests__/BossScreen.test.tsx`의 관련 테스트를 store `selectCharacter` mock 기준으로 갱신하라.
5. 결과에 따라 `phases/boss-profit-cache-order-fix/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `storage/character-basic-cache`나 `storage/character-selection`을 `BossScreen.tsx`에서 직접 import하지 마라.
- `content-scheduler/store.ts`의 `sortByCachedLevel`을 boss-scheduler에서 import해서 재사용하려 하지 마라 — 서로 다른 뷰 타입을 다루므로 이 파일 안에 동일한 패턴으로 다시 작성한다(코드 몇 줄 아끼자고 두 feature 모듈 사이에 의존을 만들지 마라).
- `src/app/content-scheduler/ContentScreen.tsx`·`src/features/content-scheduler/store.ts`를 다시 건드리지 마라(step 2에서 이미 완료됨).
- 탭 전환(주간/월간) 시 선택된 캐릭터가 유지되는 기존 동작, `n/12` 배지 표시 로직을 깨뜨리지 마라.
- 기존 테스트를 깨뜨리지 마라(단, `selectedOcid` 관련 기존 화면 테스트는 store mock 기준으로 자연스럽게 갱신).
