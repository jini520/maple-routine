# Step 0: adr-docs

이 step 은 **문서만** 바꾼다. 제품 코드·테스트 파일은 한 줄도 건드리지 마라.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 아래 지정한 ADR 만 `/docs/adr/ADR-NNN.md` 로 열어라. 전체를 컨텍스트에 올리지 말 것)
- `/docs/adr/ADR-085.md` — 이 결함이 사는 구조(`fixed` 헤더 + 실측 spacer)를 만든 결정. **결정 1**과 **트레이드오프 절의 세 번째 항목**("spacer 는 실측값에 의존한다")을 정확히 읽어라
- `/docs/adr/ADR-098.md` — 같은 처방을 공용 `PageHeader` 로 넓힌 결정(**결정 2**)
- `/docs/adr/ADR-102.md` — React 18 이 이벤트 밖 `setState` 를 Scheduler(MessageChannel) 태스크로 넘겨 **한 프레임 늦게** 그리는 성질을 이 프로젝트에서 실제로 관측한 ADR. 이번 원인과 같은 성질이다
- `/docs/features/boss-profit.md` — "화면 구조·스크롤" 절(현재 145행 부근, `stickyHeaderHeight` 를 설명하는 문단)
- `/docs/foundation/design-system.md` — "스크롤 영역" 절(현재 242~260행)
- `/src/app/boss-profit/BossProfitScreen.tsx` — 510~526행(측정 `useLayoutEffect`), 744행(`!isPeriodLoading` 게이트), 807행(spacer)
- `/src/components/templates/PageHeader/PageHeader.tsx` — 44~62행(측정 `useLayoutEffect`), 94행(spacer)

## 배경 — 무엇을 문서화하는가 (이슈 #168)

보스 수익에서 **기록이 없는 과거 기간으로 이동**하면 `지난 주 기록을 불러오고 있어요` 카드가
**한 프레임 아래쪽(~90px)에 그려졌다가 제자리로 올라온다.** 같은 카드가 자리를 옮기는 것이지
내용이 바뀌는 것이 아니다.

**원인 사슬:**

1. 기간을 이동하면 스토어가 `isPeriodLoading: true` 로 바꾼다(`features/boss-profit/store.ts`).
2. 헤더 안의 총 수익 헤드라인 블록이 `!isPeriodLoading` 게이트에 걸려 사라진다
   (`BossProfitScreen.tsx:744`) → **헤더 DOM 이 약 91px 짧아진다**
   (라벨행 `h-6` 24 + `mt-1.5` 6 + 금액행 `h-8` 32 + `mt-3` 12 + 헤어라인 1 + 부모 `space-y-4` 16).
3. 그런데 spacer 높이(`stickyHeaderHeight`)는 아직 옛 값이다 — 측정 `useLayoutEffect` 의 deps 가
   `[isEmpty]` 하나뿐이라 이 전환에서 재실행되지 않는다.
4. **이 상태로 한 프레임이 그려진다** ← 카드가 ~90px 아래.
5. `ResizeObserver` 가 발화해 `setState` → 다음 렌더에 spacer 가 줄고 카드가 제자리로 튀어 오른다.

**핵심은 갱신 경로가 `ResizeObserver` 하나뿐이라는 것이다.** RO 콜백 자체는 스펙상 페인트 *전*에
배달되지만, 그 안의 `setState` 는 React 이벤트 밖이라 React 가 Scheduler 태스크로 넘겨 **다음
프레임**에 렌더한다([[ADR-102]] 가 접기에서 관측한 그 성질이다). 반면 `useLayoutEffect` 안의
`setState` 는 같은 커밋에서 페인트 전에 동기 반영된다.

**이슈에 '미확인'으로 적힌 두 가지는 코드 확인으로 답이 나왔다 — ADR 에 사실로 적어라:**

- *기록이 있는 기간에서도 같은 프레임이 나는가* → **난다.** 헤드라인 게이트는 `!isPeriodLoading`
  하나뿐이라 기록 유무와 무관하게 헤더가 짧아진다. 다만 기록이 있으면 곧이어 캐릭터 카드가 들어차
  튐이 콘텐츠 변화에 섞여 **눈에 덜 띌 뿐**이다.
