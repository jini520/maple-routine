# Step 0: last-selected-character-storage

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 ADR-017 "결정 3" 전체 (화면별 "마지막 선택 캐릭터" 캐시 도입 — 초기 캐릭터 뒤바뀜 버그 수정)
- `/docs/ARCHITECTURE.md`의 데이터 흐름 섹션 중 "`CharacterSelectDropdown` 캐릭터 순서·초기 선택 (신규, 2026-07-12, [[ADR-017]])" 문단
- `src/storage/character-selection.ts` (이번 step에서 확장할 파일 — 기존 `getTrackedCharacterOcids`/`setTrackedCharacterOcids`/`clearTrackedCharacterOcids`가 `SchedulerKind`(`'content' | 'boss'`)를 받는 패턴을 그대로 따른다)
- `src/storage/keys.ts` (키 빌더를 추가할 파일 — `trackedCharactersKey`가 인라인 유니온 타입 `'content' | 'boss'`를 쓰는 스타일 참고)
- `src/storage/__tests__/character-selection.test.ts` (기존 테스트 스타일 — `@capacitor/preferences`를 `Map` 기반으로 모킹하는 패턴을 그대로 따른다)

## 작업

`src/storage/keys.ts`에 키 빌더를 추가하라:

```ts
export function lastSelectedCharacterKey(kind: 'content' | 'boss'): string {
  return `lastSelectedCharacter:${kind}`
}
```

`keys.ts`는 storage 레이어에서 가장 하위 파일이라 다른 storage 파일의 타입을 import하지 않는다 — `character-selection.ts`의 `SchedulerKind`를 import하지 말고 `trackedCharactersKey`와 동일하게 인라인 유니온 타입을 써라.

`src/storage/character-selection.ts`에 함수 3개를 추가하라(기존 `getTrackedCharacterOcids`/`setTrackedCharacterOcids`/`clearTrackedCharacterOcids`와 동일한 스타일 — `Preferences.get`/`set`/`remove`를 직접 사용):

```ts
export async function getLastSelectedCharacter(kind: SchedulerKind): Promise<string | null>
export async function setLastSelectedCharacter(kind: SchedulerKind, ocid: string): Promise<void>
export async function clearLastSelectedCharacter(kind: SchedulerKind): Promise<void>
```

- 저장하는 값은 ocid 문자열 그 자체다 — `getTrackedCharacterOcids`처럼 배열을 JSON 직렬화할 필요 없다(`JSON.stringify`/`JSON.parse` 불필요, `Preferences.get`이 돌려주는 문자열을 그대로 쓴다).
- `getLastSelectedCharacter`는 저장된 값이 없으면(`Preferences.get`의 `value`가 `null`) `null`을 반환한다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `storage/` 레이어에만 변경이 있는가(다른 레이어 건드리지 않았는가)?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. `src/storage/__tests__/character-selection.test.ts`에 케이스를 추가해 다음을 검증하라:
   - 저장 전 `getLastSelectedCharacter('content')`는 `null`을 반환한다
   - `setLastSelectedCharacter('content', 'ocid-1')` 후 `getLastSelectedCharacter('content')`는 `'ocid-1'`을 반환한다
   - `'content'`와 `'boss'`는 서로 독립된 키를 쓴다 — 한쪽에 저장해도 다른 쪽 조회 결과는 `null`인 채로 유지된다
   - `clearLastSelectedCharacter('content')` 호출 후 `getLastSelectedCharacter('content')`는 다시 `null`을 반환한다
4. 결과에 따라 `phases/boss-profit-cache-order-fix/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 기존 `getTrackedCharacterOcids`/`setTrackedCharacterOcids`/`clearTrackedCharacterOcids`의 동작이나 시그니처를 바꾸지 마라.
- 새 파일을 만들지 마라 — 기존 `character-selection.ts`/`keys.ts`에 추가만 한다.
- 이 step에서는 `ContentScreen.tsx`/`BossScreen.tsx`를 수정하지 마라(화면 연동은 다음 step들에서 한다).
- 기존 테스트를 깨뜨리지 마라.
