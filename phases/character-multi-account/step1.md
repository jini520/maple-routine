# Step 1: multi-account-sync

## 읽어야 할 파일

- `/docs/README.md`
- **`/docs/adr/ADR-143.md` 결정 6·7 전문** — 이 step 의 근거
- `/docs/features/content-scheduler.md` 「캐릭터 관리 피커」·「후보 자격」 절
- `/docs/persistence/preferences.md` — `accountSharedProgress:{accountId}` 항목(**이 step 이 그 뜻을
  바꾼다**)
- `/docs/ADR.md` 에서 **[[ADR-030]] · [[ADR-008]] · [[ADR-086]] 결정 6·9 · [[ADR-097]] 결정 7 ·
  [[ADR-113]] 결정 1** 만 열어라
- 코드: `packages/core/src/features/schedule-sync/schedule-sync.ts` ·
  `packages/core/src/features/schedule-sync/character-roster.ts` ·
  `packages/core/src/features/schedule-sync/character-basic-fetch.ts` ·
  `packages/core/src/storage/shared-progress-cache.ts` · 각 `__tests__/`
- **step 0 산출물**: `types/character.ts` 의 `jobClass` · `storage/character-basic-cache.ts`

## 배경 — 지금 코드는 다계정에서 조용히 깨진다

`syncSchedules(ocids)` 는 `resolveRegisteredCharacters()` 로 **선택 계정 하나의 캐릭터 목록**을 받아
`ocids` 로 거른다. 추적 목록이 계정을 넘으면 **다른 계정 캐릭터가 그 필터에서 빠져** 스케줄이 영원히
안 돈다. 그리고 계정 공유 진행도 원장(`accountSharedProgress:{accountId}`)을 «지금 고른 계정» 키로
읽고 쓰므로, 다계정에서는 **에픽 던전 같은 계정 공유 완료가 계정을 넘어 번진다.**

## 작업

### 1. 캐릭터를 «자기 계정과 함께» 해석한다

`character-roster.ts` 에 전 계정을 훑는 해석 함수를 더한다. 이름·모양은 재량이되 다음을 만족해야 한다:

```ts
// 예시 시그니처 — ocid → 그 캐릭터 + 그 캐릭터가 사는 accountId
export async function resolveTrackedCharacterContext(ocids: string[]): Promise<{
  apiKey: string
  characters: Array<{ character: MapleCharacter; accountId: string }>
}>
```

- `fetchCharacterList` 응답의 **모든 계정**을 훑는다. `selectedAccountId` 로 거르지 않는다.
- 응답에 없는 ocid 는 결과에서 빠진다(지금 동작과 같다 — 캐릭터 삭제·이전 경로).
- **기존 `resolveRegisteredCharacters(accountIdOverride?)` 는 그대로 둔다.** 피커 로스터가 그것을
  «계정 하나» 로 계속 쓴다([[ADR-086]] 결정 6 의 계약).

### 2. `syncSchedules` 가 캐릭터마다 자기 계정을 쓴다

- `syncOneCharacter(apiKey, character, accountId)` 의 `accountId` 가 **그 캐릭터의 계정**이어야 한다
  (지금은 전원이 같은 값을 받는다). 원장 읽기(`getAccountSharedProgress`)와 쓰기
  (`setAccountSharedProgressEntry`) 둘 다 해당한다.
- `refreshCharacterBasics` 도 같다 — 캐시 인덱스가 계정별이므로([[ADR-086]] 결정 9) 틀린 계정으로
  쓰면 다른 계정 인덱스가 오염된다.
- **[[ADR-008]] 의 프리플라이트 순서를 바꾸지 마라** — 첫 캐릭터 1명 → 전역 실패 판정 → 나머지 병렬,
  그리고 `refreshCharacterBasics` 는 그 병렬 구간과 **같은 `Promise.all`** 안에 남는다
  ([[ADR-097]] 결정 7).

### 3. `jobClass` 를 캐시에 싣는다

`character/list` 의 `MapleCharacter.jobClass` 를 `character-basic-cache` 엔트리에 함께 저장한다
(step 0 이 필드를 열어 뒀다). 저장 경로는 `fetchCharacterBasicCached` 하나뿐이므로([[ADR-113]] 결정 1)
그 함수가 값을 받을 수 있어야 한다 — 시그니처 변경은 재량이되 **네 호출부가 전부 그 경로를 통과한다는
성질을 깨지 마라.**

- 값을 모르는 호출부(직업을 손에 들고 있지 않은 자리)는 **넘기지 않는다.** 그때는 기존 값을 유지한다 —
  아는 값을 `undefined` 로 덮어쓰면 화면에서 직업이 사라진다.

### 4. 테스트 먼저

- **두 계정의 ocid 를 섞어 추적하면 둘 다 동기화된다**(지금 코드에서는 한쪽이 빠진다 — 이 테스트가
  먼저 빨개져야 한다)
- 계정 공유 원장이 **각 캐릭터의 자기 계정 키**로 읽히고 쓰인다
- **단일 계정 입력에서 호출 수·결과가 지금과 같다**(Capacitor 회귀 가드 — 이것이 이 step 의 안전망이다)
- `jobClass` 가 캐시에 실린다 · 안 넘긴 호출은 기존 값을 지우지 않는다

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - **단일 계정 회귀 테스트가 있는가** — 이 step 은 두 앱 모두에 나가는 유일한 변경이다
   - `features/` 가 저장소를 어댑터로만 만지는가 (CLAUDE.md CRITICAL)
   - `resolveRegisteredCharacters` 의 기존 계약을 깨지 않았는가
3. `phases/character-multi-account/index.json` 의 step 1 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "새 해석 함수 이름·syncSchedules 가 계정을 받는 방식·jobClass 저장 경로·단일 계정 회귀 가드 위치"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **`selectedAccountId` 를 새로 읽는 코드를 만들지 마라.** 이유: 이 task 는 그 값을 RN 에서 죽이는
  방향이다([[ADR-143]] 결정 7). 기존 호출부는 그대로 두되 새로 늘리지 않는다.
- **동시성 캡·재시도 같은 «개선» 을 끼워 넣지 마라.** 이유: [[ADR-116]] 에서 사용자가 명시적으로
  미룬 항목이고, 이 step 의 실패 원인을 흐린다.
- **`app-capacitor`·화면 코드를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.