- *공용 `PageHeader` 도 같은 문제인가* → **같다.** deps 가 `[]` 라 마운트 1회 외엔 갱신 경로가 RO
  하나뿐인데, 네 화면 전부 헤더 `children` 안에 조건부 블록이 있다:
  - `ContentScreen` — 셸 승계 로딩 카드(`characters.length === 0`), 일간/주간 탭 줄
  - `BossScreen` — 로딩 카드, 탭 줄, 주간 클리어 카운트, 시즌 보스 줄
  - `BossManageScreen` · `ContentManageScreen` — `selected !== null` 게이트 블록
  즉 **사용자 보고는 아직 없지만 결함은 구조적으로 같다**(브라우저·실기기 관측은 아직 없음 —
  이 사실을 그대로 적어라. 관측했다고 쓰지 마라).

## 채택된 처방 (사용자 승인 완료)

**후보 1 — 측정 전용 layout effect 를 deps 없이 따로 둔다.** `ResizeObserver` 는 남긴다.

```
측정 effect  : deps 없음 → 매 커밋 페인트 전 getBoundingClientRect().height
관찰 effect  : ResizeObserver → 렌더 밖 변화(폰트 로드·기기 회전) 담당
```

**공용 훅 `src/lib/use-measured-height.ts` 로 추출해 호출부 두 곳이 같이 쓴다**(`PageHeader`,
`BossProfitScreen`). [[ADR-094]] 가 정한 조건 두 개를 다 충족한다 — 호출부 2곳 이상이고, 실측+spacer
는 [[ADR-085]]·[[ADR-098]] 이 실기기에서 여러 번 틀린 끝에 얻은 취약 구조다.

훅의 API 는 **`RefObject` 가 아니라 콜백 ref** 다:

```ts
export function useMeasuredHeight<T extends HTMLElement>(): {
  ref: (node: T | null) => void
  height: number
}
```

콜백 ref 인 것이 설계의 핵심이다 — 요소를 state 로 잡아야 관찰 effect 가 요소의 등장·소멸을 따라
재부착되고, 그래야 `BossProfitScreen` 의 `[isEmpty]` deps 가 **사라진다**(빈 상태에서 헤더가
언마운트되는 그 경로를 훅이 구조적으로 처리한다).

**기각한 대안 — ADR 에 이유와 함께 남겨라:**

- **deps 목록 명시**(`isPeriodLoading`·`characterGroups.length > 0`·`periodState`·`canRefreshPeriod`)
  → 헤더에 조건부 블록이 추가될 때마다 deps 를 같이 고쳐야 하고, 빠뜨리면 같은 버그가 조용히
  되살아난다. 무엇보다 **공용 `PageHeader` 는 `children` 이 임의라 이 방식이 원리적으로 불가능하다.**
- **헤더 높이를 상태와 무관하게 고정**(로딩 중에도 헤드라인 자리 예약) → 튐이 원천적으로 없어지지만
  로딩 중 ~90px 빈 블록이 남는 디자인 변경이고, `PageHeader` 의 탭·필터·로딩 카드에는 적용할 수
  없어 화면 전용 처방이 된다.
- **`ResizeObserver` 콜백의 `setState` 를 `flushSync` 로 감싼다** → 같은 프레임에 반영되긴 하나 RO
  broadcast 루프 안에서 렌더+레이아웃을 다시 돌려 `ResizeObserver loop` 경고 계열의 위험을 새로
  들인다. 측정 effect 쪽이 같은 효과를 더 단순하게 낸다.
- **spacer 를 없애고 헤더를 흐름 안으로 되돌린다** → [[ADR-085]] 결정 1 이 iOS 실기기에서 `sticky`
  헤더가 화면 밖(`-1065px`)으로 날아가는 문제를 풀려고 `fixed` 로 옮긴 것이라, 되돌리면 더 큰 문제가
  살아난다. **기각이 아니라 금지에 가깝다.**

**대가(반드시 적어라):** 커밋마다 `getBoundingClientRect()` 1회 = 강제 리플로우 1회. 당겨서 새로고침
드래그는 목록에 `transform` 만 걸어 레이아웃을 더럽히지 않으므로 캐시된 레이아웃 값이 돌아온다 —
[[ADR-072]] 결정 4·[[ADR-073]] 이 지킨 "터치 프레임마다 리플로우 없음"은 유지된다. 다만 흐름·크기를
바꾸는 방식으로 되돌리면 이 대가가 실제 비용이 된다.

