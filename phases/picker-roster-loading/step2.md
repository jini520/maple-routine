# Step 2: picker-loading-ui

`CharacterTrackingPicker`("캐릭터 관리" 모달)에 **로딩 스피너와 빈/실패 상태**를 추가한다([[ADR-053]] 결정 3). 호출부에서 상태를 내려주는 배선은 step 3이다 — 이 step은 컴포넌트가 그 props를 받아 올바르게 그리는 것까지다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-053.md` — 이번 작업의 결정. **결정 3**이 이 step의 규칙이다.
- `/docs/adr/ADR-043.md` — 저장 버튼 비활성 규칙(선택 집합이 저장된 집합과 같으면 비활성). 이 동작을 깨뜨리면 안 된다.
- `/docs/foundation/design-system.md` — 스피너·모달·빈 상태 문구 규약.
- `/docs/foundation/error-resilience.md` — **"실패를 빈 상태로 위장하지 않는다"** 는 원칙. 이 step의 핵심 근거다.
- step 0에서 갱신된 feature 문서(피커 UI 서술) — 경로는 `phases/picker-roster-loading/index.json`의 step 0 `summary`에 적혀 있다.
- **step 1에서 수정된 파일 — 먼저 읽어라**:
  - `/src/features/schedule-sync/schedule-sync.ts` — `getCharacterPickerRoster`의 새 방출 규칙(웜: 즉시+patch / 콜드: 완료 후 1회). 언제 `entries`가 채워지는지 이해해야 스피너 조건을 맞게 쓸 수 있다.
- `/src/components/CharacterTrackingPicker/CharacterTrackingPicker.tsx` — **주 수정 대상.** 현재 props는 `entries`·`trackedOcids`·`onSave`·`onClose`뿐이고, `CharacterTrackingGrid`를 무조건 렌더한다(`:38-42`). 저장 버튼은 `isSameOcidSet`으로 비활성 판정(`:25`, `:55`).
- `/src/components/CharacterTrackingPicker/CharacterTrackingGrid.tsx` — 그리드 자체(`max-h-[70vh] grid-cols-3`). **수정 대상이 아니다.**
- `/src/components/MapleSpinner/MapleSpinner.tsx` — 이 프로젝트의 표준 스피너. `size` prop을 받는다.
- `/src/components/CharacterTrackingPicker/__tests__/CharacterTrackingPicker.test.tsx` — 갱신 대상.

## 작업

### 1. 테스트 먼저 (TDD — CLAUDE.md CRITICAL)

`CharacterTrackingPicker.test.tsx`에 아래를 작성/갱신하고 실패를 확인한 뒤 구현하라.

- `isLoading={true}`, `entries={[]}` → **스피너가 보이고** 그리드 항목이 하나도 없다.
- `isLoading={true}`, `entries={[...]}`(웜 캐시 경로) → **스피너가 아니라 그리드가 보인다**(캐시 우선 표시가 스피너에 가려지면 안 된다).
- `isLoading={false}`, `entries={[]}`, `loadFailed={false}` → **"활성 캐릭터 없음"** 취지의 안내가 보이고 스피너는 없다.
- `isLoading={false}`, `entries={[]}`, `loadFailed={true}` → **"불러오지 못했다"** 취지의 안내가 보인다. 위의 "없음" 문구와 **구분되는 텍스트**여야 한다.
- `isLoading={false}`, `entries={[...]}` → 기존대로 그리드만 보인다.
- **기존 동작 회귀 방지**: 저장 버튼의 [[ADR-043]] 비활성 규칙(선택 집합 == `trackedOcids`면 비활성, 달라지면 활성), 닫기/저장 콜백, 항목 토글이 그대로 동작한다.

### 2. `CharacterTrackingPicker.tsx` 수정

props에 두 개를 추가한다.

```ts
export interface CharacterTrackingPickerProps {
  entries: CharacterPickerEntry[]
  trackedOcids: string[]
  // 후보 목록 조회가 진행 중인지(ADR-053 결정 3). 호출부가 getCharacterPickerRoster의
  // Promise 완료 시점으로 판정해 내려준다.
  isLoading: boolean
  // 조회가 전역 실패(401/429 등)로 끝났는지 — "활성 캐릭터 0명"과 구분해 안내하기 위함.
  loadFailed: boolean
  onSave: (ocids: string[]) => void
  onClose: () => void
}
```

렌더 규칙:

- **스피너 조건은 `isLoading && entries.length === 0`.** 보여줄 게 있으면(웜 캐시) 스피너 대신 그리드를 그린다 — [[ADR-016]] 캐시 우선 표시를 가리면 안 된다.
- 스피너·빈 상태·실패 안내는 **그리드가 차지하던 자리**에 그린다. 모달의 제목·설명·버튼 줄 구조는 그대로 둔다.
- 스피너는 `MapleSpinner`를 쓴다. 세로로 너무 납작하지 않게 최소 높이를 주되, **그리드의 `max-h-[70vh]`를 흉내 낸 큰 고정 높이를 만들지 마라** — 모달이 불필요하게 커진다.
- 실패 문구와 빈 문구는 서로 다른 텍스트여야 한다(예: 실패는 "캐릭터 목록을 불러오지 못했어요", 빈 상태는 "표시할 캐릭터가 없어요" 취지). 정확한 카피는 재량이되 `docs/foundation/design-system.md`의 톤을 따르고, 실패 문구는 `text-error` 계열 토큰을 쓴다.
- 접근성: 스피너 영역에 `aria-busy` 또는 적절한 `aria-label`을 준다(온보딩 `ContentCharacterStep.tsx`의 `aria-busy`/`aria-label` 사용례 참고).

**이 step에서 반드시 지켜야 할 규칙:**
- **저장 버튼의 [[ADR-043]] 비활성 판정 로직(`isSameOcidSet`)을 바꾸지 마라.** 로딩 중에는 선택이 `trackedOcids`와 같아 자연히 비활성이 된다 — 별도 `disabled={isLoading}` 분기를 덧붙이지 말고 기존 판정에 맡겨라.
- **`CharacterTrackingGrid`를 수정하지 마라.** 그리드는 온보딩 `ContentCharacterStep`과 공유되며, 로딩 처리는 그리드가 아니라 각 사용처(모달 / 온보딩 단계)의 책임이다.
- 두 새 props는 **필수(optional 아님)** 로 둬라 — 호출부 3곳(step 3)이 전부 명시적으로 넘기게 강제해, 배선을 빠뜨리면 빌드가 깨지게 한다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음 — 새 필수 props를 안 넘긴 호출부가 있으면 여기서 잡힌다
npm test        # 전체 테스트 통과
npm run lint    # 경고 0
```

