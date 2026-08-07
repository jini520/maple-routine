# Step 3: boss-profit-header

이 step 은 **`BossProfitScreen` 하나만** 바꾼다. 이슈 #168 이 실제로 보고된 화면이다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 관련 ADR 만 `/docs/adr/ADR-NNN.md` 로 열어라. 전체를 컨텍스트에 올리지 말 것)
- `/docs/adr/ADR-112.md` — **이 step 이 구현하는 결정**
- `/docs/adr/ADR-085.md` 결정 1 — 이 화면 헤더가 `fixed` + 실측 spacer 가 된 이유. **트레이드오프 절
  세 번째 항목**("spacer 는 실측값에 의존한다 … 그 실측을 지우거나 `useEffect` 로 되돌리지 말 것")
- `/docs/adr/ADR-047.md` — 펼친 캐릭터 카드의 **중첩 sticky 가 이 실측값을 오프셋으로 쓴다**. 이번
  변경이 그 값의 갱신 빈도를 바꾸므로 반드시 읽어라
- `/docs/adr/ADR-100.md` 결정 2·3 — 헤더+spacer 래퍼가 `ScreenScroll` **안**에 있는 이유, 중첩 sticky
  오프셋에서 `var(--sa-top)` 을 빼는 이유
- `/docs/features/boss-profit.md` — "화면 구조·스크롤" 절
- `/src/lib/use-measured-height.ts` — **step 1 이 만든 훅**
- `/src/components/templates/PageHeader/PageHeader.tsx` — **step 2 가 이 훅으로 갈아 끼운 본보기.**
  같은 형태로 맞춰라
- `/src/app/boss-profit/BossProfitScreen.tsx` — **수정 대상**
- `/src/app/boss-profit/__tests__/BossProfitScreen.test.tsx` — 기존 계약. 특히 "ADR-047 후속" 테스트들이
  `getBoundingClientRect` 를 전역 스파이로 스텁한다(1573행 부근)

## 배경 (이슈 #168)

보스 수익에서 **기록이 없는 과거 기간으로 이동**하면 `지난 주 기록을 불러오고 있어요` 카드가
**한 프레임 아래(~90px)에 그려졌다가 제자리로 올라온다.** 같은 카드가 자리를 옮기는 것이다.

사슬:

1. 기간 이동 → 스토어가 `isPeriodLoading: true`.
2. 총 수익 헤드라인 블록이 `!isPeriodLoading` 게이트(`BossProfitScreen.tsx:744`)에 걸려 사라진다
   → 헤더가 **약 91px** 짧아진다(라벨행 `h-6` 24 + `mt-1.5` 6 + 금액행 `h-8` 32 + `mt-3` 12 +
   헤어라인 1 + 부모 `space-y-4` 16).
3. spacer(`:807`)는 아직 옛 높이다 — 측정 `useLayoutEffect`(`:512-526`)의 deps 가 `[isEmpty]` 뿐이라
   이 전환에서 재실행되지 않는다.
4. 이 상태로 한 프레임이 그려진다 ← 카드가 ~90px 아래.
5. `ResizeObserver` 발화 → `setState` → 다음 렌더에 제자리로 튀어 오른다.

**기록이 있는 기간으로 이동해도 같은 프레임이 난다** — 헤드라인 게이트는 `isPeriodLoading` 하나뿐이라
기록 유무와 무관하다. 다만 곧이어 캐릭터 카드가 들어차 튐이 콘텐츠 변화에 섞여 눈에 덜 띈다.

## 작업

### 1. 측정 로직을 훅으로 갈아 끼운다

현재 상태(행 번호는 참고용 — 코드를 읽고 확인하라):

- `:476` `const stickyHeaderRef = useRef<HTMLDivElement>(null)`
- `:477` `const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0)`
- `:512-526` 측정 `useLayoutEffect`(deps `[isEmpty]`) — `measure()` + `ResizeObserver`
- `:623` `<div ref={stickyHeaderRef} className="fixed inset-x-0 top-0 z-10 …">`
- `:807` `<div aria-hidden="true" style={{ height: stickyHeaderHeight }} />`
- `:868` `stickyTop={stickyHeaderHeight}` — **중첩 sticky 오프셋으로 자손에게 내려간다**([[ADR-047]])

