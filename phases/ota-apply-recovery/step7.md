# Step 7: error-boundary-cover

이 step 은 **`src/components/organisms/ErrorBoundary/ErrorBoundary.tsx` 와 그 테스트만 고친다.**

## 이 step 이 끊는 고리

ErrorBoundary 폴백은 **가장 필요한 순간에 무용지물**이다. 부팅 크래시 때 셋이 겹친다:

1. **커버가 안 걷힌다.** `#boot-cover` 를 지우는 코드는 저장소 전체에서 `hideSplashScreen()` 한
   줄뿐인데, 그 호출은 `src/App.tsx` 의 `useEffect` 안 `setTimeout` 에 있고 **클린업이 취소한다.**
   첫 1초(`MIN_SPLASH_MS`) 안에 렌더가 던지면 → 바운더리가 `AppShell` 을 언마운트 → 타이머 취소 →
   **커버는 영원히 남는다.**
2. **폴백이 커버 밑에 그려진다.** 폴백은 `#root` 안이고 `#boot-cover` 는 `index.html` 의
   `position:fixed; z-index:2147483647`(32비트 정수 최댓값)이다.
3. **버튼이 눌리지 않는다.** iOS `SplashScreen.show()` 가 건 `parentView.isUserInteractionEnabled
   = false` 는 네이티브 `tearDown()`(= `hide()`)에서만 풀린다.

즉 **폴백은 안 보이고 '다시 시작' 은 눌리지도 않는다.** [[ADR-065]] 결정 5 가 "흰 화면을 없앤다"고
넣은 장치가 정작 부팅 크래시에서 아무 일도 못 한다.

`hideSplashScreen()` 한 번이 셋을 동시에 끊는다 — DOM 커버 제거(1) → 위에 아무것도 없어지고(2) →
네이티브 `hide()` 가 터치를 되살린다(3).

## 읽어야 할 파일

- `/docs/README.md` · `/docs/ADR.md`(**슬림 인덱스만** — 지정한 것만 열어라)
- `/docs/adr/ADR-117.md` — **이 phase 의 계약**. 이 step 은 **결정 6** 이다(**z-index 를 올리는 안이
  왜 기각됐는지** 거기 적혀 있다 — 읽고 그 선을 지켜라)
- `/docs/adr/ADR-065.md` 결정 5 — 폴백을 **최소로** 두기로 한 근거(아이콘 + 제목 + 짧은 설명 +
  '다시 시작' 하나뿐. 설정 열기도 스택트레이스도 브랜드 마크도 넣지 않는다)
- `/docs/adr/ADR-094.md` 결정 2 — 아토믹 계층의 의존 방향(이 컴포넌트는 organism 이다)
- `/docs/features/splash.md` — step 0 이 갱신한 스플래시 정책(스플래시를 내리는 주체가 둘이 된다)
- `/src/components/organisms/ErrorBoundary/ErrorBoundary.tsx` (**전문** — 주석 포함 82줄)
- `/src/components/organisms/ErrorBoundary/__tests__/ErrorBoundary.test.tsx` (**전문**)
- `/src/native/splash-screen.ts` — **step 3 이 `hideSplashScreen()` 을 `#boot-cover` +
  `[data-splash-cover]` 둘 다 걷게 만들어뒀다.** DOM 제거는 어떤 `await` 보다 먼저 실행된다
- `/src/components/__tests__/layer-dependencies.test.ts` (**읽기만** — 계층 규칙을 확인하라.
  이 테스트는 `atoms/molecules/organisms/templates` 사이의 방향만 강제하고 `native/` import 는
  대상이 아니다. 즉 organism 이 `native/` 어댑터를 쓰는 것은 위반이 아니다)

## 작업

TDD 다 — **테스트를 먼저 고치고/쓰고**, 그다음 구현이 통과하게 만들어라.

### 1. 폴백이 뜰 때 `hideSplashScreen()` 을 부른다

- 호출 자리는 **`componentDidCatch`**(이미 있는 훅) 또는 폴백이 마운트되는 시점 중 재량이되,
  **폴백이 화면에 뜨는 모든 경로에서 반드시 한 번 불려야 한다.**
