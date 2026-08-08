# Step 5: release-notes-screen

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스 — `features/settings.md` · `features/live-update.md` · `foundation/design-system.md`)
- `/docs/ADR.md` (슬림 인덱스 — **[[ADR-118]]** 결정 2 · **[[ADR-119]]** 결정 1·3·4 가 계약이다)
- `src/app/settings/SettingsAboutScreen.tsx` (step 3 산출물 — **같은 헤더 골격을 쓴다**)
- `src/data/release-notes.ts` · 릴리스 노트 타입 (step 2 산출물)
- `src/app/boss-scheduler/BossManageScreen.tsx` (하위 페이지 표준 골격)
- `src/components/atoms/Card/Card.tsx` · `src/components/atoms/Badge/` (기존 배지 프리미티브가 이 자리에
  맞는지 먼저 확인하고, 맞으면 새로 만들지 말고 쓸 것)

## 배경

[[ADR-119]] — 앱 안에 변경 내역을 알려주는 자리가 하나도 없었다. 사용자는 버전이 올라간 것은 알지만
무엇이 달라졌는지는 알 수 없었다. 이 화면이 그 자리다.

**데이터는 앱 번들 안에 있다** — `src/data/release-notes.ts` 를 그대로 읽는다. 네트워크 호출 0회,
오프라인에서도 뜬다. 로딩 상태·에러 상태가 **없다**(불러올 것이 없다).

```
← 개발노트
┌────────────────────────────────┐
│ 1.0.3   [사용 중]   2026-08-09 │
│  · 설정 화면을 항목별로 …        │
│  · 개발노트를 추가했어요          │
└────────────────────────────────┘
```

## 작업

### `src/app/settings/SettingsReleaseNotesScreen.tsx` 신규

```ts
export function SettingsReleaseNotesScreen(): React.JSX.Element
```

- **헤더** — `PageHeader` + `뒤로`(`ArrowLeft`, `aria-label="뒤로"`) + `<h1>개발노트</h1>`,
  뒤로는 `useScreenNavigate()('/settings')`. step 3·4 와 **같은 마크업**.
- **본문** — `RELEASE_NOTES` 를 배열 순서 그대로 그린다. **정렬하지 마라**([[ADR-119]] / step 2 가
  "최신이 먼저"를 데이터의 계약으로 두고 테스트로 강제한다 — 화면이 다시 정렬하면 그 계약이 두 곳에 생긴다).
- **버전 한 건의 구성** — 버전 번호(`font-variant-numeric: tabular-nums` 계열의 기존 유틸 `tabular-nums`) ·
  날짜(`text-text-disabled`, 우측) · 항목 목록. 항목이 `requiresStoreUpdate` 면 그 **항목 옆에**
  「스토어 업데이트 필요」 표식을 붙인다(버전 전체가 아니라 항목 단위 — [[ADR-119]] 결정 3).
- **지금 실행 중인 버전 표시** — `features/live-update` 스토어의 `currentVersion`(없으면 `package.json`
  version 으로 폴백)과 일치하는 항목에 배지 하나. `SettingsScreen`·`AppUpdateSection` 이 이미 같은 폴백을
  쓰므로 **그 방식을 그대로 따라라**. 문구는 `사용 중`.
  - 스토어 로드는 `loadCurrentVersion()` 을 마운트 시 부르는 기존 두 화면과 같은 방식이다.
  - 폴백까지 했는데도 일치하는 항목이 없으면 **아무 배지도 붙이지 않는다**(없는 것을 지어내지 않는다).
- **빈 목록 처리** — `RELEASE_NOTES` 가 비면 기존 `EmptyState` 몰리큘을 쓴다. 지금은 1건이 있으므로
  실제로 보이지 않지만, 빈 배열에서 화면이 깨지지 않아야 한다.

카드·라운딩·배지·색은 **전부 기존 토큰과 프리미티브**로 해결하라. 새 색·새 크기·새 라운딩을 만들지 마라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 새 error 0 (baseline: 0 errors / 17 warnings)
npm test        # 기준선 177 파일 / 2695 테스트 + 이 step 에서 추가한 개수
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. **테스트를 먼저 쓰고 구현하라(TDD).** 최소 이 케이스들:
   - 제목 `개발노트` + `뒤로` → `/settings`
   - `RELEASE_NOTES` 의 모든 버전과 모든 항목 문구가 화면에 있다
   - **배열 순서 그대로** 그려진다 (두 건 이상을 주입한 테스트로 DOM 순서를 단언하라)
   - `requiresStoreUpdate: true` 인 **그 항목에만** 「스토어 업데이트 필요」 표식이 붙는다
     (같은 버전의 다른 항목에는 안 붙는다 — 항목 단위임을 단언)
   - `currentVersion` 과 일치하는 버전에만 `사용 중` 배지, 일치하는 것이 없으면 배지 0개
   - 빈 배열이면 `EmptyState` 가 뜨고 예외가 나지 않는다
   - **네트워크를 타지 않는다** — 이 화면 렌더에서 매니페스트 조회(`check` 등)가 불리지 않는지 단언하라
3. 아키텍처 체크리스트:
   - CLAUDE.md CRITICAL — `app/` 에서 `storage/`·네이티브를 **직접** 부르지 않는가?
     (현재 버전은 `features/live-update` 스토어를 거친다)
   - `src/data/` 를 화면이 직접 import 하는 것은 이 저장소의 기존 관례와 맞는가?
     (`ThemeSelector` 가 `job-themes.json` 을 직접 import 하는 선례가 있다 — 순수 데이터라 그렇다)
4. 결과에 따라 `phases/settings-hierarchy/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`src/App.tsx` 에 라우트를 추가하지 마라.** 이유: step 6 이 셋을 한 번에 배선한다.
- **`src/data/release-notes.ts` 의 내용을 늘리거나 고치지 마라.** 이유: step 2 가 `1.0.3` 한 건으로
  확정했고([[ADR-119]] 결정 4), 과거 버전을 지어내는 것은 명시적으로 금지다. 테스트에서 여러 건이
  필요하면 **테스트 안에서 fixture 를 만들어라**(데이터 파일을 건드리지 말 것).
- **노트를 네트워크에서 가져오지 마라.** 이유: 이 화면의 계약이 *"이미 받은 번들 안에 있어 오프라인에서도
  뜬다"* 이다([[ADR-119]] 결정 1). 원격 조회는 #164 모달의 몫이고 그건 `latest.json` 을 쓴다.
- **안 읽음 뱃지·점을 만들지 마라.** 이유: [[ADR-119]] 결정 7 이 사용자 결정으로 배제했다(마지막으로 본
  버전을 저장할 키가 늘어난다).
- **화면에서 배열을 정렬하거나 중복을 제거하지 마라.** 이유: 그 규칙은 step 2 의 데이터 테스트가 강제한다.
- 기존 테스트를 깨뜨리지 마라