`useMeasuredHeight` 로 넷을 대체한다. `stickyHeaderRef` 는 측정 외의 쓰임이 없으므로(전체 파일에서
`:476`·`:513`·`:623` 세 곳뿐) 콜백 ref 로 바꿔도 딸려 오는 것이 없다.

**`[isEmpty]` deps 는 사라진다.** 빈 상태(`:541` 조기 반환)에서 헤더가 언마운트되는 경로를 콜백 ref 가
구조적으로 처리한다 — 훅의 관찰 effect 가 요소의 등장·소멸을 따라 재부착된다. `:475` 의 주석
("빈 상태에서는 헤더 자체가 렌더되지 않으므로 isEmpty가 풀릴 때 다시 붙인다")은 **이유가 사라진 것이
아니라 처리 주체가 바뀐 것**이므로, 그 사실이 드러나게 주석을 고쳐라.

주석 갱신: `:472-475`·`:510-511` 은 **왜 실측이어야 하는가**([[ADR-047]] 중첩 sticky 오프셋 ·
[[ADR-085]] 결정 1 spacer)를 그대로 남기고, 측정 방식의 상세(두 effect 분담)는 훅 파일에 맡겨라.
[[ADR-112]] 참조를 더하라. **`:800-802` 의 당김 인디케이터 주석은 건드리지 마라** — 그 계약
(`absolute` 라 실측 높이를 바꾸지 않는다)은 그대로 유효하다.

### 2. 이슈 재현 회귀 가드 테스트 — `BossProfitScreen.test.tsx`

스토어는 `vi.mock` 으로 통째 대체돼 있고 `mockStore(overrides)` 헬퍼가 반환값을 갈아 끼운다
(42행). `getBoundingClientRect` 는 전역 스파이로 스텁한다(1580행 부근이 본보기).

**재현 시나리오:**

1. `mockStore({ status: 'loaded', trackedOcids: [...], rows: [row()], isPeriodLoading: false })`
   + 스텁 높이 A(헤드라인이 있는 긴 헤더) → 렌더 → spacer 가 A 다.
2. `mockStore({ ...같은 것, isPeriodLoading: true })` + 스텁 높이 B(B < A, 헤드라인이 빠진 짧은 헤더)
   → `rerender` → **spacer 가 같은 커밋에 B 여야 한다.**

`vitest.setup.ts` 의 `ResizeObserver` 는 콜백을 절대 부르지 않는 no-op 스텁이다. 따라서 이 테스트가
통과한다는 것은 **측정 effect 가 실제로 그 일을 했다**는 뜻이고, 수정 전 코드에서는 반드시 실패한다.
주석에 이 전제와 `ADR-112`·이슈 #168 을 박아라 — 그 전제가 이 테스트의 판별력 그 자체다.

spacer 는 `.fixed.top-0` 헤더의 **형제이자 래퍼의 마지막 자식**이다(`:806-807`). 기존 테스트가
`container.querySelector('.fixed.top-0')` 로 헤더를 잡는 방식(1567행)을 참고해 선택자를 정하라.

**중첩 sticky 오프셋도 같은 값을 쓴다는 것**(`stickyTop`)을 한 케이스로 함께 단언할지는 재량이다.
단, 단언한다면 [[ADR-100]] 결정 3 대로 `calc(<실측>px - var(--sa-top))` 형태임을 기억하라.

### 3. 파급 확인 — 반드시 전체 스위트를 돌려라

이 화면의 테스트에는 `getBoundingClientRect` 를 **모든 요소에 대해 같은 값으로** 스텁하는 것들이
있다(카드 헤더 66/64px 를 재는 "ADR-047 후속" 계열). 측정이 매 커밋 도는 쪽으로 바뀌면 그 테스트들의
`fireEvent.click` 뒤에 페이지 헤더 실측값도 함께 바뀐다 — 카드 헤더용 스텁 값이 페이지 헤더에도
적용되기 때문이다.

깨지는 테스트가 나오면 **그 테스트가 지키려던 계약을 먼저 판별하라**:

- 계약은 유효한데 전역 스텁이 페이지 헤더까지 물들여 깨진 것 → 스텁을 요소별로 좁혀라
  (`stickyHeaderRef` 가 붙은 요소만 다른 값을 내게 하는 식). **계약을 느슨하게 고치지 마라.**
