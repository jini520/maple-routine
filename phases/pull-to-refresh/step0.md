# Step 0: docs-policy

이 task는 GitHub 이슈 **#38**(각 탭에서 당겨서 새로고침 제스처로 API 재조회)을 구현한다.

이 step은 **문서 전용**이다. `src/` 는 한 줄도 건드리지 않는다(프로젝트 규칙: docs-first).

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — docs-first, TDD, 레이어 규칙)
- `/docs/README.md` (문서 인덱스 — 이 작업의 대상 문서를 확인하라)
- `/docs/ADR.md` (슬림 인덱스 — 관련 ADR만 `/docs/adr/ADR-NNN.md` 로 열어라. 전체를 컨텍스트에 올리지 말 것)
- `/docs/foundation/design-system.md` (특히 `### 스크롤 영역 — 2026-07-13` 절 — 이번에 그 아래 새 절을 추가한다)
- `/docs/adr/ADR-061.md` (로딩 표현 통일 — 스피너 2종 규칙과 결정 9 문구 규칙. 이번 결정이 이 ADR을 어기지 않음을 논증해야 한다)
- `/docs/adr/ADR-047.md` (보스 수익 중첩 sticky·페이드 오버레이 예외 — 배너 배치 결정의 근거)
- `/src/app/content-scheduler/ContentScreen.tsx` (sticky 헤더 블록 `:922`, 헤더 새로고침 버튼, 경계 페이드 오버레이 `:1010`)
- `/src/app/boss-scheduler/BossScreen.tsx` (sticky 헤더 블록 `:414`, 경계 페이드 오버레이 `:546`)
- `/src/app/boss-profit/BossProfitScreen.tsx` (sticky 헤더 블록 `:1325` — `ref={stickyHeaderRef}`, `isCurrentPeriod` `:1302`, 페이드 오버레이를 두지 않는 이유 `:1492`)
- `/src/features/boss-profit/store.ts` (`refresh(ocids)` — 다른 두 스토어와 달리 인자가 하나다)

## 배경 사실 (문서에 반영할 조사 결과)

이 사실들은 이미 확인됐다. 다시 조사하지 말고 그대로 쓰라.

1. **앱에 pull-to-refresh 제스처가 전무하다.** `touchstart`/`touchmove`/`overscroll` grep 무결과, 전용 플러그인 미설치.
2. **스크롤 컨테이너가 없다.** `App.tsx` 의 AppShell 루트는 `min-h-screen`(overflow 없음), 세 화면 루트는 모두 `-mt-[var(--sa-top)] space-y-4`(overflow 없음)이고 헤더만 `sticky top-0 z-10 bg-bg`다. **문서 전체(WebView page)가 스크롤**되므로 최상단 판정은 `window.scrollY <= 0` 이어야 한다.
3. **재조회 로직은 이미 세 화면에 다 있다.** 셋 다 헤더에 `RefreshCw` 버튼이 있고 `refresh(trackedOcids ?? [])` 를 호출한다. 새 store 액션이 필요 없다.
4. **수익 store의 `refresh(ocids)` 만 인자가 하나다**(다른 둘은 `refresh(ocids, onProgress?)`).
5. **수익 화면에는 이미 `isCurrentPeriod` 가 있다** — `BossProfitScreen.tsx:1302` 의 `isLatestPeriod(tab, periodKey, now)`. 헤더 새로고침 버튼 노출 조건(`:1374`)과 같은 플래그다.
6. **컨텐츠·보스 화면에는 sticky 헤더 안에 경계 페이드 오버레이**(`pointer-events-none absolute inset-x-0 top-full h-8 …`)가 있고, **수익 화면에는 없다**(ADR-047 결정 6).
7. **수익 화면의 sticky 헤더는 `ResizeObserver` 로 실측**돼 펼친 캐릭터 카드의 중첩 sticky 오프셋(`stickyHeaderHeight`)에 쓰인다.

## 작업

### 1. `docs/adr/ADR-072.md` 신설

현재 최신 ADR은 ADR-071이다. **반드시 ADR-072를 쓴다.** 기존 ADR 파일(`docs/adr/ADR-071.md` 등)의 서식(배경 → 결정 N → 트레이드오프/한계 → 상태)을 그대로 따르라.

