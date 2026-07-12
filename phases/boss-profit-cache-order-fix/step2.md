# Step 2: content-scheduler-order-fix

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 ADR-017 "결정 2"와 "결정 3" 전체 (캐릭터 순서 통일, 마지막 선택 캐릭터 캐시)
- `/docs/ARCHITECTURE.md`의 "`CharacterSelectDropdown` 캐릭터 순서·초기 선택 (신규, 2026-07-12, [[ADR-017]])" 문단
- `/CLAUDE.md`의 CRITICAL 규칙("features/* 코드에서 로컬 저장소·네이티브 API에 직접 접근하지 말 것 — storage/·native/ 어댑터 레이어를 거칠 것") — 이번 step은 이 규칙을 지키기 위해 **정렬·마지막 선택 캐릭터 로직을 화면이 아니라 `features/content-scheduler/store.ts`에 넣는다** (기존 `app/*.tsx` 어디에도 `storage/`를 직접 import하는 곳이 없다 — 이 관례를 그대로 따른다)
- `src/features/content-scheduler/store.ts` (이번 step에서 수정할 파일 — `refresh()`가 캐시 단계(`cachedCharacters`)와 실시간 단계(`characters`) 두 곳에서 `ContentCharacterView[]`를 만드는 구조를 정확히 파악하라)
- `src/app/content-scheduler/ContentScreen.tsx` (이번 step에서 함께 수정할 파일 — 현재 `selectedOcid`를 화면 로컬 `useState`로 갖고 `effectiveSelectedOcid`를 계산하는 부분)
- `src/storage/character-basic-cache.ts` (`getCachedCharacterBasic(ocid): Promise<CachedCharacterBasicEntry | null>`, `entry.profile.level: number` — 이미 존재하는 함수)
- `src/storage/character-selection.ts` (이전 step 산출물 — `getLastSelectedCharacter`/`setLastSelectedCharacter`)
- `src/features/onboarding/representative-character.ts` (`compareByName(a: string, b: string): number` — 이미 존재하는 함수, 새로 만들지 말고 import해서 재사용)
- `src/features/content-scheduler/__tests__/store.test.ts`, `src/app/content-scheduler/__tests__/ContentScreen.test.tsx` (기존 테스트 스타일)

## 작업

### (a) `features/content-scheduler/store.ts`

`ContentSchedulerState`에 `selectedOcid: string | null`을 추가하고, `ContentSchedulerStore`에 `selectCharacter(ocid: string): Promise<void>` 액션을 추가하라:

```ts
async selectCharacter(ocid) {
  set({ selectedOcid: ocid })
  await setLastSelectedCharacter('content', ocid)
}
```

`loadTrackedOcids()`에서 `getTrackedCharacterOcids('content')`와 함께 `getLastSelectedCharacter('content')`도 호출해 `selectedOcid` 초기값으로 `set`하라(두 호출은 서로 의존하지 않으므로 병렬로 처리해도 된다). 이 값의 유효성(현재 캐릭터 목록에 실제로 존재하는지) 검사는 이번 step에서는 store가 하지 않는다 — 화면 쪽 `effectiveSelectedOcid` 계산이 기존처럼 그 역할을 한다(아래 (b) 참고).

`refresh(ocids)` 안에서 `ContentCharacterView[]`를 만드는 두 지점(캐시 단계의 `cachedCharacters`, 실시간 단계의 `characters`) **둘 다에** 레벨 내림차순 정렬을 적용하라. 파일 안에 다음과 같은 지역 헬퍼를 하나 추가해 두 곳에서 재사용해라(export하지 않는다 — 이 파일 안에서만 쓴다):

```ts
async function sortByCachedLevel(views: ContentCharacterView[]): Promise<ContentCharacterView[]>
```

- 각 `view.ocid`로 `getCachedCharacterBasic`을 병렬 조회해 `level`을 얻는다(캐시에 없으면 `level: null`로 취급).
- 정렬 규칙: 레벨 내림차순, 동레벨이면 `compareByName(a.characterName, b.characterName)`. `level`이 `null`인 캐릭터는 항상 목록 맨 뒤로 보낸다(둘 다 `null`이면 `compareByName`으로 2차 정렬).
- `characterName`/`ocid` 등 기존 필드는 그대로 두고 배열 순서만 바꾼다.

