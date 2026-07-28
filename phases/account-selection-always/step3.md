# Step 3: single-account-highlight

계정이 정확히 1개일 때 그 항목을 **초기 하이라이트로 지정**한다([[ADR-051]] 결정 3). 선택 화면을 보여주는 것이 목적이지 탭 수를 늘리는 게 목적이 아니므로, 항목을 고르는 탭 1회는 아껴주고 "계속하기"라는 확정 행위만 남긴다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-051.md` — 이번 작업의 결정. **결정 3**이 이 step의 규칙이다.
- `/docs/features/onboarding.md` — "UI > 계정(메이플 ID) 선택 목록 — `AccountSelectionList`" 절(step 0에서 초기 하이라이트 규칙이 추가돼 있다).
- `/docs/foundation/design-system.md` — 선택 카드 패턴(`aria-pressed`, 선택 시 `border-primary bg-primary/15`)의 공통 규약.
- `/src/app/onboarding/AccountSelectionList.tsx` — **유일한 수정 대상.** `highlightedAccountId` 상태(`:32`)가 `null`로 시작하고, 항목 클릭으로 하이라이트(`:53`), "계속하기" 버튼은 `highlightedAccountId === null`이면 비활성(`:97`)이다.
- `/src/app/onboarding/__tests__/` 아래 `AccountSelectionList` 관련 테스트(있으면 갱신, 없으면 신규 작성).
- **이전 step에서 수정된 파일 — 읽어서 맥락만 파악하라(수정 금지)**:
  - `/src/features/onboarding/state.ts`·`store.ts` (step 1 — 온보딩 자동 확정 제거)
  - `/src/features/settings/state.ts`·`store.ts` (step 2 — 설정 자동 확정 제거)
- **이 컴포넌트를 쓰는 두 화면**(읽기만, 스냅샷/렌더 테스트가 깨지는지 확인용):
  - `/src/app/onboarding/OnboardingScreen.tsx` (`'selectingAccount'` 케이스 `:71-81`)
  - `/src/app/settings/AccountFlowStatus.tsx` (`'selectingAccount'` 케이스 `:33-43`)
  - 그리고 각각의 테스트 `/src/app/onboarding/__tests__/OnboardingScreen.test.tsx`, `/src/app/settings/__tests__/AccountFlowStatus.test.tsx`

## 작업

### 1. 테스트 먼저 (TDD — CLAUDE.md CRITICAL)

`AccountSelectionList`에 대해 아래를 먼저 작성/갱신하고 실패를 확인한 뒤 구현하라.

- **계정 1개**: 렌더 직후 그 항목의 `aria-pressed`가 `true`이고, "계속하기" 버튼이 **활성** 상태이며, 곧바로 눌렀을 때 `onSelect`가 그 `accountId`로 호출된다.
- **계정 2개 이상**: 렌더 직후 어떤 항목도 `aria-pressed={true}`가 아니고 "계속하기"가 **비활성**이다(기존 동작 유지). 항목을 누르면 그때 활성화되고, 다른 항목을 누르면 하이라이트가 옮겨간다.
- `isSubmitting={true}`면 계정 수와 무관하게 항목·"계속하기"가 모두 비활성이다(기존 동작 유지).

### 2. `src/app/onboarding/AccountSelectionList.tsx`

`highlightedAccountId`의 **초깃값**을 계정이 1개일 때 그 계정의 `accountId`로, 그 외에는 `null`로 지정한다.

```ts
const [highlightedAccountId, setHighlightedAccountId] = useState<string | null>(
  /* 계정이 정확히 1개면 그 accountId, 아니면 null */
)
```

- 주석으로 `[[ADR-051]] 결정 3`과 그 의도(화면은 반드시 보여주되 항목 선택 탭 1회는 아낀다)를 남겨라.
- 나머지 렌더링·스타일·`onSelect` 시그니처는 **그대로 둔다.**

**이 step에서 반드시 지켜야 할 규칙:**
- **`props.accounts` 변화에 하이라이트를 동기화하는 `useEffect`를 넣지 마라.** 이 컴포넌트는 계정 목록이 확정된 뒤에 마운트되므로 초깃값 하나면 충분하고, 동기화 로직을 넣으면 사용자가 직접 고른 하이라이트를 나중에 덮어쓸 위험이 생긴다.
- **자동으로 `onSelect`를 호출하지 마라.** 계정이 1개여도 확정은 사용자가 "계속하기"를 눌러야 일어난다 — 그게 이 이슈(#60)의 핵심이다. 자동 호출은 자동 확정을 UI 레이어에 되살리는 것과 같다.
- 이 컴포넌트는 **온보딩과 설정 계정 변경 모달이 공유**한다. 어느 한쪽 전용 분기(레이아웃·문구·카드)를 넣지 마라.

### 3. 공유 화면 테스트 확인

`OnboardingScreen.test.tsx`와 `AccountFlowStatus.test.tsx`가 계정 1개 fixture로 "선택된 항목 없음"을 전제하고 있으면 새 동작에 맞게 갱신하라. 계정 2개 이상 케이스는 건드릴 필요가 없어야 한다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 전체 테스트 통과
npm run lint    # 경고 0
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `components/`·`app/` 레이어 분리 규칙을 지켰는가? (공용 UI에 화면별 분기를 넣지 않았는가)
   - `aria-pressed` 등 `docs/foundation/design-system.md`의 선택 카드 규약을 유지했는가?
   - [[ADR-051]] 결정 3만 반영하고 결정 1·2(이미 step 1·2에서 완료)를 다시 건드리지 않았는가?
   - 자동 `onSelect` 호출을 넣지 않았는가?
3. 결과에 따라 `phases/account-selection-always/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 파일·초기 하이라이트 규칙·**"자동 onSelect는 넣지 않음(사용자가 계속하기를 눌러야 확정)"** 을 명시하라.
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `props.accounts`를 감시하는 `useEffect`로 하이라이트를 재계산하지 마라. 이유: 사용자가 이미 고른 하이라이트를 덮어쓸 수 있고, 이 컴포넌트는 목록이 확정된 뒤 마운트되므로 필요가 없다.
- 계정이 1개일 때 `onSelect`를 자동 호출하지 마라. 이유: 상태 머신에서 방금 없앤 자동 확정을 UI 레이어에서 되살리는 것이다. 이슈 #60의 목적은 "사용자가 어떤 메이플 ID에 연동되는지 직접 보고 확정하는 것"이다.
- `src/features/onboarding/`·`src/features/settings/`를 다시 수정하지 마라. 이유: step 1·2에서 완료됐다.
- `AccountSelectionList`에 온보딩 전용 또는 설정 전용 분기를 넣지 마라. 이유: 두 화면이 공유하는 컴포넌트라 한쪽만 보고 고치면 다른 쪽이 깨진다(온보딩은 페이지형, 설정은 모달이 카드로 감싸는 구조).
- 기존 테스트를 깨뜨리지 마라(단, 계정 1개 fixture로 "선택 없음"을 전제하던 단언은 **의도적으로 갱신**한다).
