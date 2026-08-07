# Step 1: measured-height-hook

이 step 은 **공용 훅 하나와 그 테스트만** 만든다. 호출부(`PageHeader`·`BossProfitScreen`)는
step 2·3 이 바꾼다 — 여기서는 손대지 마라.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 관련 ADR 만 `/docs/adr/ADR-NNN.md` 로 열어라. 전체를 컨텍스트에 올리지 말 것)
- `/docs/adr/ADR-112.md` — **이 step 이 구현하는 결정**(step 0 이 방금 썼다). 반드시 읽어라
- `/docs/adr/ADR-085.md` 결정 1 · `/docs/adr/ADR-098.md` 결정 2 — 이 실측+spacer 구조를 만든 결정
- `/docs/foundation/design-system.md` "스크롤 영역" 절
- `/src/components/templates/PageHeader/PageHeader.tsx` 44~62행 — **옮겨올 원본 로직 A**
- `/src/app/boss-profit/BossProfitScreen.tsx` 510~526행 — **옮겨올 원본 로직 B**
- `/vitest.setup.ts` — 전역 스텁. `ResizeObserver` 가 **콜백을 절대 부르지 않는 no-op 클래스**로
  스텁돼 있다는 점이 이 step 의 테스트 설계에 핵심이다
- `/src/lib/use-count-up.ts` 와 `/src/lib/__tests__/use-count-up.test.tsx` — 이 프로젝트의 훅 파일·
  훅 테스트 관례(주석 밀도, `// @vitest-environment jsdom` 프래그마 위치, import 스타일)

## 배경 (이슈 #168)

보스 수익에서 기록 없는 과거 기간으로 이동하면 로딩 카드가 **한 프레임 ~90px 아래에 그려졌다가
제자리로 올라온다.**

`fixed` 페이지 헤더는 흐름에서 빠져 있고([[ADR-085]] 결정 1) 아래 목록은 **실측 높이를 가진
spacer** 로 자리를 받는다. 기간을 이동하면 `isPeriodLoading` 이 총 수익 헤드라인 블록을 헤더에서
빼 헤더가 ~91px 짧아지는데, spacer 높이의 갱신 경로가 `ResizeObserver` 하나뿐이라 한 프레임 늦는다.
RO 콜백 자체는 페인트 전에 배달되지만 그 안의 `setState` 는 React 이벤트 밖이라 Scheduler 태스크로
넘어가 **다음 프레임**에 렌더된다([[ADR-102]] 가 접기에서 관측한 같은 성질). `useLayoutEffect` 안의
`setState` 는 같은 커밋에서 페인트 전에 동기 반영된다.

`PageHeader`(공용 셸, 스케줄러 4화면)와 `BossProfitScreen` 이 **글자 하나까지 같은 측정 로직을
복붙**하고 있고 양쪽 다 같은 결함이다. 그래서 훅으로 뽑는다.

## 작업

### 1. `src/lib/use-measured-height.ts` 신설

```ts
/**
 * 요소의 border-box 높이를 **페인트 전에** 실측해 돌려준다.
 * `fixed` 헤더가 흐름에서 빠진 자리를 채우는 spacer 높이 전용.
 */
export function useMeasuredHeight<T extends HTMLElement>(): {
  ref: (node: T | null) => void
  height: number
}
```

내부 구조는 **effect 두 개**다. 이 분담이 이 훅의 존재 이유이므로 주석으로 남겨라.

1. **측정 effect — `useLayoutEffect`, deps 없음(매 커밋).**
   요소가 있으면 `getBoundingClientRect().height` 로 재서 state 에 넣는다.
   deps 를 붙이지 않는 것이 이 훅의 요점이다 — 헤더 높이를 바꾸는 상태 전환이 무엇이든 같은 커밋에
   따라온다. 페인트 전에 도는 `useLayoutEffect` 안의 `setState` 라 어긋난 프레임이 생기지 않는다.

2. **관찰 effect — `useLayoutEffect`, deps 는 요소.**
   `ResizeObserver` 로 **렌더 밖 변화**(폰트 로드·기기 회전)를 따라간다. 정리 함수에서 `disconnect()`.