- 계약 자체가 "리렌더에서 페이지 헤더 실측이 안 따라온다"였다면 → 그것이 이 이슈가 고치는 버그다.
  갱신하지 말고 **삭제하고 새 계약으로 다시 써라**(같은 이름을 남기면 다음 사람이 오독한다).

판단 근거를 step 완료 시 `index.json` 에 note 로 남겨라.

## Acceptance Criteria

```bash
npm run build     # 타입 에러 없음
npm run lint      # 에러 0
npm test -- --run # 전부 통과 (DOM 스냅샷 포함)
grep -q "useMeasuredHeight" src/app/boss-profit/BossProfitScreen.tsx
! grep -q "new ResizeObserver" src/app/boss-profit/BossProfitScreen.tsx
! grep -q "stickyHeaderRef" src/app/boss-profit/BossProfitScreen.tsx
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. **새 회귀 가드가 실제로 판별하는지 코드 변이로 확인하라** — 훅의 측정 effect 에 `[]` deps 를
   임시로 붙였을 때 그 테스트가 실패해야 한다. 실패하지 않으면 테스트가 버그를 못 잡는 것이다.
   확인 후 변이는 반드시 되돌려라.
3. `git diff -- src/app/boss-profit/__tests__/__snapshots__/` 가 비어 있는지 확인한다. 비어 있지
   않으면 DOM 이 바뀐 것이다 — `-u` 로 갱신하지 말고 구현을 되돌려라.
4. 아키텍처 체크리스트:
   - `app/` → `lib/` 의존은 허용된 방향인가.
   - CLAUDE.md CRITICAL — `features/*` 에서 저장소·네이티브 직접 접근 없음(해당 없음), 게임 수치
     하드코딩 없음(해당 없음).
5. 결과에 따라 `phases/header-spacer-sync/index.json` 의 step 3 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`(+ 변이 확인 결과)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`stickyTop` 을 자손에게 내리는 경로(`BossProfitContext`)를 바꾸지 마라.** 이유: 4단계 아래
  `CharacterAccordion` 이 쓰고, 프롭으로 되돌리면 [[ADR-094]] 3단계가 없앤 통과 전용 프롭이 다시 생긴다
  ([[ADR-100]] 결정 5).
- **`isPeriodLoading` 게이트(`:744`)를 건드리지 마라.** 이유: 헤더 높이를 고정하는 안(로딩 중에도
  헤드라인 자리 예약)은 [[ADR-112]] 에서 **기각된 대안**이다 — 로딩 중 ~90px 빈 블록이 남는 디자인
  변경이고, 이 step 의 처방은 spacer 가 같은 커밋에 따라오게 하는 것이다.
- **`fixed` → `sticky` 로 되돌리거나 spacer 를 없애지 마라.** 이유: [[ADR-085]] 결정 1 이 iOS 실기기
  계측으로 세운 결정이다. 되돌리면 옛 오프셋이 돌아오는 프레임에 헤더가 화면 밖(`-1065px`)으로 날아간다.
- **`useEffect` 로 재지 마라.** 이유: 페인트 후에 재면 첫 프레임에 spacer 가 0이라 목록이 위로 튄다.
- **당김 인디케이터(`PullToRefreshIndicator`)나 목록 블록의 `transform` 구조를 건드리지 마라.**
  이유: 인디케이터가 `absolute` 이고 목록이 `transform` 인 것은 **실측 높이를 바꾸지 않기 위한 계약**
  이다([[ADR-072]] 결정 4 · [[ADR-073]]). 흐름·크기를 바꾸는 방식으로 되돌리면 당길 때마다 측정이
  발화해 펼친 카드의 중첩 sticky 헤더가 손가락을 따라 흔들린다.
- **`ADR-080` 의 기간·탭 최상단 `scrollTo`(`:505-508`)를 건드리지 마라.** 이유: 다른 고리를 끊는
  별개의 결정이고, 이 이슈와 무관하다.
- **`src/lib/use-measured-height.ts` 나 `PageHeader.tsx` 를 고치지 마라.** 이유: step 1·2 에서 확정된
  것이다. 여기서 훅을 고쳐야 할 필요가 생겼다면 그것은 step 1 의 설계가 틀렸다는 신호이므로,
  고치기 전에 `index.json` 에 근거를 남기고 **훅 테스트도 함께 갱신**하라.
- 기존 테스트를 깨뜨리지 마라.
