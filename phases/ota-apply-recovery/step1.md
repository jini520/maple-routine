# Step 1: boot-cover-failsafe

이 step 은 **`index.html` 하나와 그 테스트 하나만 만든다.** `src/` 의 기존 파일은 건드리지 않는다
(새 테스트 파일 `src/__tests__/index-html-boot-cover.test.ts` 만 추가한다).

## 이 step 이 끊는 고리

부팅이 어떤 이유로든 끝나지 못하면 `#boot-cover` 가 화면 전체를 덮은 채 **영원히 남는다.** 그것을
지우는 코드는 저장소 전체에서 `src/native/splash-screen.ts` 의 `hideSplashScreen()` 한 줄뿐이고,
그 호출은 `src/App.tsx` 의 `useEffect` 안 `setTimeout` 에 있어 **언마운트 클린업이 취소한다.** 즉
**앱이 죽으면 커버를 걷을 주체가 사라진다.** 이 step 은 커버를 걷는 주체를 **React 트리 밖(컴포넌트가
아닌 곳)** 에 하나 더 둔다 — 앱이 죽어도 살아남는 곳이다.

## 읽어야 할 파일

- `/docs/README.md` · `/docs/ADR.md`(**슬림 인덱스만** — 지정한 것만 열어라)
- `/docs/adr/ADR-117.md` — **step 0 이 만든 이 phase 의 계약**. 이 step 은 **결정 3** 이다
- `/docs/features/splash.md` — step 0 이 갱신한 스플래시 정책
- `/index.html` (전문 — 현재 `#boot-cover` div 와 넥슨 Analytics 스크립트가 있다)
- `/src/__tests__/index-html-analytics.test.ts` (**이 테스트의 형식을 그대로 따라 새 테스트를 써라** —
  `index.html` 을 `readFileSync` 로 읽어 단언하는 패턴)
- `/src/native/splash-screen.ts` (**읽기만** — 이 step 에서 고치지 않는다. 결정 4 는 step 3 몫이다)
- `/capacitor.config.ts` (`SplashScreen` 플러그인 설정 — `launchAutoHide: false`)

## 작업

TDD 다 — **테스트를 먼저 쓰고**, 그다음 `index.html` 을 고쳐 통과시켜라.

### 1. `index.html` — `#boot-cover` 실패 안전 타이머

`#boot-cover` div **바로 다음**에 인라인 `<script>` 를 넣어라(`type="module"` 이 아닌 고전 스크립트).
자리를 여기로 두는 이유는 커버를 만드는 곳과 걷는 곳이 붙어 있어야 한 눈에 읽히기 때문이다.

동작 규칙 — **이 셋을 정확히 지켜라**:

1. `setTimeout` **8000ms**. 이 숫자는 [[ADR-117]] 결정 3 이다.
2. 콜백은 **`#boot-cover` 가 아직 DOM 에 있을 때만** 동작한다. 없으면 **아무것도 하지 않는다**
   (네이티브 `hide()` 도 부르지 않는다).
3. 있을 때 하는 일은 둘: `#boot-cover` 제거 **그리고** 네이티브 스플래시 내리기 시도 —
   `window.Capacitor.Plugins.SplashScreen.hide()`. 후자는 **optional chaining + try/catch** 로 감싸라
   (웹 개발 서버에는 `window.Capacitor` 자체가 없고, 브릿지가 준비되지 않았을 수도 있다).

**네이티브 `hide()` 를 반드시 함께 부르는 이유**: DOM 커버만 걷어도 iOS 는 여전히 먹통이다.
`SplashScreen.show()` 가 `parentView.isUserInteractionEnabled = false` 를 걸어두고, 그것은 네이티브
`tearDown()`(= `hide()`)에서만 풀린다. 커버만 지우면 **화면은 보이는데 터치가 죽은** 상태가 된다.

**"아직 있을 때만" 가드를 빼지 마라.** 이유: 정상 부팅한 앱에서 사용자가 마침 8초 시점에
`지금 적용 (재시작)` 을 누르면, 그때 올라간 리로드 커버(`[data-splash-cover]`)와 네이티브 스플래시를
이 타이머가 걷어버린다. 그 구간의 안전망은 step 4 의 12초 타임아웃이 따로 맡는다.

스크립트 위에 **왜 이것이 컴포넌트가 아니라 `index.html` 에 있는지**를 주석으로 남겨라 — React 트리
안에 있으면 앱이 죽을 때 함께 죽어서 아무 소용이 없다는 것. 이 저장소의 주석 밀도(기존 `#boot-cover`
주석 참고)에 맞춰라.

