# Step 6: notify-ready-move

이 step 은 **`src/main.tsx` 와 `src/App.tsx` 두 파일만 고친다** — capgo 의 자동 롤백을 되살린다.
`native/`·`features/` 는 건드리지 않는다.

## 이 step 이 끊는 고리

`src/main.tsx` 가 번들의 **첫 문장**으로 `notifyLiveUpdateReady()`(= `CapacitorUpdater.notifyAppReady()`)
를 부른다:

```ts
// notifyAppReady는 네트워크 요청 이전, 번들 실행 직후 가장 먼저 호출해야 한다 —
// 타임아웃 안에 호출하지 않으면 플러그인이 직전 정상 번들로 자동 롤백한다(ADR-022).
void notifyLiveUpdateReady()
```

capgo 의 **유일한** 안전망은 "`appReadyTimeout` 안에 `notifyAppReady` 가 없으면 직전 정상 번들로
되돌린다" 다. `capacitor.config.ts` 에 이 값을 설정하지 않았으므로 **기본값 10초**가 적용된다.
그런데 위 코드는 **렌더 한 픽셀 전에** "정상"을 선언한다. 실측 로그에서도 첫 렌더보다 먼저
`Setting status for bundle […] to SUCCESS` 가 찍힌다. **한 번 SUCCESS 로 찍힌 번들은 이후 어떤
실행에서도 롤백되지 않는다** — 메인 청크만 로드되고 그 뒤에 죽는 번들은 **영구히 박힌다.**

위 주석은 이 호출을 **롤백을 피하려고** 앞당긴 근거로 적혀 있다. 그런데 롤백은 피해야 할 사고가
아니라 **우리가 유일하게 가진 복구 장치**다. **의도가 뒤집혀 있다** — 주석도 함께 고친다.

## 읽어야 할 파일

- `/docs/README.md` · `/docs/ADR.md`(**슬림 인덱스만** — 지정한 것만 열어라)
- `/docs/adr/ADR-117.md` — **이 phase 의 계약**. 이 step 은 **결정 2** 다(채택하지 않은 안 — 하이드
  레이션 완료 뒤로 옮기기 — 의 기각 사유도 거기 적혀 있다. 읽고 그 선을 지켜라)
- `/docs/adr/ADR-022.md` — capgo 채택과 `notifyAppReady` · `/docs/adr/ADR-026.md` — `checkOnBoot`
- `/docs/features/live-update.md` — step 0 이 갱신한 정책
- `/src/main.tsx` (**전문** — 짧다)
- `/src/App.tsx` — 특히 **`AppShell`(177행 부근)** 과 **`App`(362행 부근, `ErrorBoundary` →
  `BrowserRouter` → `AppShell` 구조)**, 그리고 스플래시 `useEffect`(`MIN_SPLASH_MS`)
- `/src/native/live-update.ts` 의 `notifyLiveUpdateReady` (**읽기만**)
- `/src/__tests__/App.test.tsx` (**전문** — 무엇이 mock 돼 있는지 파악하라)

## 작업

TDD 다 — **테스트를 먼저 고치고/쓰고**, 그다음 구현이 통과하게 만들어라.

### 1. `main.tsx` — 호출을 걷어낸다

- `void notifyLiveUpdateReady()` 와 그 위 주석 2줄을 **제거**하고, 쓰이지 않게 된 import 도 지워라
  (내 변경이 만든 orphan 은 내가 치운다).
- **`void useLiveUpdateStore.getState().checkOnBoot()` 는 그대로 둬라.** 이유: 그것은 부팅 백그라운드
  체크([[ADR-026]])로 이 phase 와 무관하다.

### 2. `App.tsx` — `AppShell` 의 마운트 `useEffect` 로 옮긴다

**반드시 `AppShell` 안에 넣어라. `App` 안에 넣지 마라.**

이유를 정확히 이해하고 가라: `App` 은 `ErrorBoundary` 를 **렌더하는** 컴포넌트라, 자식인 `AppShell`
이 렌더 중 던져도 `App` 자신은 정상 커밋되고 **그 effect 는 실행된다.** 그러면 앱이 부팅 크래시로
죽었는데도 "정상"을 선언하게 돼 이 step 이 아무 일도 하지 않은 것이 된다. `AppShell` 은
`ErrorBoundary` **안**이라 렌더가 던지면 커밋되지 않고, 그 effect 도 돌지 않는다 — 그것이
"첫 렌더 커밋 = 정상" 의 정의를 성립시킨다.

- 의존성 배열 `[]` 의 `useEffect` 하나. 다른 effect 와 합치지 마라(관심사가 다르다).
- **스플래시 `useEffect`(`MIN_SPLASH_MS`) 안에 끼워 넣지 마라.** 그것은 1초 지연 타이머이고
  클린업이 타이머를 취소한다 — 취소되면 이 호출도 함께 사라진다.
