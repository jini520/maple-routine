# Step 3: about-screen

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스 — `features/settings.md` · `features/live-update.md` · `foundation/design-system.md`)
- `/docs/ADR.md` (슬림 인덱스 — **[[ADR-118]]** 결정 2·4·7·8·10 이 이 step 의 계약이다.
  `/docs/adr/ADR-118.md` 를 열어라. `/docs/adr/ADR-098.md`(PageHeader 가 `fixed` 인 이유)도 볼 것)
- `src/app/boss-scheduler/BossManageScreen.tsx` (**하위 페이지의 표준 골격** — 헤더 블록을 그대로 따른다)
- `src/components/templates/PageHeader/PageHeader.tsx`
- `src/lib/use-screen-navigate.ts`
- `src/app/settings/AppUpdateSection.tsx` (수정 대상) · `__tests__/AppUpdateSection.test.tsx`
- `src/app/settings/SettingsLinkRow.tsx` (step 1 산출물 — 외부 링크 행)
- `src/app/settings/SettingsScreen.tsx` (footer 고지 블록의 현재 문구·주석 — 옮길 한 줄이 여기 있다)
- `src/App.tsx` (라우트 정의 — 이 step 에서는 **읽기만** 한다)

## 배경

[[ADR-118]] 결정 2 — 설정에 하위 페이지 셋이 생긴다. 이 step 은 그 중 **`/settings/about`** 의 화면
컴포넌트만 만든다. **라우트 배선은 step 6 몫**이라, 이 step 이 끝난 시점에 이 화면은 아직 도달할 수 없다.
그것이 의도한 중간 상태다.

화면 구성(시안 확정본):

```
← 앱 정보
┌────────────────────────┐
│ 현재 버전        1.0.2 │   ← AppUpdateSection
│ 상태      최신 버전입니다 │
│ [   업데이트 확인   ]   │
└────────────────────────┘
┌────────────────────────┐
│ 개인정보 처리방침     ↗ │   ← SettingsLinkRow (별도 카드)
└────────────────────────┘
```

## 작업

### 1. `src/app/settings/AppUpdateSection.tsx` 수정 — 껍데기를 벗긴다

지금 이 컴포넌트는 `<section className="space-y-2">` + `<h2>앱 업데이트</h2>` + `<Card>` 를 함께 그린다.
새 화면에서는 **페이지 제목이 이미 「앱 정보」** 라 그 `h2` 가 중복된다.

- `<section>` 래퍼와 `<h2>앱 업데이트</h2>` 를 **제거**하고 `<Card className="px-6 divide-y divide-border">`
  하나만 반환하게 한다.
- **안쪽 로직·문구·상태 처리는 하나도 바꾸지 마라** — 단 하나의 예외가 아래 문구다.
- **`statusText['up-to-date']` 를 `'최신입니다'` → `'최신 버전입니다'` 로 바꾼다**([[ADR-118]] 결정 10).
  나머지 12개 상태 문구는 그대로다.
- 기존 테스트가 `<h2>` 나 섹션 구조를 단언하고 있으면 그 단언만 걷어내라(상태·버튼 동작 단언은 유지).

### 2. `src/app/settings/SettingsAboutScreen.tsx` 신규

```ts
export function SettingsAboutScreen(): React.JSX.Element
```

- 화면 루트는 `BossManageScreen` 과 같은 골격이다. `PageHeader` 안에
  `뒤로` 버튼(`ArrowLeft`, `aria-label="뒤로"`, `className="p-1 -ml-1 text-text-muted hover:text-text"`) +
  `<h1 className="text-lg font-semibold text-text">앱 정보</h1>`. 뒤로는 `useScreenNavigate()('/settings')`.
  **`BossManageScreen` 의 헤더 블록 마크업을 그대로 따라라** — 이 저장소는 그 셸을 [[ADR-094]]·[[ADR-098]]
  로 통일해 두었다.