### 2. 테스트 — `src/__tests__/index-html-boot-cover.test.ts`

`index-html-analytics.test.ts` 와 같은 골격(`readFileSync` + `@vitest-environment jsdom`)으로 쓰되,
**정적 문자열 검사에서 멈추지 마라. 스크립트를 실제로 실행해 동작을 단언하라.**

- `index.html` 에서 인라인 스크립트 본문을 정규식으로 뽑아 `new Function(...)`(또는 동등한 수단)으로
  jsdom 안에서 실행한다.
- `vi.useFakeTimers()` 로 8초를 전진시킨다.
- **케이스 A — 부팅 실패**: `#boot-cover` 를 DOM 에 올려둔 채 8초 전진 → 커버가 **제거되고**
  `window.Capacitor.Plugins.SplashScreen.hide` 가 **1회** 호출된다.
- **케이스 B — 정상 부팅**: 커버가 없는 상태로 8초 전진 → `hide` 가 **호출되지 않는다**.
  (이 케이스가 "아직 있을 때만" 가드의 회귀 테스트다.)
- **케이스 C — 7.9초에는 아직**: 7,900ms 전진 시점에는 커버가 그대로 있다. 상수가 조용히
  줄어드는 것을 막는다.
- **케이스 D — `window.Capacitor` 가 없어도 던지지 않는다**: 웹 개발 서버 상황. 커버는 제거되고
  예외는 나지 않는다.

## Acceptance Criteria

```bash
npm run build
npm test
npm run lint                                    # errors 0 (warnings 17 은 baseline)
grep -q '8000' index.html                       # 실패 안전 타이머 상수가 있다
grep -q 'boot-cover' dist/index.html            # 빌드 산출물에도 살아남았다(Vite 가 인라인 스크립트를 지우지 않는다)
# 이 step 은 index.html 과 새 테스트 파일 밖을 건드리지 않는다
git status --porcelain -- src/ | grep -v '__tests__/index-html-boot-cover.test.ts' | wc -l   # 0
```

## 검증 절차

1. 위 AC 를 전부 실행한다.
2. **판별력을 확인하라**(결과를 summary 에): 스크립트에서 "`#boot-cover` 가 있을 때만" 가드를 빼면
   **케이스 B 만** 실패하는가? 실패하지 않으면 그 테스트는 가드를 지키지 못하는 것이다. 확인 후 되돌려라.
3. `npm run build` 뒤 `dist/index.html` 을 눈으로 열어 스크립트가 온전히 들어갔는지 확인하라 —
   Vite 가 인라인 고전 스크립트를 건드리지 않는다는 전제가 맞는지 실제로 보는 것이다.
4. 아키텍처 체크: CLAUDE.md CRITICAL 규칙 위반 없음(이 스크립트는 `features/` 코드가 아니라
   문서 셸이므로 어댑터 레이어 규칙의 대상이 아니다 — 다만 **앱 코드에서 이 스크립트를 참조하지 마라**).
5. `phases/ota-apply-recovery/index.json` 의 step 1 갱신 — summary 에 **타이머 상수(8000)와 가드
   조건**, 새 테스트 파일 경로를 담아라.

## 금지사항

- **`src/native/splash-screen.ts` 를 고치지 마라.** 이유: 결정 4(`[data-splash-cover]` 정리)는 step 3
  몫이고, 두 step 이 같은 파일을 만지면 변경 범위 AC 가 서로를 깬다.
- **`src/App.tsx` 의 스플래시 `useEffect` 를 고치지 마라.** 이유: 그 타이머의 클린업은 React 관행상
  옳다. 이 step 은 그 타이머를 **대체하는 게 아니라** 트리 밖에 백스톱을 하나 더 두는 것이다.
- **타이머를 `hideSplashScreen()` 이나 앱 코드에서 취소하게 만들지 마라.** 이유: 취소 수단을 만들면
  전역(`window.__…`)이 하나 생기고 앱↔셸 결합이 늘어난다. "커버가 있을 때만" 가드가 같은 일을
  결합 없이 해낸다.
- **`type="module"` 로 만들지 마라.** 이유: 모듈 스크립트는 defer 되고 Vite 의 변환 대상이 된다 —
  앱 번들이 깨졌을 때도 반드시 도는 것이 이 스크립트의 존재 이유다.
- **8000 을 다른 값으로 바꾸지 마라.** 이유: [[ADR-117]] 결정 3 에서 확정됐다(사용자 결정).
- 기존 테스트를 깨뜨리지 마라 — 특히 `src/__tests__/index-html-analytics.test.ts`.