`set({ status: 'loading', characters: cachedCharacters })`와 최종 `set({ status: 'loaded', characters, error: null })` 호출 전에 각각 `await sortByCachedLevel(...)`을 거친 배열을 넘겨라.

### (b) `app/content-scheduler/ContentScreen.tsx`

- 로컬 `const [selectedOcid, setSelectedOcid] = useState<string | null>(null)`를 제거하고, `useContentSchedulerStore()`에서 `selectedOcid`·`selectCharacter`를 함께 구조분해하라.
- 기존 `effectiveSelectedOcid` 계산(`selectedOcid`가 `null`이 아니고 현재 `characters`에 존재하면 그 값, 아니면 `characters[0]?.ocid`로 폴백)은 store의 `selectedOcid`/`characters`를 그대로 참조하도록 바꾸되 계산 로직 자체는 유지한다.
- `CharacterSelectDropdown`의 `onSelect` prop에 넘기던 `setSelectedOcid`를 store의 `selectCharacter`로 교체한다(`selectCharacter`는 `Promise`를 반환하지만 `onSelect`가 동기 함수를 기대하면 `void selectCharacter(ocid)` 형태로 호출해도 된다 — 기존 `onSelect: (ocid: string) => void` 시그니처를 바꾸지 않는다).
- `characters`는 이미 store에서 정렬되어 오므로 화면에서 추가로 정렬하지 않는다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `storage/`(character-basic-cache, character-selection) 호출이 `features/content-scheduler/store.ts` 안에만 있고 `ContentScreen.tsx`에는 없는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. `src/features/content-scheduler/__tests__/store.test.ts`에 케이스를 추가해 다음을 검증하라(`getCachedCharacterBasic`/`getLastSelectedCharacter`/`setLastSelectedCharacter`를 `vi.mock`):
   - 레벨이 낮은 캐릭터가 실시간 응답에서 먼저 와도, `characters`가 레벨 내림차순으로 정렬되어 있는지(동레벨은 `compareByName` 순)
   - 레벨 캐시가 없는 캐릭터가 목록 맨 뒤에 오는지
   - `loadTrackedOcids()` 호출 시 `getLastSelectedCharacter('content')`가 반환한 값으로 `selectedOcid`가 초기화되는지
   - `selectCharacter(ocid)` 호출 시 `selectedOcid` 상태가 갱신되고 `setLastSelectedCharacter('content', ocid)`가 호출되는지
4. `src/app/content-scheduler/__tests__/ContentScreen.test.tsx`에서 기존 "드롭다운으로 캐릭터를 바꾼다"류 테스트를 store의 `selectCharacter` mock 호출 검증으로 갱신하라(기존에 `setSelectedOcid`를 직접 검증하던 테스트가 있다면 그 방식이 아니라 `selectCharacter` mock이 호출됐는지로 바꾼다).
5. 결과에 따라 `phases/boss-profit-cache-order-fix/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `storage/character-basic-cache`나 `storage/character-selection`을 `ContentScreen.tsx`(또는 다른 `app/*.tsx`)에서 직접 import하지 마라 — 반드시 `features/content-scheduler/store.ts`를 거쳐야 한다.
- `compareByName`을 새로 만들지 마라 — `features/onboarding/representative-character.ts`에서 import해서 재사용한다.
- `CharacterSelectDropdown` 컴포넌트 자체(props 시그니처, 내부 렌더링)를 수정하지 마라.
- `src/app/boss-scheduler/BossScreen.tsx`·`src/features/boss-scheduler/store.ts`를 수정하지 마라(다음 step에서 동일한 패턴을 별도로 적용한다).
- 탭 전환 시 선택된 캐릭터가 유지되는 기존 동작을 깨뜨리지 마라.
- 기존 테스트를 깨뜨리지 마라(단, store의 `selectedOcid` 도입으로 인해 화면의 `selectedOcid` 관련 기존 테스트 표현은 store mock 기준으로 자연스럽게 갱신해야 한다).
