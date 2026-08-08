# Step 6: settings-shell

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스 — `features/settings.md`)
- `/docs/ADR.md` (슬림 인덱스 — **[[ADR-118]]** 결정 1·2·4·5·8 이 계약이다. `/docs/adr/ADR-118.md`.
  `/docs/adr/ADR-098.md`(이 화면에 고정 헤더가 없는 이유·스크롤 리셋)도 열어라)
- `src/app/settings/SettingsScreen.tsx` (**주 수정 대상**) · `__tests__/SettingsScreen.test.tsx`
- `src/App.tsx` (라우트 정의 · `lazy(...)` 8개의 형태 · `isCompleted` 가드 · `BottomTabBar` 의 `TAB_ITEMS`)
- step 3·4·5 산출물: `SettingsAboutScreen.tsx` · `SettingsAccountDataScreen.tsx` · `SettingsReleaseNotesScreen.tsx`
- `src/app/settings/SettingsRow.tsx` (step 1 — chevron 병기) · `ThemeModal.tsx` · `TrackingModeModal.tsx`
- `src/features/settings/cache-data.ts` (`loadCacheDataSizes`) · `src/features/live-update/store.ts`

## 배경

**여기서 처음으로 화면이 이어진다.** step 3~5 가 만든 세 화면은 아직 도달할 수 없고, 본화면은 아직 옛
구조다. 이 step 이 본화면을 [[ADR-118]] 결정 1 의 **B안**으로 바꾸고 라우트 셋을 배선한다.

```
설정
┌────────────────────────────┐
│ 스케줄 관리 방법   [자동] › │   ← TrackingModeModal
│ 테마             [머쉬맘] › │   ← ThemeModal
└────────────────────────────┘
┌────────────────────────────┐
│ 개발노트                 › │   ← /settings/release-notes
│ 계정 및 데이터    12.4 MB › │   ← /settings/account-data
│ 앱 정보            1.0.2 › │   ← /settings/about
└────────────────────────────┘
   v1.0.2
   © 2026 메이플 루틴
   Data based on NEXON Open API
   Maple Routine is not associated with NEXON Korea
```

**섹션 제목은 달지 않는다.** 검토한 대안 중 A(한 카드 5행)는 두 무리가 한 덩어리로 읽혔고, C(제목 붙임)는
두 무리를 덮는 제목이 행 이름보다 덜 구체적이었다. 카드 경계만으로 가른다([[ADR-118]] 결정 1).

## 작업

### 1. `src/App.tsx` — 라우트 셋 배선

`/settings` 라우트의 **형제**로 세 개를 추가한다:

- `/settings/release-notes` → `SettingsReleaseNotesScreen`
- `/settings/account-data` → `SettingsAccountDataScreen`
- `/settings/about` → `SettingsAboutScreen`

- **셋 다 `lazy(...)` 로 불러라** — 기존 8개 화면과 같은 형태다(번들 스플리팅이 이 저장소의 확립된 구조다).
- **`isCompleted` 가드를 똑같이 걸어라** — `isCompleted ? <X /> : <Navigate to="/onboarding" replace />`.
  이게 있어야 `연결 해제` 로 온보딩에 돌아갈 때 이 화면들에서도 리다이렉트가 걸린다.
- **`/profit/drops` 처럼 중첩 라우트로 만들지 마라** — 그건 아래 화면이 언마운트되면 안 되는 오버레이라
  중첩이었다([[ADR-077]]). 설정 하위 페이지는 독립 화면이므로 `/boss/manage`·`/content/manage` 와 같은
  **형제 라우트**다.
- **`TAB_ITEMS` 를 건드리지 마라** — `NavLink` 에 `end` 가 없어 `/settings/about` 에서도 설정 탭이 활성으로
  남는다(`/boss/manage` 와 같다). 확인만 하고 지나가라.

### 2. `src/app/settings/SettingsScreen.tsx` 재구성

- **카드 1** (`px-6 divide-y divide-border`)
  - `스케줄 관리 방법` — 우측 배지 `TRACKING_MODE_LABELS[trackingMode]` + chevron. `TrackingModeModal` 을 연다.
  - `테마` — 우측 배지 현재 테마 이름 + chevron. `ThemeModal` 을 연다.
  - 두 행 다 **배지와 chevron 이 함께** 보인다(step 1 이 만든 병기 — [[ADR-118]] 결정 4).
- **카드 2** (`px-6 divide-y divide-border`) — 셋 다 `useScreenNavigate()` 로 이동한다.
  - `개발노트` → `/settings/release-notes`. **우측 값 없음**(보여줄 대표값이 없다 — 결정 5).
  - `계정 및 데이터` → `/settings/account-data`. 우측에 **캐시 총 용량**(`loadCacheDataSizes()` 의
    `general + bossRecords`). 조회 전에는 `- KB` 로 자리를 잡는다([[ADR-061]] 결정 7).
  - `앱 정보` → `/settings/about`. 우측에 **현재 버전**(`currentVersion ?? packageJson.version` — 지금
    footer 가 쓰는 것과 같은 폴백).