- 주석으로 **왜 여기인지**를 남겨라: ⑴ 롤백은 사고가 아니라 유일한 복구 장치라는 것, ⑵ `AppShell`
  이어야 하는 이유(위 문단), ⑶ 왜 하이드레이션 완료 뒤가 아닌지([[ADR-117]] 결정 2 — `appReadyTimeout`
  10초 안에 못 부르면 **정상 번들도 롤백**되고, `prehydrateTabStores` 는 SQLite 에 의존하는데 이
  저장소는 그 호출이 응답 없이 멈춘 사례를 두 번 기록했다).

### 3. 테스트

`src/__tests__/App.test.tsx` 에:

- **정상 마운트**: `<App />` 을 렌더하면 `notifyLiveUpdateReady` 가 **1회** 호출된다.
- **크래시 회귀(이 step 의 핵심)**: `AppShell` 이 렌더 중 던지도록 만들고(`AppShell` 이 쓰는 의존
  하나를 던지게 mock 하는 등 — 방식은 재량이다) `<App />` 을 렌더하면, ErrorBoundary 폴백이 뜨고
  **`notifyLiveUpdateReady` 는 호출되지 않는다.** 이 케이스가 없으면 이 step 은 검증되지 않은 것이다.
  (React 가 바운더리로 잡은 예외를 콘솔에 한 번 더 뱉으므로 기존 파일들처럼
  `vi.spyOn(console, 'error')` 로 눌러라.)
- **`main.tsx` 가 더 이상 부르지 않는다**: `main.tsx` 는 사이드이펙트 모듈이라 import 로 테스트하기
  까다롭다 — 소스를 읽어 단언하는 방식(`readFileSync` + `notifyLiveUpdateReady` 부재)으로 충분하다.
  `src/__tests__/index-html-analytics.test.ts` 가 같은 계열의 선례다.

## Acceptance Criteria

```bash
npm run build
npm test
npm run lint                                    # errors 0 (warnings 17 은 baseline)
grep -c 'notifyLiveUpdateReady' src/main.tsx     # 0
grep -c 'notifyLiveUpdateReady' src/App.tsx      # 2 이상 (import + 호출)
grep -q 'checkOnBoot' src/main.tsx               # 그대로 남아 있다
# 이 step 은 main.tsx · App.tsx · 그 테스트 밖을 건드리지 않는다
git status --porcelain -- src/ | grep -v 'src/main.tsx' | grep -v 'src/App.tsx' | grep -v '__tests__/App.test.tsx' | wc -l   # 0
```

## 검증 절차

1. 위 AC 를 전부 실행한다.
2. **판별력을 확인하라**(결과를 summary 에): 호출을 `AppShell` 에서 `App` 으로 옮기면
   **크래시 회귀 케이스만** 실패하는가? 실패하지 않으면 그 테스트는 이 step 의 핵심을 지키지 못하는
   것이다. 확인 후 되돌려라.
3. 아키텍처 체크: `App.tsx` 가 `native/` 어댑터를 통해 호출하는가(직접 `@capgo/*` import 금지,
   CLAUDE.md CRITICAL). 새 전역 변수를 만들지 않았는가.
4. `phases/ota-apply-recovery/index.json` 의 step 6 갱신 — summary 에 **호출이 `AppShell` 의
   마운트 effect 로 갔다**는 것과 **왜 `App` 이 아닌지**를 담아라.

## 금지사항

- **`App` 컴포넌트(`ErrorBoundary` 를 렌더하는 쪽)에 넣지 마라.** 이유: 자식이 던져도 `App` 의
  effect 는 돌아서 크래시한 번들이 "정상"으로 찍힌다 — 고치려는 것을 그대로 남기게 된다.
- **하이드레이션(`prehydrateTabStores`) 완료 뒤로 옮기지 마라.** 이유: [[ADR-117]] 결정 2 에서
  기각됐다(사용자 결정). 10초를 넘기면 멀쩡한 번들까지 롤백돼 업데이트가 영영 안 붙는다.
- **`capacitor.config.ts` 의 `appReadyTimeout` 을 설정하지 마라.** 이유: 이 phase 는 기본값 10초를
  전제로 설계됐고, 그 값을 바꾸는 것은 별개 결정이다.
- **스플래시 `useEffect` 나 다른 effect 에 합치지 마라.** 이유: 그 타이머는 언마운트 때 취소된다 —
  이 호출이 함께 사라진다.
- **`main.tsx` 의 `checkOnBoot`·`jeep-sqlite` 초기화를 건드리지 마라.** 이유: 이 phase 와 무관하다.
- 기존 테스트를 깨뜨리지 마라.