## 작업

### 1. `docs/adr/ADR-112.md` 신설

번호는 **112** 다(현재 `docs/adr/` 최신이 ADR-111). 기존 ADR 파일의 형식을 따라라 — 제목 한 줄,
`- 상태:` / `- 관련:` / `- 관련 문서:` 머리, 그다음 본문.

- 상태: **설계·구현 전** (2026-08-08, 이슈 #168) — 이 step 은 문서만 쓴다. step 4 가 '구현 완료'로 고친다.
- 관련: [[ADR-085]] 결정 1 · [[ADR-098]] 결정 2 · [[ADR-102]](같은 React 프레임 지연 성질) ·
  [[ADR-047]](중첩 sticky 가 이 실측값을 오프셋으로 쓴다) · [[ADR-094]](공용 훅 추출 기준) ·
  [[ADR-061]] 결정 2(셸 승계 로딩 카드 — 증상이 보이는 자리) · [[ADR-072]] 결정 4·[[ADR-073]](리플로우 예산)
- 관련 문서: `features/boss-profit.md` · `foundation/design-system.md`

본문에 담을 것 — 위 "배경"의 원인 사슬 5단계, 이동량 ~91px 내역, '미확인' 2건에 대한 코드 확인 결과,
채택 처방과 훅 API, 기각한 대안 4개와 각각의 이유, 대가.

**적지 말아야 할 것:** 실기기·브라우저에서 관측했다는 서술. 이 ADR 시점의 근거는 **이슈 보고 1건
(보스 수익, 기록 없는 과거 기간)과 코드 읽기**뿐이다. 공용 `PageHeader` 쪽은 "구조적으로 같으나
관측은 없음"으로 명시하라. 이 프로젝트는 브라우저에서 멀쩡하던 것이 실기기에서 깨진 이력이 반복됐다
([[ADR-079]]·[[ADR-085]]·[[ADR-098]]) — 확인하지 않은 것을 확인한 것처럼 쓰면 다음 사람이 잘못된
전제 위에서 판단한다.

### 2. `docs/ADR.md` 인덱스에 한 줄 추가

파일 맨 아래 ADR-111 행 다음에 같은 형식으로 한 줄. 인덱스 행은 **그 자체로 결정을 읽을 수 있을
만큼** 밀도 있게 쓰는 것이 이 파일의 관례다(ADR-111 행을 본보기로 삼아라).

### 3. `docs/features/boss-profit.md` 갱신

"화면 구조·스크롤" 절의 `stickyHeaderHeight` 문단(현재 145행 부근)에 **높이 실측이
`useLayoutEffect` 인 이유**가 이미 적혀 있다("`useEffect` 로 되돌리면 첫 프레임에 spacer 가 0이라
목록이 위로 튄다"). 그 자리에 이번 결정을 이어 붙여라 — **갱신 경로가 `ResizeObserver` 하나면
헤더 높이를 바꾸는 상태 전환마다 한 프레임 어긋난다**는 사실과, 그래서 측정 전용 effect 를 deps 없이
따로 두고 RO 는 렌더 밖 변화 담당으로 남긴다는 것. 공용 훅 `lib/use-measured-height.ts` 이름을 명시하라.

기존 문장을 지우지 마라 — [[ADR-085]]·[[ADR-098]] 이 세운 계약("sticky 로 되돌리지 말 것",
"`useEffect` 로 되돌리지 말 것")은 그대로 살아 있다. 여기에 조건이 하나 더해지는 것이다.

### 4. `docs/foundation/design-system.md` 갱신 (2곳)

**(a) 258행 문단** — 현재:

> **높이 실측은 `useLayoutEffect` + `ResizeObserver` 로 `PageHeader` 안에서 끝낸다** — `useEffect` 로
> 재면 첫 프레임에 spacer 가 0이라 목록이 위로 튄다. 화면별로 재게 만들지 말 것.

여기에 **두 effect 의 역할 분담**을 명시하라: 측정은 deps 없는 layout effect(매 커밋), RO 는 렌더 밖
변화 전용. 그리고 "`PageHeader` 안에서 끝낸다"는 이제 "공용 훅 `lib/use-measured-height.ts` 로
끝낸다"로 정확해진다(보스 수익도 같은 훅을 쓰므로).

**(b) 249행 다이어그램 주석** — `spacer: 흐름에서 빠진 헤더 자리 — ResizeObserver 실측 높이` 에서
"ResizeObserver 실측 높이"는 이제 부정확하다. 실측 경로가 둘임이 드러나게 고쳐라.

**(c) 243행 낡은 문장 정정 (사용자 승인 완료)** — 현재 절 마지막의

> 보스 수익은 아직 문서 스크롤이다(전환 범위 밖).

는 [[ADR-100]] 으로 **틀린 문장**이다(보스 수익도 `ScreenScroll` 을 쓴다 — `docs/features/boss-profit.md`
145행이 이미 그렇게 적고 있다). 이슈 #168 과 무관한 정정이지만 같은 절을 손대므로 함께 바로잡는다.
[[ADR-100]] 을 인용해 한 줄로 고쳐라. **이 절 밖의 다른 문장은 건드리지 마라.**

### 5. 각 문서의 "폐기된 정책 (history)" 처리

이번 변경은 **기존 정책을 뒤집지 않는다** — [[ADR-085]]·[[ADR-098]] 의 계약에 갱신 경로를 하나 더하는
것이다. 따라서 history 로 옮길 항목은 원칙적으로 없다. 단 (c)의 "보스 수익은 아직 문서 스크롤"은
사실이 바뀐 문장이므로 `design-system.md` 의 history 절 관례에 맞게 처리하라(그 절에 이미
[[ADR-098]]·[[ADR-073]] 관련 `~~취소선~~` 항목이 있다 — 같은 형식).

## Acceptance Criteria

```bash
test -f docs/adr/ADR-112.md                                   # ADR 파일 존재
grep -q "ADR-112" docs/ADR.md                                 # 인덱스에 한 줄
grep -q "use-measured-height" docs/foundation/design-system.md # 훅 이름 명시
grep -q "use-measured-height" docs/features/boss-profit.md     # 훅 이름 명시
! grep -q "보스 수익은 아직 문서 스크롤이다" docs/foundation/design-system.md  # 낡은 문장 정정
npm run build                                                  # 문서만 바꿨으므로 당연히 통과해야 한다
npm test -- --run                                              # 2,515개 그대로 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `git diff --stat` 으로 **`docs/` 밖 파일이 하나도 안 바뀌었는지** 확인한다.
3. 아키텍처 체크리스트:
   - ADR 형식이 기존 파일들(`docs/adr/ADR-111.md` 등)과 같은가?
   - CLAUDE.md 의 "옛 내용을 지우지 말고 history 로" 규칙을 지켰는가?
4. 결과에 따라 `phases/header-spacer-sync/index.json` 의 step 0 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **제품 코드(`src/`)를 건드리지 마라.** 이유: 이 step 은 docs-first 단계이고, 구현은 step 1~3 이 한다.
  문서와 코드가 한 커밋에 섞이면 "결정이 먼저였는가"가 diff 에서 사라진다.
- **ADR 상태를 '구현 완료'로 쓰지 마라.** 이유: 아직 코드가 없다. step 4 가 실제 테스트 수를 확인한 뒤 고친다.
- **실기기·브라우저 관측을 지어내지 마라.** 이유: 이 프로젝트는 브라우저에서 멀쩡하던 것이 실기기에서
  깨진 이력이 반복됐다 — 근거의 출처가 흐려지면 다음 판단이 통째로 틀어진다.
- **[[ADR-085]]·[[ADR-098]] 의 기존 계약(`fixed` 유지, `useEffect` 금지)을 삭제하거나 약화시키지 마라.**
  이유: 이번 결정은 그 위에 얹히는 것이지 대체하는 것이 아니다.
- **`design-system.md` "스크롤 영역" 절 밖의 문장을 정리하지 마라.** 이유: 사용자 전역 규칙 — 요청한
  변경 외의 인접 문서를 임의로 손대지 않는다.