- **제거되는 것** — `계정 변경`·`연결 해제` 행(step 4 의 화면으로 갔다), `AccountModal`·`DisconnectConfirm`
  렌더와 그 상태(`isDisconnectOpen`·`isDisconnecting`·`disconnect`), 그리고 이제 안 쓰는 import 전부.
  **`ThemeModal`·`TrackingModeModal` 은 남는다.**
- **footer 고지 4줄과 그 주석은 그대로 둔다** — 개인정보 처리방침 줄은 step 3 이 이미 뺐다.
  이용약관 제6조④ 문구(`Data based on NEXON Open API`)는 **원문 그대로**, 의역 금지.
- 화면 골격(`p-4 space-y-4` + 평범한 `h1`)은 **그대로다** — 이 화면에 고정 헤더를 도입하지 마라
  ([[ADR-098]] 결정 3, 아래 금지사항).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 새 error 0 (baseline: 0 errors / 17 warnings)
npm test        # 기준선 177 파일 / 2695 테스트 기준
grep -c "CacheDataSection\|AccountModal\|DisconnectConfirm" src/app/settings/SettingsScreen.tsx   # 0
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. **테스트를 먼저 쓰고 구현하라(TDD).** 최소 이 케이스들:
   - 본화면에 행이 **정확히 5개**이고 순서가 위 그림과 같다
   - 두 카드가 **서로 다른 카드 요소**다 (위 2행 / 아래 3행 — 이 step 의 핵심)
   - `스케줄 관리 방법`·`테마` 행에 **배지와 chevron 이 둘 다** 있다
   - 세 이동 행을 탭하면 각각 `/settings/release-notes`·`/settings/account-data`·`/settings/about` 로 간다
   - `계정 및 데이터` 우측에 캐시 용량(조회 전 `- KB`), `앱 정보` 우측에 현재 버전, `개발노트` 우측은 비어 있다
   - 본화면에 `계정 변경`·`연결 해제`·`캐시 데이터 삭제` 행이 **없다** (이사 회귀 방지)
   - footer 가 4줄이고 개인정보 처리방침이 없다
   - **라우팅 통합 테스트** — `/settings` 에서 각 행을 눌러 실제로 그 화면이 뜨고, `뒤로` 로 돌아온다
     (`MemoryRouter` 로 `App` 을 렌더하는 기존 테스트 방식을 따라라)
3. **판별력을 확인하라** — 두 카드를 하나로 합쳤을 때 **"서로 다른 카드" 케이스만** 실패하는지 실행으로
   확인하고 되돌려라. 그 결과를 summary 에 적어라.
4. 아키텍처 체크리스트:
   - CLAUDE.md CRITICAL — `app/` 에서 `storage/`·네이티브를 **직접** 부르지 않는가?
     (캐시 용량은 `features/settings/cache-data`, 버전은 `features/live-update` 스토어를 거친다)
   - 새 색·새 크기·새 라운딩 0개인가?
5. 결과에 따라 `phases/settings-hierarchy/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **섹션 제목(`<h2>`)을 달지 마라.** 이유: [[ADR-118]] 결정 1 이 세 안을 비교한 뒤 카드 경계만으로 가르기로
  했다. 두 무리를 덮는 제목(「동작·표시」「관리·정보」)이 행 이름보다 덜 구체적이라 읽는 사람이 얻는 것이 없다.
- **이 화면에 `PageHeader`(고정 헤더)를 도입하지 마라.** 이유: [[ADR-098]] 결정 3 — 이 화면에 고정 헤더가
  없어서 탭 복귀 프레임 튐이 구조적으로 일어날 수 없다. 그 ADR 이 재판단 조건으로 건 것은 *"행이 늘어 세로가
  길어지면"* 인데, 이 개편은 오히려 5행 + 4줄로 **줄어들어** 스크롤이 생기지 않는다.
- **이동에 `useNavigate` 를 직접 쓰지 마라. `useScreenNavigate` 를 써라.** 이유: 네 탭 화면이 문서 전체
  스크롤 하나를 공유해([[ADR-072]] 결정 1) 이동 전에 스크롤을 0으로 옮기지 않으면 새 화면이 옛 오프셋으로
  마운트된다([[ADR-098]] 결정 1).
- **`TAB_ITEMS` 나 `NavLink` 에 `end` 를 추가하지 마라.** 이유: 하위 페이지에서 설정 탭이 꺼진다.
- **`useSettingsStore.changeApiKey` 를 배선하지 마라.** 이유: [[ADR-118]] 결정 9 가 이번에는 되살리지
  않기로 했다(로직·테스트는 그대로 남긴다).
- **footer 문구를 의역하거나 줄이지 마라.** 이유: `Data based on NEXON Open API` 는 이용약관 제6조④가
  요구하는 원문이다.
- 기존 테스트를 깨뜨리지 마라