요소는 `useRef` 가 아니라 **`useState` 로 잡고 콜백 ref 를 돌려준다**. 이유를 주석에 적어라:
`ref.current` 는 반응형이 아니라 관찰 effect 가 요소의 등장·소멸을 따라 재부착되지 못한다.
`BossProfitScreen` 은 빈 상태에서 헤더 자체를 렌더하지 않아 현재 `[isEmpty]` deps 로 그것을 손수
처리하고 있는데, 콜백 ref 면 그 deps 가 **구조적으로 필요 없어진다**.

**핵심 규칙 — 반드시 지켜라:**

- **측정은 `getBoundingClientRect().height` 다.** `ResizeObserver` 콜백 안에서도 `entry.contentRect`
  를 쓰지 마라. 이유: RO 의 기본 관찰 박스는 content-box 라 **테두리 변화를 놓친다.** 캐릭터 카드
  헤더는 접힘 66px / 펼침 64px 로 테두리 2px 만 다른 실측을 계약으로 갖고 있고
  (`BossProfitScreen.test.tsx` 의 "ADR-047 후속" 테스트가 그 2px 를 단언한다), 이 값이 중첩 sticky
  오프셋으로 쓰인다([[ADR-047]]).
- **콜백 ref 는 렌더마다 새 함수가 되면 안 된다.** 매 렌더 새 함수를 넘기면 React 가 커밋마다
  `ref(null)` → `ref(node)` 로 떼었다 붙여 요소 state 가 흔들리고 관찰 effect 가 매번 재부착된다.
  `useCallback` 으로 고정하라.
- **요소가 `null` 이 될 때 높이를 0으로 되돌리지 마라.** 이유: 현재 두 호출부의 동작이 그렇다
  (요소가 사라져도 마지막 실측값이 남는다). 이 step 은 **측정 시점만 고치는 것이지 값의 수명을
  바꾸는 것이 아니다** — 되돌리면 step 2·3 에서 기존 테스트가 예상 못 한 이유로 깨진다.
- 초기값은 `0` 이다. 미지원 환경에서 0으로 남으면 목록이 헤더에 가려지지만, 그것이 현재 계약이다
  ([[ADR-085]] 트레이드오프 — 실측을 지우거나 `useEffect` 로 되돌리지 말 것).

### 2. `src/lib/__tests__/use-measured-height.test.tsx` 신설 (TDD — 테스트를 먼저 써라)

파일 첫 줄에 `// @vitest-environment jsdom` 프래그마를 둔다(전역 env 가 `node` 다).

jsdom 은 레이아웃이 없어 `getBoundingClientRect()` 가 늘 0 이다. **가변 변수를 읽는 mock** 으로
높이를 주입하라 — 테스트 도중 값을 바꿔 리렌더를 태워야 하기 때문이다:

```ts
let stubbedHeight = 0
vi.spyOn(Element.prototype, 'getBoundingClientRect')
  .mockImplementation(() => ({ height: stubbedHeight }) as DOMRect)
```

(`PageHeader.test.tsx` 의 `stubHeaderHeight` 헬퍼가 `mockReturnValue` 로 같은 일을 하고 있으니
형식을 참고하되, 여기서는 **값을 바꿀 수 있어야** 한다.)

덮어야 할 계약:

1. **첫 커밋에 실측 높이를 낸다** — 마운트 직후 `height` 가 스텁 값이다(`useLayoutEffect` 라 페인트 전).
2. **★ 이 이슈의 회귀 가드 — 높이를 바꾸는 리렌더에서 `ResizeObserver` 없이 같은 커밋에 따라온다.**
   높이를 A 로 두고 렌더 → 스텁을 B 로 바꾸고 **리렌더를 유발** → `height` 가 B 다.
   `vitest.setup.ts` 의 RO 는 콜백을 절대 부르지 않으므로, 이 테스트가 통과한다는 것은 **측정
   effect 가 실제로 그 일을 했다**는 뜻이다. 이 테스트에 `ADR-112` 와 이슈 번호를 주석으로 박아라.
3. **요소가 사라졌다 다시 나타나면 다시 잰다** — 조건부로 요소를 렌더하는 테스트 컴포넌트로
   `null` → 요소 왕복을 태운다(`BossProfitScreen` 의 `isEmpty` 경로가 이것이다).
