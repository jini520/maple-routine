# Step 9: docs-finalize

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스) · `/docs/adr/ADR-118.md` · `/docs/adr/ADR-119.md` (step 0 산출물 — **주 수정 대상**)
- `/docs/features/settings.md` · `/docs/features/live-update.md` · `/docs/foundation/release.md`
- `phases/settings-hierarchy/index.json` (step 0~8 의 `summary` 전부 — **구현하며 달라진 것이 여기 적혀 있다**)
- 실제 산출물 전부:
  - `src/app/settings/` (`SettingsScreen.tsx` · `SettingsAboutScreen.tsx` · `SettingsAccountDataScreen.tsx` ·
    `SettingsReleaseNotesScreen.tsx` · `SettingsRow.tsx` · `SettingsLinkRow.tsx` · `row-class.ts`)
  - `src/data/release-notes.ts` · `src/native/live-update.ts` · `scripts/publish-live-update.mjs` · `src/App.tsx`

## 배경

CLAUDE.md 는 *"작업 완료 후 문서를 다시 점검해 완료된 항목을 반영(체크)할 것"* 과 *"ADR 도 '설계, 구현 전'
으로 남는 경우가 많음 — 구현 완료 시 `docs/adr/` 와 `docs/ADR.md` 인덱스 상태를 '구현 완료'로 명시할 것"*
을 요구한다. 이 step 이 그 마감이다.

step 0 은 **구현 전**에 쓰였다. 실제 구현에서 결정이 조금 달라진 곳이 있을 수 있고, 그것을 **결정 본문을
고쳐 덮는 것이 아니라** "구현하며 정정한 것" 절로 남기는 것이 이 저장소의 방식이다(`ADR-117.md` 가 그
예시다 — 그 파일의 해당 절을 먼저 읽어라).

## 작업

### 1. `docs/adr/ADR-118.md` · `ADR-119.md` 상태 갱신

- **상태 줄**을 `설계 확정 · 구현 전` → `구현 완료(2026-08-09, 이슈 #135 · #161)` 로 바꾼다.
  실기기로 확인하지 않은 것이 있으면 `· 실기기 미검증` 을 함께 적어라(이 저장소는 그 구분을 지킨다).
- 결정별로 **구현됨 / 구현하며 달라짐 / 폐기됨**을 판정하고, 달라진 것이 있으면 **"구현하며 정정한 것"**
  절을 추가해 적어라. **결정 본문은 그대로 둔다.**
- step 0~8 의 `summary` 를 근거로 판정하라 — 거기에 각 step 이 실제로 무엇을 했고 무엇이 달라졌는지 적혀 있다.
- **`docs/ADR.md` 인덱스의 두 줄에도 상태를 반영하라.**

### 2. `docs/features/settings.md` 재점검

- 「정책」·「UI」 절의 서술이 **실제 코드와 일치하는지** 확인하고 어긋난 곳을 고쳐라. 특히:
  - 본화면 구조(2카드 5행) · 하위 페이지 셋의 라우트 경로 · 행 5종 규칙
  - 「설정 리스트 행 + 모달」 절은 *"하나의 리스트 컨테이너 안에 행을 이어붙임"* 이라고 적혀 있다 —
    이제 카드가 둘이고 하위 페이지가 생겼으므로 그 서술을 현재 상태로 갱신하고, 옛 서술은 history 로 내려라.
  - 「이 화면에는 고정 헤더가 없다」 절의 **실측 높이 서술**(835pt·스크롤 없음)을 갱신하라 — 행이 줄었고
    하위 페이지 셋은 `PageHeader` 를 쓴다(본화면과 다르다).
- **「열린 질문」 정리** — CLAUDE.md 가 *"'열린 질문' 항목이 이미 구현됐는지 확인하고, 완료됐으면 제거·정리"*
  를 요구한다. step 0 이 두 개를 지웠어야 한다. 남아 있으면 지우고, 이번 구현으로 답이 나온 다른 항목이
  있으면 함께 정리하라.
- **「후속 task (미구현)」** 재점검 — 이번에 구현된 것이 있으면 빼라.
- **관련 소스 헤더**(문서 상단 인덱스)에 새 파일들을 반영하라.

### 3. `docs/features/live-update.md` · `docs/foundation/release.md` 재점검

- `notes` 선택 필드와 개발노트 파생 경로가 실제 구현(step 7·8)과 일치하는지.
- `release.md` 의 릴리스 절차에 **"노트를 먼저 쓴다 · 없으면 배포 스크립트가 중단한다"** 가 들어 있는지.
  step 8 이 TS 데이터를 어떻게 읽기로 했는지도 여기 한 줄로 남겨라(다음 사람이 그 자리를 만질 때 필요하다).
- **다음 릴리스에서 `package.json` 을 `1.0.3` 으로 올려야 게이트가 맞물린다**는 사실을 적어라.

### 4. `docs/README.md` 인덱스

기능별 인덱스의 설정 행에 새 소스 경로(하위 화면 3개 · `SettingsLinkRow` · `row-class` ·
`src/data/release-notes.ts`)가 반영돼 있는지 확인하고 없으면 채워라.

### 5. 이슈 본문의 미결 항목 확인

`gh issue view 135` · `gh issue view 161` 로 본문의 체크리스트·"⚠️ 확인 필요" 항목이 이번 구현으로
해소됐는지 대조하고, **해소되지 않고 남은 것**을 summary 에 명시하라(이슈를 닫는 것은 이 step 의 일이 아니다).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 새 error 0 (baseline: 0 errors / 17 warnings)
npm test        # 이 step 은 테스트를 늘리지도 줄이지도 않는다
git status --short src/ scripts/   # 출력이 비어 있어야 한다 — 소스 변경 0건
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. **문서와 코드의 대조를 실제로 하라** — 문서에 적힌 라우트 경로·컴포넌트 이름·프롭·문구가 코드에
   그대로 있는지 `grep` 으로 확인하라. 특히 `최신 버전입니다` · `/settings/about` · `/settings/account-data` ·
   `/settings/release-notes` · `개인정보 처리방침`.
3. 아키텍처 체크리스트:
   - ADR 전문이 `docs/adr/` 개별 파일에 있고 `docs/ADR.md` 는 한 줄씩인가?
   - 폐기된 정책이 **지워지지 않고** 각 문서 하단 history 로 내려가 있는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
4. 결과에 따라 `phases/settings-hierarchy/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`src/` 와 `scripts/` 의 어떤 파일도 고치지 마라.** 이유: 이 step 은 문서 마감이다. 코드에서 결함을
  발견하면 **고치지 말고 summary 에 적어라** — 별도 step 이나 이슈로 다룬다.
- **ADR 의 결정 본문을 덮어쓰지 마라.** 이유: 이 저장소는 *"무엇을 정했는가"* 와 *"구현하며 무엇이
  달라졌는가"* 를 나눠 적는다. 본문을 고치면 결정과 현실의 차이가 사라져 나중에 왜 달라졌는지 알 수 없다.
- **옛 정책 문장을 삭제하지 마라.** 이유: 「폐기된 정책 (history)」로 **이동**시키는 것이 규칙이다.
- **이슈를 닫지 마라(`gh issue close`).** 이유: 릴리스와 실기기 확인이 남아 있고, 닫는 것은 사용자의 판단이다.
- **`package.json` 의 `version` 을 올리지 마라.** 이유: 릴리스 chore 는 이 phase 밖이다.
- 기존 테스트를 깨뜨리지 마라