- **던져도 폴백 렌더를 막으면 안 된다** — `.catch(() => {})` 로 삼켜라. 근거: 이 순간 사용자에게
  필요한 것은 화면이지 정확한 실패 처리가 아니다.
- `native/splash-screen` 을 **어댑터로서** import 하라(`@capacitor/*` 직접 import 금지 —
  CLAUDE.md CRITICAL).
- 주석으로 **왜 바운더리가 스플래시를 내리는지**를 남겨라 — 위 "끊는 고리" 셋을 짧게. 특히
  **터치가 죽어 있다**는 사실(폴백이 보여도 버튼이 안 눌린다)이 이 호출의 진짜 이유임을 적어라.

### 2. 테스트 — `ErrorBoundary.test.tsx`

- **폴백이 뜨면 `hideSplashScreen` 이 1회 불린다** (`native/splash-screen` 을 mock).
- **예외가 없으면 불리지 않는다.**
- **`hideSplashScreen` 이 reject 해도 폴백은 정상적으로 그려지고 테스트가 unhandled rejection 으로
  깨지지 않는다.**
- 기존 케이스(정상 children 렌더 · 폴백 렌더 · `다시 시작` → `onRestart`)는 **그대로 통과**해야 한다.

## Acceptance Criteria

```bash
npm run build
npm test
npm run lint                                    # errors 0 (warnings 17 은 baseline)
grep -q 'hideSplashScreen' src/components/organisms/ErrorBoundary/ErrorBoundary.tsx
grep -c 'z-index\|zIndex\|z-\[' src/components/organisms/ErrorBoundary/ErrorBoundary.tsx   # 0 — 결정 6이 기각한 안
# 이 step 은 ErrorBoundary 디렉터리 밖을 건드리지 않는다
git status --porcelain -- src/ | grep -v 'organisms/ErrorBoundary' | wc -l    # 0
```

## 검증 절차

1. 위 AC 를 전부 실행한다.
2. **판별력을 확인하라**(결과를 summary 에): `hideSplashScreen()` 호출을 빼면 해당 케이스만
   실패하는가? 확인 후 되돌려라.
3. 계층 체크: `npm test -- layer-dependencies` 가 통과하는가. organism 이 상위 계층
   (`templates/`)을 import 하지 않았는가.
4. `phases/ota-apply-recovery/index.json` 의 step 7 갱신 — summary 에 **호출 자리(어느 훅인지)** 와
   **z-index 를 올리지 않았다**는 사실을 담아라.

## 금지사항

- **폴백에 z-index 를 주지 마라.** 이유: [[ADR-117]] 결정 6 에서 기각됐다(사용자 결정) — ⑴ `#boot-cover`
  가 이미 32비트 정수 최댓값이라 더 올릴 수 없고 DOM 순서에 기대야 하며, ⑵ 같은 매직 넘버가 두 곳에
  생겨 한쪽만 바뀌면 조용히 깨지고, ⑶ 보이게 만들어도 터치가 죽어 있어 문제가 안 풀린다.
- **폴백의 내용을 늘리지 마라** — 아이콘·제목·설명·'다시 시작' 하나. 이유: [[ADR-065]] 결정 5 가
  "복구 도구를 주는 게 아니라 흰 화면을 없애는 것"으로 목적을 좁혔다.
- **`src/App.tsx` 의 스플래시 `useEffect` 를 고치지 마라.** 이유: 이 step 의 범위 밖이고, 그 타이머의
  클린업은 React 관행상 옳다. 이 step 은 **크래시 경로에 별도의 걷는 주체를 세우는 것**이다.
- **`native/splash-screen.ts` 를 고치지 마라.** 이유: step 3 이 확정했다.
- **크래시 리포팅(Sentry 등)을 도입하지 마라.** 이유: opt-in 토글·전송 항목을 먼저 정해야 한다
  (`foundation/error-resilience.md` 원칙 7, 기존 주석 참고).
- 기존 테스트를 깨뜨리지 마라.