> **참고**: `isLoading`·`loadFailed`를 필수 props로 만들면 `ContentScreen`·`BossScreen`이 컴파일 에러를 낸다. 이 step에서는 **두 화면에 임시로 최소한의 값만 넘겨** 빌드를 통과시켜라(예: 지금 상태를 그대로 표현하는 `isLoading={false} loadFailed={false}`). 실제 로딩 상태 관리는 step 3에서 붙인다. 그 임시 배선 사실을 summary에 반드시 남겨라.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `components/`는 상태를 스스로 조회하지 않고 props로만 받는 구조를 유지했는가? (컴포넌트 안에서 `getCharacterPickerRoster`를 부르지 않았는가)
   - 웜 캐시(`entries`가 있는 상태)에서 스피너가 그리드를 가리지 않는가?
   - "활성 캐릭터 0명"과 "조회 실패"가 **구분되는가**? (`docs/foundation/error-resilience.md` — 실패를 빈 상태로 위장 금지)
   - [[ADR-043]] 저장 버튼 비활성 규칙이 그대로인가?
   - TDD 순서를 지켰는가?
3. 결과에 따라 `phases/picker-roster-loading/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 **새 props 이름·타입·스피너 조건식**과 **두 화면에 넣은 임시 배선(step 3에서 실제 상태로 교체해야 함)** 을 명시하라.
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `CharacterTrackingGrid.tsx`를 수정하지 마라. 이유: 온보딩 `ContentCharacterStep`과 공유되는 순수 그리드다. 여기에 로딩 개념을 넣으면 두 사용처의 레이아웃(모달 / 페이지)이 서로를 제약하게 된다.
- 컴포넌트 안에서 `getCharacterPickerRoster`를 직접 호출하지 마라. 이유: `components/`는 데이터를 조회하지 않고 props로 받는다는 레이어 규칙(`docs/foundation/architecture.md`)을 깬다. 조회는 화면(`app/`)의 책임이다.
- 저장 버튼에 `disabled={isLoading}`을 덧붙이지 마라. 이유: [[ADR-043]]의 집합 비교 판정이 이미 로딩 중 비활성을 보장한다. 조건이 둘로 갈리면 나중에 한쪽만 고쳐 회귀가 난다.
- 스피너 조건을 `isLoading`만으로 쓰지 마라. 이유: 웜 캐시에서 `entries`가 이미 있는데도 스피너가 떠 [[ADR-016]] 캐시 우선 표시가 무력화된다.
- 실패와 빈 상태를 같은 문구로 합치지 마라. 이유: API 키가 만료돼 아무것도 못 불러온 상황을 "캐릭터가 없어요"로 안내하면 사용자가 원인을 영영 알 수 없다.
- `src/features/`·`src/app/`의 로직을 바꾸지 마라(위 "참고"의 임시 props 전달 제외). 이유: step 1은 완료됐고 호출부 배선은 step 3의 범위다.
- 기존 테스트를 깨뜨리지 마라.
