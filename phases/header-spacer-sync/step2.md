# Step 2: page-header

이 step 은 **공용 셸 `PageHeader` 하나만** 바꾼다(스케줄러 4화면이 쓴다). 보스 수익은 step 3 이다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 관련 ADR 만 `/docs/adr/ADR-NNN.md` 로 열어라. 전체를 컨텍스트에 올리지 말 것)
- `/docs/adr/ADR-112.md` — **이 step 이 구현하는 결정**
- `/docs/adr/ADR-098.md` 결정 2 — 이 셸이 `fixed` + 실측 spacer 가 된 이유
- `/docs/adr/ADR-094.md` — 이 셸이 존재하는 이유(4화면 복붙 제거). 결정 4 의 안전장치 "렌더 결과 DOM 1:1 동일"
- `/docs/foundation/design-system.md` "스크롤 영역" 절
- `/src/lib/use-measured-height.ts` — **step 1 이 만든 훅**. 시그니처와 두 effect 의 분담을 읽어라
- `/src/lib/__tests__/use-measured-height.test.tsx` — 훅이 이미 보장하는 계약. 여기서 중복해 검증하지 않기 위해 읽는다
- `/src/components/templates/PageHeader/PageHeader.tsx` — **수정 대상**
- `/src/components/templates/PageHeader/__tests__/PageHeader.test.tsx` 와 `__snapshots__/` — 기존 계약
- 호출부 4개(수정하지 않지만 헤더 안에 무엇이 들고 나는지 확인하라):
  `/src/app/content-scheduler/ContentScreen.tsx` · `/src/app/content-scheduler/ContentManageScreen.tsx` ·
  `/src/app/boss-scheduler/BossScreen.tsx` · `/src/app/boss-scheduler/BossManageScreen.tsx`

## 배경 (이슈 #168)

`fixed` 헤더는 흐름에서 빠져 있고 목록은 **실측 높이 spacer** 로 자리를 받는다([[ADR-098]] 결정 2).
현재 `PageHeader` 의 측정 `useLayoutEffect` 는 deps 가 `[]` 라 **마운트 1회** 말고는 갱신 경로가
`ResizeObserver` 하나뿐이다. RO 콜백의 `setState` 는 React 이벤트 밖이라 다음 프레임에 렌더되므로,
헤더 높이가 바뀌는 커밋은 **옛 spacer 높이로 한 프레임 그려진다** — 목록이 아래에 그려졌다 올라온다.

**이 셸의 네 화면 모두 헤더 `children` 안에 높이를 바꾸는 조건부 블록이 있다:**

- `ContentScreen` — 셸 승계 로딩 카드(`characters.length === 0` 일 때만), 일간/주간 탭 줄
  (`characters.length > 0 && selected !== null` 일 때만)
- `BossScreen` — 로딩 카드, 탭 줄, 주간 클리어 카운트, 시즌 보스 줄
- `BossManageScreen` · `ContentManageScreen` — `selected !== null` 게이트 블록

즉 캐릭터 로드가 끝나 로딩 카드가 탭 줄로 바뀌는 **모든 콜드 스타트**가 이 전환을 탄다.
(사용자 보고는 보스 수익에서만 왔다 — 이쪽은 코드로 확인한 구조적 동일성이고 관측은 아직 없다.)

## 작업

### 1. `PageHeader.tsx` 를 훅으로 갈아 끼운다

`useRef`+`useState`+측정 `useLayoutEffect`(44~62행)를 걷어내고 `useMeasuredHeight` 를 쓴다.
셸 `<div>` 의 `ref` 에 훅이 준 콜백 ref 를, spacer `<div>` 의 `style.height` 에 훅이 준 높이를 건다.

**DOM 은 한 글자도 바뀌면 안 된다** — 클래스 문자열, 자식 순서, `aria-hidden`, 래퍼 `<div>` 구조
전부 그대로다. [[ADR-094]] 결정 4 의 안전장치가 정확히 이것이고, 기존 스냅샷 테스트가 지킨다.

주석을 갱신하라. 현재 44~47행 주석은 "`ResizeObserver` 로 계속 따라간다"고만 적혀 있는데, 그것이
**유일한 경로였던 것이 이 이슈의 원인**이었다. 두 경로의 분담(측정 effect = 렌더가 바꾸는 높이,
RO = 렌더 밖 변화)을 훅이 갖게 됐으므로, 여기 주석은 **왜 spacer 가 실측이어야 하는가**와
[[ADR-098]]·[[ADR-112]] 참조로 줄이고 측정 방식의 상세는 훅 파일에 맡겨라. 기존 계약
("`useEffect` 로 되돌리지 말 것", "`sticky` 로 되돌리지 말 것")은 지우지 마라.

호출부 4개는 **바뀌지 않는다**(`PageHeaderProps` 무변경). 열어서 확인만 하고 손대지 마라.

### 2. 회귀 가드 테스트 추가 — `PageHeader.test.tsx`

기존 `describe('PageHeader 스페이서')` 안에 이 이슈의 가드를 더한다:

- **헤더 내용이 바뀌어 높이가 줄면 spacer 도 같은 커밋에 줄어든다.**
  `rerender` 로 `children` 을 바꾸고(예: 탭 줄이 사라지는 상황) 스텁 높이를 A → B 로 바꿨을 때
  spacer 가 B 다. `vitest.setup.ts` 의 `ResizeObserver` 는 콜백을 부르지 않으므로, 통과한다는 것은
  측정 effect 가 그 일을 했다는 뜻이다. 주석에 `ADR-112` 와 이슈 #168, 그리고 "RO 스텁이 콜백을
  부르지 않는다"는 전제를 적어라 — 그 전제가 이 테스트의 판별력이다.

기존 `stubHeaderHeight` 헬퍼는 `mockReturnValue` 라 값을 바꾸려면 반환값을 다시 지정하거나 가변
변수를 읽는 구현으로 바꿔야 한다. **기존 테스트들이 이 헬퍼를 쓰고 있으니 시그니처를 깨지 마라** —
호출 형태(`stubHeaderHeight(148)`)는 유지한 채 여러 번 부를 수 있게만 만들어라.

### 3. 전체 스위트를 돌려 파급을 확인한다

`getBoundingClientRect` 를 전역 스파이로 스텁하는 테스트가 여럿 있다. 측정이 **매 커밋** 도는
쪽으로 바뀌므로, 그런 테스트에서 리렌더가 일어나면 spacer 높이가 이전과 다른 값이 될 수 있다.
깨지는 테스트가 있으면 **그 테스트가 지키려던 계약이 무엇이었는지 먼저 판별하라**:

- 계약이 여전히 유효한데 스텁 방식 때문에 깨진 것 → 스텁을 고쳐라.
- 계약 자체가 "spacer 는 리렌더에서 안 따라온다"였다면 → 그것이 바로 이 이슈가 고치는 버그다.
  테스트를 갱신하지 말고 **삭제하고 새 계약으로 다시 써라**(같은 이름을 남기면 다음 사람이 오독한다 —
  이전 phase 에서 실제로 그렇게 처리한 전례가 있다).

어느 쪽이든 판단 근거를 step 완료 시 `index.json` 에 note 로 남겨라.

## Acceptance Criteria

```bash
npm run build     # 타입 에러 없음
npm run lint      # 에러 0
npm test -- --run # 전부 통과 (기존 스냅샷 포함 — 스냅샷이 바뀌면 DOM 이 바뀐 것이므로 실패로 취급)
grep -q "useMeasuredHeight" src/components/templates/PageHeader/PageHeader.tsx
! grep -q "new ResizeObserver" src/components/templates/PageHeader/PageHeader.tsx  # 측정 로직은 훅으로 갔다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `git diff -- src/components/templates/PageHeader/__tests__/__snapshots__/` 가 **비어 있는지**
   확인한다. 비어 있지 않으면 DOM 이 바뀐 것이다 — `-u` 로 스냅샷을 갱신하지 말고 구현을 되돌려라.
3. `git diff --stat` 으로 바뀐 파일이 `PageHeader.tsx` 와 그 테스트로 한정되는지 확인한다
   (3번 작업으로 다른 테스트를 손댔다면 그 파일도 포함된다 — 제품 코드는 `PageHeader.tsx` 하나여야 한다).
4. 아키텍처 체크리스트:
   - `components/` 4계층 의존 방향 규칙을 지켰는가(templates → lib 은 허용된 방향이다).
   - CLAUDE.md CRITICAL 위반 없음.
5. 결과에 따라 `phases/header-spacer-sync/index.json` 의 step 2 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`BossProfitScreen.tsx` 를 건드리지 마라.** 이유: step 3 의 범위다. 두 호출부를 한 커밋에 바꾸면
  회귀가 어느 쪽에서 왔는지 diff 로 못 가른다.
- **호출부 4화면(`ContentScreen` 등)을 건드리지 마라.** 이유: `PageHeaderProps` 가 안 바뀌므로 고칠
  이유가 없다. 헤더 안 조건부 블록을 "정리"하려 들지 마라 — 그 가변성이 이 셸의 전제다.
- **DOM 스냅샷을 `-u` 로 갱신하지 마라.** 이유: 이 셸의 유일한 안전장치가 "렌더 결과 DOM 1:1 동일"
  이다([[ADR-094]] 결정 4). 스냅샷이 깨졌다면 갱신할 것이 아니라 구현이 틀린 것이다.
- **`sticky` 로 되돌리거나 spacer 를 없애지 마라.** 이유: `sticky` 요소의 화면 위치는 스크롤 오프셋의
  함수라, iOS 스크롤 스레드가 옛 오프셋을 되돌려 보내는 프레임에 헤더가 화면 밖으로 날아간다
  ([[ADR-085]] 실기기 계측 → [[ADR-098]]).
- **하단 페이드·`below` 슬롯·`ThemeHeaderBackdrop` 의 위치나 순서를 바꾸지 마라.** 이유: 페이드는
  `top-full` 로 셸 높이에 매여 있고 `below`(당김 인디케이터)는 `absolute` 라 **실측 높이를 바꾸지
  않는 것이 계약**이다([[ADR-072]] 결정 4) — 흐름 자식으로 옮기면 당길 때마다 측정이 발화한다.
- 기존 테스트를 깨뜨리지 마라.
