# Step 3: account-derivations

## 읽어야 할 파일

- `/docs/README.md`
- **`/docs/adr/ADR-144.md` 결정 2·6 전문** — 드롭다운 행이 무엇으로 서는지
- **`/docs/adr/ADR-143.md` 결정 5·10** — 계정을 «열 때» 판정하는 구조와 못 고르는 계정 넷
- `/docs/ADR.md` 에서 **[[ADR-068]] 결정 4 · [[ADR-113]] 결정 3 · [[ADR-127]] · [[ADR-101]] 결정 1** 만
- 코드: `packages/core/src/features/onboarding/representative-character.ts` ·
  `packages/core/src/nexon/character/normalize.ts` · `packages/core/src/lib/world-emblem.ts` ·
  `packages/core/src/storage/character-basic-cache.ts` · `packages/core/src/types/character.ts`
- **step 0·1 산출물**: `jobClass` 필드 · 다계정 해석 함수

## 배경

새 캐릭터 관리 화면은 **화면이 계산하면 안 되는 파생값**을 셋 쓴다. 순수 함수로 뽑아 두면 화면은
그리기만 하고, 테스트가 값 규칙을 직접 문다.

## 작업

`packages/core/src/features/character-manage/` (신규 모듈)에 **순수 함수만** 둔다. 저장소·네트워크를
직접 부르지 않는다(입력은 전부 인자로 받는다).

### 1. 계정 요약 — 드롭다운 한 행이 쓰는 값

```ts
export interface AccountSummaryView {
  accountId: string
  representative: MapleCharacter        // character/list 기준 최고 레벨(동레벨은 이름순)
  worldCounts: Array<{ world: string; count: number }>  // 많은 순, 최대 2개
  characterCount: number
}
export function summarizeAccount(account: MapleAccount): AccountSummaryView
```

핵심 규칙:

- **대표는 `character/list` 기준**이다([[ADR-144]] 결정 6). `pickRepresentativeCharacter` 를
  **재사용**하라 — 같은 규칙을 두 번 구현하지 마라.
- **월드는 많은 순 최대 둘**이고 **셋째부터는 적지 않는다**. «외 n» 같은 꼬리를 붙이지 마라
  (사용자가 명시적으로 거부한 표기다). 동수일 때의 순서는 이름순으로 **결정적**이어야 한다.
- 캐릭터가 0명인 계정은 애초에 오지 않는다([[ADR-127]] 이 `normalizeCharacterList` 에서 거른다) —
  그래도 방어적으로 던지지 말고 호출부가 걸러낼 수 있는 값을 돌려줘라.

### 2. 선택된 캐릭터 뷰 — 위 층이 네트워크 없이 그리는 값

```ts
export interface SelectedCharacterView {
  ocid: string
  name: string
  level: number | null
  jobClass?: string
  world?: string
  imageUrl: string | null
  unavailable: boolean
}
export function buildSelectedCharacterViews(
  orderedOcids: string[],
  cached: Map<string, CachedCharacterBasicEntry | null>,
  unavailableOcids: ReadonlySet<string>,
): SelectedCharacterView[]
```

- **순서는 `orderedOcids` 그대로**다([[ADR-143]] 결정 3). 레벨로 다시 정렬하지 마라.
- 캐시가 없으면 **모르는 것을 지어내지 않는다** — `level: null`, `jobClass: undefined`,
  `imageUrl: null`. 화면이 그 자리를 비운다([[ADR-101]] 결정 1).
- 조회 불가 캐릭터도 **목록에 남는다**([[ADR-068]] 결정 4 — 해제 경로).

### 3. 대표 캐릭터 판정

```ts
export function resolveRepresentative(orderedOcids: string[], stored: string | null): string | null
```

- 저장값이 목록에 있으면 그것, 없으면 `null`.
- **«첫 번째를 임시 대표로» 를 여기서 만들지 마라**([[ADR-144]] 결정 4 — 화면이 아무 표시도 하지
  않기로 했다). 이 함수는 **저장된 대표가 유효한가**만 답한다.
- 저장 직전 정리(목록에서 빠진 대표를 지운다)는 step 0 의 저장 헬퍼가 한다 — 여기서 또 하지 마라.

### 4. 테스트 먼저

- 월드 집계: 3개 월드 → 상위 2개만 · 동수 → 이름순 · 단일 월드 → 하나만
- 대표: 최고 레벨 · 동레벨은 이름순 (`pickRepresentativeCharacter` 와 결과가 같은지 대조)
- 선택 뷰: 순서 보존 · 캐시 없는 ocid 는 `null`/`undefined` · 조회 불가도 남는다
- `resolveRepresentative`: 목록에 없는 저장값 → `null`

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
   - 이 모듈이 **저장소·네트워크를 직접 부르지 않는가**(전부 인자로 받는가)
   - `pickRepresentativeCharacter` 를 재구현하지 않고 재사용했는가
   - 화면 코드를 건드리지 않았는가
3. `phases/character-multi-account/index.json` 의 step 3 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "새 모듈 경로·세 함수 시그니처·월드 집계 규칙"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **«외 n개» 같은 꼬리 문구를 만들지 마라.** 이유: 사용자가 «지시하지 않은 텍스트를 붙이지 말 것» 을
  명시했고, 이 줄이 하는 일은 총계가 아니라 알아보기다.
- **모르는 값을 기본값으로 채우지 마라**(`level: 0`, `jobClass: ''`). 이유: 화면이 «모름» 과 «0» 을
  구분해 그려야 한다.
- **네트워크 조회를 여기서 하지 마라.** 이유: 순수 함수 모듈이어야 테스트가 값 규칙만 문다.
- 기존 테스트를 깨뜨리지 마라.
