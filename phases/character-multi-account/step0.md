# Step 0: selection-storage

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- **`/docs/adr/ADR-143.md` 전문** — 이 task 전체의 모델·흐름 결정
- **`/docs/adr/ADR-144.md` 결정 2** — 캐릭터 카드 2줄(«[월드] 이름» / «레벨 + 직업»)이 이 step 이 만드는
  필드를 쓴다
- `/docs/persistence/preferences.md` (키 목록 — `trackedCharacters` · `representativeCharacter` ·
  `characterBasicCache:{ocid}` 항목)
- `/docs/ADR.md` 에서 **[[ADR-012]] · [[ADR-042]] · [[ADR-101]] · [[ADR-015]]** 만 열어라
- 코드: `packages/core/src/storage/character-selection.ts` · `packages/core/src/storage/keys.ts` ·
  `packages/core/src/storage/character-basic-cache.ts` · `packages/core/src/types/character.ts` ·
  `packages/core/src/nexon/character/normalize.ts` · 각 `__tests__/`

## 작업

**저장 레이어와 타입만 건드린다.** 화면·스토어·동기화는 다음 step 들이다.

### 1. 대표 캐릭터 키

`storage/keys.ts` 에 키 하나(`representativeCharacter`)를 더하고,
`storage/character-selection.ts` 에 셋을 추가한다.

```ts
export async function getRepresentativeCharacter(): Promise<string | null>
export async function setRepresentativeCharacter(ocid: string): Promise<void>
export async function clearRepresentativeCharacter(): Promise<void>
```

핵심 규칙([[ADR-143]] 결정 4):

- **파생값을 저장하지 않는다.** «미지정이면 목록의 첫 번째가 임시 대표» 는 **읽는 쪽의 규칙**이고,
  저장 레이어는 `null` 을 그대로 돌려준다. `getRepresentativeCharacter()` 가 목록을 보고 첫 번째를
  대신 돌려주면 안 된다.
- **참조 무결성은 쓰는 쪽이 지킨다** — 대표가 추적 목록에 없으면 키를 지운다. 그 판정을 하는 자리를
  이 파일에 함수로 둔다(예: 저장 시 목록과 대표를 함께 받는 헬퍼). 저장이 두 번에 나뉘어 한쪽만
  성공하는 순간을 만들지 마라.
- 기존 통합 마이그레이션(`migrateLegacyCharacterSelection`)의 락 패턴을 깨뜨리지 마라.

### 2. 캐릭터 카드가 쓸 필드 둘

`types/character.ts` 에 **옵셔널로** 더한다.

```ts
export interface CharacterPickerEntry {
  // ...기존 그대로
  jobClass?: string
}

export interface CharacterBasicProfile {
  // ...기존 그대로
  jobClass?: string
}
```

**값의 출처는 `character/list` 다**([[ADR-144]] 결정 2). `normalizeCharacterBasic` 이
`character_class` 를 읽게 만들지 **마라** — 그 응답이 직업을 준다는 것을 이 저장소는 실측한 적이 없고,
wire 타입(`types/nexon-wire.ts` 의 `NexonCharacterBasicResponse`)도 그 필드를 선언한 적이 없다.
캐시에 직업을 싣는 것은 **쓰는 쪽이 값을 넘기는 방식**이어야 한다:

```ts
// character-basic-cache.ts — 시그니처는 이 방향으로. 정확한 모양은 재량이되,
// jobClass 는 반드시 "호출부가 넘기는 값"이어야 한다.
export async function setCachedCharacterBasic(
  accountId: string,
  ocid: string,
  entry: CachedCharacterBasicEntry,
): Promise<void>
```

- **옛 캐시 엔트리에는 이 필드가 없다.** `undefined` 를 «모름» 으로 그대로 두어라([[ADR-101]] 결정 1) —
  빈 문자열이나 `'-'` 로 채우지 마라.
- 이 step 에서는 **필드를 만들고 저장·복원이 되는 것까지**만 한다. 실제로 값을 채우는 호출부는 step 1·3.

### 3. 테스트 먼저 (CLAUDE.md TDD)

- 대표: 없으면 `null` · 저장·삭제 왕복 · **목록에서 빠진 대표를 저장하면 키가 지워진다**
- `jobClass`: 있는 엔트리 왕복 · **없는(옛) 엔트리를 읽어도 던지지 않고 `undefined`**
- 기존 통합 마이그레이션 테스트가 그대로 통과

## Acceptance Criteria

```bash
npm test
npm run build
npm run lint
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `packages/core/src/storage/` 밖을 건드렸는가? (타입 파일 제외) 했다면 범위를 넘은 것이다
   - `features/` 에서 저장소를 직접 부르는 코드를 새로 만들지 않았는가 (CLAUDE.md CRITICAL)
   - `normalizeCharacterBasic` 을 고치지 않았는가
3. `phases/character-multi-account/index.json` 의 step 0 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "추가한 키·함수 시그니처·참조 무결성을 지키는 자리"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **`getRepresentativeCharacter()` 가 «첫 번째» 를 대신 돌려주게 하지 마라.** 이유: 그 규칙은 화면의
  것이고, 저장 레이어가 파생값을 만들면 «사용자가 고른 대표» 와 «앱이 계산한 대표» 두 진실이 생긴다.
- **`character/basic` 응답에서 직업을 읽지 마라.** 이유: 그 필드가 온다는 것을 확인한 적이 없다.
- **`packages/app-capacitor` 를 수정하지 마라.** 이유: 이 task 의 화면 변경은 RN 전용이고, 이 step 이
  더하는 것은 옵셔널 필드라 그 앱은 아무것도 달라지지 않아야 한다.
- 기존 테스트를 깨뜨리지 마라.