- 본문은 `<AppUpdateSection />` 그리고 그 아래 `<Card className="px-6">` 안에
  `<SettingsLinkRow label="개인정보 처리방침" href="https://mapleroutine.store/privacy" />`.
- **왜 이 링크가 여기 있는지**를 주석으로 남겨라: Play 사용자 데이터 정책이 스토어 등록정보와 앱 안 양쪽에
  링크를 요구하고([[ADR-118]] 결정 7 · `docs/foundation/release.md`), 요구하는 것은 *"앱 안에 링크"* 이지
  *"첫 화면에 링크"* 가 아니다. 그리고 앱에 정책 본문 **사본을 두지 않는다**(법적 문서를 두 벌로 만들지 않는다).

### 3. `src/app/settings/SettingsScreen.tsx` — 고지에서 링크 한 줄 제거

footer 고지 블록에서 **개인정보 처리방침 `<p>` 한 줄만** 제거한다(그 위의 주석 중 링크를 설명하는 부분도
함께 정리). 남는 4줄(버전 · 저작권 · `Data based on NEXON Open API` · 비제휴 고지)과 그 주석은 **그대로 둔다**.

이 파일에서 이 step 이 건드릴 것은 **그 한 줄뿐이다.** 화면 재구성은 step 6 몫이다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 새 error 0 (baseline: 0 errors / 17 warnings)
npm test        # 기준선 177 파일 / 2695 테스트 + 이 step 에서 추가한 개수
grep -c "개인정보 처리방침" src/app/settings/SettingsScreen.tsx   # 0
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. **테스트를 먼저 쓰고 구현하라(TDD).** 최소 이 케이스들:
   - 화면에 `앱 정보` 제목과 `뒤로` 버튼이 있고, 뒤로를 누르면 `/settings` 로 이동한다
   - `개인정보 처리방침` 행이 `<a>` 이고 `href` 가 `https://mapleroutine.store/privacy` 다
   - `up-to-date` 상태에서 **`최신 버전입니다`** 가 보인다 (`최신입니다` 가 아니다)
   - `SettingsScreen` 의 고지 블록에 개인정보 처리방침이 **더 이상 없다**(이사 회귀 방지)
   - 나머지 footer 4줄은 그대로 있다
3. 아키텍처 체크리스트:
   - CLAUDE.md CRITICAL — `app/` 에서 `storage/`·네이티브 API 를 **직접** 부르지 않는가?
     (`AppUpdateSection` 은 `features/live-update` 스토어를 거친다. 그 구조를 바꾸지 마라)
   - 새 색·새 크기·새 라운딩을 만들지 않았는가? 카드는 `Card` atom, 버튼은 `Button` atom.
4. 결과에 따라 `phases/settings-hierarchy/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`src/App.tsx` 에 라우트를 추가하지 마라.** 이유: 라우트 3개는 step 6 이 한 번에 배선한다. 여기서 하나만
  배선하면 본화면에는 아직 진입점이 없어 도달 경로가 반쪽이 된다.
- **`AppUpdateSection` 의 상태 로직·`statusText` 의 나머지 12개 문구·버튼 동작을 바꾸지 마라.**
  이유: 이 step 이 바꾸는 것은 껍데기(섹션/제목)와 문구 **한 개**뿐이다. [[ADR-026]]·[[ADR-027]]·
  [[ADR-117]] 이 그 안쪽을 정해 두었다.
- **개인정보 처리방침 URL 을 바꾸거나 앱 안에 정책 본문 사본을 만들지 마라.** 이유: 법적 문서가 두 벌이 된다
  (`PRIVACY.md` 를 렌더링한 사이트가 단일 원천이다).
- **`SettingsScreen` 의 카드·행 구조를 재구성하지 마라.** 이유: step 6 몫이다. 이 step 은 고지 한 줄만 뺀다.
- 기존 테스트를 깨뜨리지 마라