제목: `ADR-072: 당겨서 새로고침(pull-to-refresh) — 3개 탭 최상위 화면`

아래 결정을 **전부** 담아라.

- **결정 1 — 외부 PTR 라이브러리 대신 커스텀 경량 훅을 쓴다.** 이유 셋: ① 이 앱은 overflow 스크롤 컨테이너가 아니라 문서 전체 스크롤 + `sticky` 헤더 구조라(배경 사실 2) 스크롤 컨테이너 ref를 가정하는 대부분의 PTR 라이브러리가 그대로 맞지 않는다. ② 화면별 활성 조건(수익 과거 기간 비활성, 결정 9)을 직접 제어해야 한다. ③ 의존성 최소 원칙.
- **결정 2 — 최상단 판정은 컨테이너 `scrollTop` 이 아니라 `window.scrollY <= 0` 이다.** 등호가 아니라 `<=` 인 것은 의도다 — iOS에서 러버밴드 중 음수가 될 수 있다.
- **결정 3 — store 액션을 신설하지 않는다.** 기존 `refresh(trackedOcids ?? [])` 를 그대로 재사용한다. 수익 store의 `refresh` 는 `onProgress` 인자가 없으므로(배경 사실 4) 공통 핸들러는 **항상 1인자로만** 호출한다.
- **결정 4 — 인디케이터는 sticky 헤더 안 `absolute inset-x-0 top-full` 배너이고, 목록을 밀어내지 않는다(높이만 변한다).** 이유 둘: ① 흐름(flow) 자식으로 두고 높이를 키우면 터치 프레임마다 목록 전체가 리플로우된다. ② 수익 화면은 `stickyHeaderRef` 실측 높이로 중첩 sticky 오프셋을 잡으므로(배경 사실 7), 배너가 흐름 자식이면 당길 때마다 헤더 높이가 변해 `ResizeObserver` 가 매 프레임 발화하고 펼친 카드 헤더가 따라 움직인다. 절대 배치는 실측 높이를 바꾸지 않는다.
- **결정 5 — 배너는 경계 페이드 오버레이 *다음* 형제로 둔다.** 컨텐츠·보스 화면의 페이드는 같은 자리(`absolute top-full`)를 쓰므로 DOM 순서로 배너가 위에 오게 한다. 수익 화면은 페이드가 없어 이 순서 제약이 없다(배경 사실 6).
- **결정 6 — 3상태 문구: `당겨서 새로고침` → `놓으면 새로고침` → `새로고침하고 있어요`.** `~중...` 을 쓰지 않는 것은 [[ADR-061]] 결정 9 때문이다 — 말줄임표가 남는 자리는 새로고침 아이콘 옆 `조회 중...` 한 곳뿐이다.
- **결정 7 — 당김 구간은 정적 단풍잎 회전, 재조회 구간은 `MapleSweepSpinner`(24px).** [[ADR-061]] 결정 1의 "스피너는 2종" 규칙은 깨지지 않는다: 당김 구간의 잎은 **비결정형 대기 표시(스피너)가 아니라 제스처 진행률 표시**이고, 실제 대기가 시작되는 순간 스윕 스피너로 넘긴다. 새 SVG 자산을 만들지 않고 `src/components/mapleLeafPath.ts` 의 `MAPLE_LEAF_PATH` 를 재사용한다.
- **결정 8 — iOS 네이티브 러버밴드를 억제한다.** `src/index.css` 의 `html, body` 에 `overscroll-behavior-y: none` 을 준다. 이유: iOS WebView는 최상단에서 아래로 당기면 페이지 전체가 탄성 바운스하는데(OS 기본, Android는 없음), 커스텀 제스처와 같은 입력을 공유해 두 모션이 겹치고 당김 임계값 계산이 흔들린다. **`contain` 이 아니라 `none` 인 이유**: `contain` 은 스크롤 체이닝만 막고 바운스 어포던스는 남긴다.
- **결정 9 — 수익 탭은 현재 기간에서만 제스처를 켠다.** 기존 `isCurrentPeriod`(= `isLatestPeriod(tab, periodKey, now)`, 헤더 새로고침 버튼 노출 조건과 동일한 플래그)를 그대로 쓴다. 이유: 수익 `refresh` 는 `periodKey` 를 현재 기간으로 강제 리셋하고 라이브 재조회하므로(#30), 과거 기간에서 제스처를 쓰면 보고 있던 기간이 현재 기간으로 튕겨 나간다. **`canGoPreviousPeriod` 는 쓰지 않는다** — 그것은 이전 이동 게이트(#29)이지 "현재 기간 여부"가 아니다.
- **결정 10 — 헤더 새로고침 버튼은 유지한다.** 제스처는 대체가 아니라 추가 수단이다(이슈 #38 명시).
- **결정 11 — 배너는 제스처가 시작한 재조회에서만 뜬다.** 헤더 버튼으로 시작한 재조회는 아이콘 회전 + `조회 중...` 이 이미 담당하므로([[ADR-061]] 결정 8), 배너까지 열면 같은 대기를 두 자리에서 말하게 된다. 훅이 자신이 트리거했는지를 내부 상태로 기억한다.
- **결정 12 — 재조회 중에는 새 당김을 시작하지 않는다(멱등성).** 대기 판정은 세 화면 공통으로 `status === 'loading'` 이다. 수익의 `isPeriodLoading` 은 과거 기간 백필 전용이라 **쓰지 않는다**.
- **결정 13 — 적용 범위는 컨텐츠·보스·수익 3개 탭의 최상위 화면뿐이다.** 서브 화면(보스 관리·컨텐츠 관리·드롭 히스토리)과 설정 탭은 제외한다. 빈 상태(추적 캐릭터 0명)에서는 목록 UI 자체가 없으므로 제스처도 끈다.

**수치**(구현이 이 값을 따른다):

```
PULL_RESISTANCE   = 0.5   손가락 이동 거리 → 당김 거리 감쇠 계수
PULL_THRESHOLD_PX = 56    이 거리를 넘으면 놓았을 때 재조회. 배너가 완전히 펼쳐진 높이와 같다
PULL_MAX_PX       = 80    임계값을 넘겨 더 당겨도 여기서 멈춘다
```

트레이드오프/한계 섹션에 아래를 명시하라:

- 배너가 목록 상단 최대 56px를 덮는다(밀어내지 않기로 한 결정 4의 대가).
- 러버밴드 억제는 앱 전역이라 PTR이 없는 화면(설정·관리 화면)에서도 최상단·최하단 탄성 감각이 사라진다.
- **iOS 실기기 검증이 남아 있다.** 러버밴드 억제가 실제로 먹는지, 커스텀 배너와 모션이 겹치지 않는지는 시뮬레이터·jsdom으로 확인할 수 없다.

상태는 **`(설계, 구현 전)`** 으로 적는다. step 7(docs-finalize)에서 바꾼다.

### 2. `docs/ADR.md` 인덱스에 한 줄 추가

기존 표의 마지막 행(ADR-071) 다음에 ADR-072 한 줄을 append 한다. 표 형식과 문체를 그대로 따르고, 상태는 `(설계, 구현 전, 이슈 #38)` 로 적는다.

### 3. `docs/foundation/design-system.md` 갱신

- 상단 인덱스 헤더의 **관련 ADR** 목록에 `[[ADR-072]]` 를 추가한다.
- `### 스크롤 영역 — 2026-07-13` 절 **바로 다음**에 `### 당겨서 새로고침(pull-to-refresh) — [[ADR-072]]` 절을 신설한다. 이 절이 구현의 단일 진실 공급원이므로 아래 레시피를 그대로 옮겨라. **새 색·새 토큰을 만들지 마라**(`bg-bg`·`border-border`·`text-text-muted`·`text-primary-ink` 만 쓴다).

```
적용 화면: 컨텐츠·보스·수익 3개 탭 최상위 화면만(서브 화면·설정 탭 제외)

배너 위치: sticky 헤더 블록의 마지막 자식 — 경계 페이드 오버레이가 있으면 그 "다음" 형제
배너 루트: pointer-events-none absolute inset-x-0 top-full z-[1] overflow-hidden border-b border-border bg-bg
           style={{ height: <픽셀> }}   ← 목록을 밀어내지 않는다(높이만 변한다)
배너 내용: flex h-14 items-center justify-center gap-2   ← h-14(56px) 고정, 위에서부터 드러난다
  당기는 중/임계 초과: 정적 단풍잎(MAPLE_LEAF_PATH) h-5 w-5 fill-current text-primary-ink
                      회전 = 진행률 × 180deg, 불투명도 = 0.3 + 0.7 × 진행률
  재조회 중:          <MapleSweepSpinner size={24} className="text-primary-ink" />
  문구: text-sm text-text-muted
        당기는 중 "당겨서 새로고침" / 임계 초과 "놓으면 새로고침" / 재조회 중 "새로고침하고 있어요"

문서 스크롤 기준: window.scrollY <= 0 (overflow 컨테이너가 없다 — 위 "스크롤 영역" 참고)
러버밴드 억제: index.css 의 html, body 에 overscroll-behavior-y: none
```

절 말미에 **"헤더 버튼으로 시작한 재조회에는 배너를 열지 않는다"**(ADR-072 결정 11)를 한 줄로 남겨라.

### 4. `docs/features/` 3개 문서 갱신

각 문서의 상단 인덱스 헤더 **관련 ADR** 에 `[[ADR-072]]` 를 추가하고, UI 절에 한 줄씩 넣어라.

- `docs/features/content-scheduler.md` · `docs/features/boss-scheduler.md` — "목록 최상단에서 아래로 당기면 헤더 새로고침 버튼과 같은 재조회(`refresh(trackedOcids ?? [])`)가 돈다. 레시피는 [foundation/design-system.md](../foundation/design-system.md) 의 '당겨서 새로고침' 절."
- `docs/features/boss-profit.md` — 위와 같되 **과거 기간에서는 제스처를 끈다**는 예외와 그 이유(`refresh` 가 `periodKey` 를 현재 기간으로 강제 리셋한다, #30)를 반드시 함께 적어라. 헤더 새로고침 버튼이 현재 기간에서만 보이는 기존 정책과 같은 근거임을 밝혀라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음 (문서만 바꿨으므로 당연히 통과해야 한다)
npm test        # 테스트 전량 통과
git status --short   # docs/ 아래 파일만 변경/추가돼 있어야 한다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `git status --short` 결과에 `src/` 파일이 하나라도 있으면 이 step은 실패다 — 되돌려라.
3. 아키텍처 체크리스트를 확인한다:
   - `docs/README.md` 의 문서 구조 규칙(인덱스 헤더 · 폐기된 정책 섹션)을 따랐는가?
   - ADR 번호가 072인가? 기존 파일을 덮어쓰지 않았는가?
4. 결과에 따라 `phases/pull-to-refresh/index.json` 의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (ADR 번호·신설한 절 이름·확정한 수치를 반드시 요약에 포함하라 — 다음 step들이 이 요약을 컨텍스트로 받는다)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `src/` 를 수정하지 마라. 이유: 이 프로젝트는 docs-first이고, 문서에서 확정한 레시피를 이후 step이 읽고 구현한다. 여기서 코드를 먼저 쓰면 문서가 구현을 뒤따라가는 역전이 생긴다.
- ADR-061의 "스피너 2종" 규칙을 폐기하지 마라. 이유: 이번 결정은 그 규칙 **안에서** 성립한다(결정 7). 규칙을 바꾸는 것이 아니라 당김 진행률 표시가 스피너가 아님을 논증하는 것이다.
- 기존 ADR 파일의 본문을 지우지 마라. 정책을 바꿀 일이 있으면 각 문서 하단 `## 폐기된 정책 (history)` 로 옮겨라.
- 새 색·새 토큰·새 SVG 자산을 문서에 정의하지 마라. 이유: 기존 토큰(`bg-bg`·`border-border`·`text-text-muted`·`text-primary-ink`)과 `MAPLE_LEAF_PATH` 로 전부 표현된다.
- 기존 테스트를 깨뜨리지 마라.