4. **`ResizeObserver` 콜백이 오면 갱신한다** — 렌더 밖 변화 경로가 살아 있는지. `globalThis.ResizeObserver`
   를 스파이 클래스로 갈아 끼워 콜백을 붙잡았다가 손으로 부른 뒤(`act` 안에서) 높이가 바뀌는지 본다.
   **RO 를 지우는 회귀를 잡는 가드다** — 측정 effect 가 생겼다고 RO 를 떼면 폰트 로드·기기 회전을
   놓친다.
5. **언마운트 시 `disconnect()` 를 부른다.**
6. **관찰이 같은 요소에 대해 반복 재부착되지 않는다** — 요소가 그대로인 리렌더를 여러 번 태운 뒤
   `observe` 호출 횟수가 1 인지. 콜백 ref 를 `useCallback` 으로 고정하지 않은 회귀를 잡는다.

**각 테스트가 실제로 판별하는지 코드 변이로 확인하라**(이 프로젝트의 관례다 — 이전 phase 들이
`note_verification` 으로 남겨온 것). 최소한:
- 측정 effect 에 `[]` deps 를 붙이면 테스트 2 가 실패해야 한다.
- RO effect 를 지우면 테스트 4 가 실패해야 한다.
- 콜백 ref 를 인라인 화살표 함수로 바꾸면 테스트 6 이 실패해야 한다.

확인 결과를 step 완료 시 `index.json` 의 `note_verification` 에 적어라.

## Acceptance Criteria

```bash
test -f src/lib/use-measured-height.ts
test -f src/lib/__tests__/use-measured-height.test.tsx
npm run build     # 타입 에러 없음
npm run lint      # 에러 0
npm test -- --run # 기존 2,515개 + 새 케이스 전부 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `git diff --stat` 으로 **바뀐 파일이 위 두 개뿐인지** 확인한다(제품 호출부는 step 2·3 의 몫이다).
3. 아키텍처 체크리스트:
   - `foundation/architecture.md` 의 디렉터리 규칙 — 범용 유틸은 `lib/` 이다. 훅이 `features/`·
     `app/` 의 무엇도 import 하지 않는지 확인하라(순수 DOM 측정이라 그럴 이유가 없다).
   - CLAUDE.md CRITICAL — `storage/`·`native/` 어댑터 우회 없음(해당 없음), 게임 수치 하드코딩 없음(해당 없음).
   - TDD — 테스트를 먼저 썼는가.
4. 결과에 따라 `phases/header-spacer-sync/index.json` 의 step 1 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`(+ `note_verification`)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`PageHeader.tsx` 나 `BossProfitScreen.tsx` 를 건드리지 마라.** 이유: step 을 레이어별로 쪼갠
  까닭이다. 훅과 두 호출부가 한 커밋에 섞이면 회귀가 어디서 왔는지 diff 로 못 가른다.
- **`ResizeObserver` 를 없애지 마라.** 이유: 측정 effect 는 **렌더가 일어날 때만** 돈다. 폰트 로드
  완료·기기 회전처럼 React 렌더 없이 높이가 바뀌는 경로는 RO 만 잡는다.
- **`entry.contentRect` 를 쓰지 마라.** 이유: content-box 관찰이라 테두리 2px 변화를 놓치고, 그 값이
  중첩 sticky 오프셋([[ADR-047]])으로 쓰여 카드 헤더가 어긋난다.
- **`useEffect` 로 재지 마라.** 이유: 페인트 후에 재면 첫 프레임에 spacer 가 0이라 목록이 위로 튄다
  ([[ADR-085]] 결정 1 · [[ADR-098]] 결정 2 가 명시적으로 금지한 것이다).
- **`vitest.setup.ts` 의 전역 `ResizeObserver` 스텁을 고치지 마라.** 이유: 그 no-op 성질이 테스트 2 의
  판별력 그 자체다. 콜백을 부르게 만들면 이 이슈의 회귀 가드가 무력해지고, 다른 170개 테스트 파일의
  전제도 함께 바뀐다. 테스트 4 는 그 파일이 아니라 **해당 테스트 안에서만** 스파이로 갈아 끼워라.
- 기존 테스트를 깨뜨리지 마라.
