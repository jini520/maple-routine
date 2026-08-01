# Step 7: docs-finalize

이 task는 GitHub 이슈 **#38**(각 탭에서 당겨서 새로고침 제스처로 API 재조회)을 구현했다.

이 step은 **문서 전용**이다. `src/` 는 한 줄도 건드리지 않는다 — 구현이 끝난 상태를 문서에 반영하고, 문서와 구현의 불일치를 잡는다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 **문서에 적힌 정책과 실제 구현이 일치하는지** 대조하라:

- `/CLAUDE.md` (프로젝트 규칙 — 구현 완료 시 ADR 상태를 '구현 완료'로 명시할 것, `features/*` 문서의 '열린 질문' 중 완료된 항목은 정리할 것)
- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — ADR-072 행)
- `/docs/adr/ADR-072.md` (이번 기능의 결정 원장 — 지금은 `(설계, 구현 전)` 상태다)
- `/docs/foundation/design-system.md` 의 `### 당겨서 새로고침(pull-to-refresh)` 절
- `/docs/features/content-scheduler.md` · `/docs/features/boss-scheduler.md` · `/docs/features/boss-profit.md`
- `/src/lib/pull-to-refresh.ts` · `/src/lib/use-pull-to-refresh.ts` (실제 구현된 상수·시그니처·계약)
- `/src/components/PullToRefreshBanner/PullToRefreshBanner.tsx` (실제 클래스·문구)
- `/src/app/content-scheduler/ContentScreen.tsx` · `/src/app/boss-scheduler/BossScreen.tsx` · `/src/app/boss-profit/BossProfitScreen.tsx` (훅 호출·배너 배치 위치)
- `/src/index.css` (`overscroll-behavior-y`)

## 작업

### 1. `docs/adr/ADR-072.md` 상태 갱신

- 상태를 `(설계, 구현 전)` → `(구현 완료, 2026-08-01, 이슈 #38)` 로 바꾼다.
- **`## 구현 메모` 절을 신설**하고 아래를 담아라(다음에 이 코드를 만지는 사람이 파일을 찾아 헤매지 않도록):
  - 순수 로직 모듈과 훅의 실제 경로·export 목록.
  - 배너 컴포넌트 경로와 `data-testid`.
  - 세 화면에서 훅을 호출하는 위치(조기 반환보다 위)와 각 화면의 `enabled` 조건.
  - 수익 화면에서 `now`·`isCurrentPeriod` 선언을 조기 반환 위로 옮겼다는 사실과 그 이유(훅 규칙).
  - 실제 확정된 수치(`PULL_RESISTANCE`·`PULL_THRESHOLD_PX`·`PULL_MAX_PX`)가 설계 값과 같은지, 다르면 무엇을 왜 바꿨는지.
- **`## 남은 검증` 절을 신설**하고 아래를 명시하라:
  - **iOS 실기기에서 러버밴드 억제(`overscroll-behavior-y: none`)와 커스텀 배너의 공존이 아직 확인되지 않았다.** 시뮬레이터·jsdom으로는 확인할 수 없다. 간섭이 남으면 스크롤 루트/`body` 설정을 추가 조정해야 한다(이슈 #38의 ⚠️ 항목).
  - Android 실기기에서 당김 임계값(56px)이 실제로 자연스러운지도 미확인이다.

### 2. `docs/ADR.md` 인덱스 행 갱신

ADR-072 행의 상태를 `(설계, 구현 전, 이슈 #38)` → `(구현 완료, 2026-08-01, 이슈 #38 · iOS 실기기 검증 보류)` 로 바꾼다. 다른 행은 건드리지 마라.

### 3. 문서-구현 불일치 해소

`design-system.md` 의 `### 당겨서 새로고침` 절 레시피를 **실제 코드와 한 글자씩 대조**하라. 클래스·문구·수치가 다르면:

- 코드가 옳고 문서가 낡았으면 **문서를 코드에 맞춰 고친다**.
- 문서가 옳고 코드가 정책을 어겼으면 그것은 **구현 결함**이다 — 고치지 말고 summary에 "정책 위반 발견: …"으로 명확히 남겨라(이 step은 문서 전용이므로 코드를 고치지 않는다).

`features/` 3개 문서도 같은 방식으로 대조하고, 각 문서의 **'열린 질문'** 항목에 이번 작업으로 해소된 것이 있으면 제거·정리하라(CLAUDE.md 규칙).

### 4. 최종 확인

`git log --oneline` 으로 이번 task의 커밋들을 훑고, ADR-072의 결정 중 **구현되지 않은 것이 있는지** 확인하라. 있으면 ADR-072에 `(미구현)` 표시와 이유를 남겨라 — 조용히 넘어가지 마라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과
npm run lint    # ESLint 통과
git status --short   # docs/ 아래 파일만 변경돼 있어야 한다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `git status --short` 결과에 `src/` 파일이 하나라도 있으면 이 step은 실패다 — 되돌려라.
3. 아키텍처 체크리스트를 확인한다:
   - ADR-072와 `ADR.md` 인덱스의 상태 문구가 서로 일치하는가?
   - 옛 정책을 지우지 않고 `## 폐기된 정책 (history)` 로 옮겼는가? (이번 작업은 폐기한 정책이 없을 가능성이 높지만, 있다면 지우지 말 것)
4. 결과에 따라 `phases/pull-to-refresh/index.json` 의 step 7을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (발견한 문서-구현 불일치와 그 처리, 남은 검증 항목을 요약에 포함하라)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `src/` 를 수정하지 마라. 이유: 이 step은 문서 정합성만 책임진다. 코드 결함을 발견하면 고치지 말고 보고하라 — 고치면 이 task의 어느 커밋에도 테스트 근거가 없는 변경이 섞인다.
- iOS 실기기 검증을 "완료"로 적지 마라. 이유: 이 환경에서 실행할 수 없는 검증이고, 거짓 완료 표시는 나중에 같은 버그를 두 번 찾게 만든다.
- ADR-072의 결정을 사후에 조용히 고쳐 구현과 맞추지 마라. 이유: 결정이 바뀌었다면 그것은 새 결정이고, 왜 바뀌었는지가 기록돼야 한다.
- 기존 테스트를 깨뜨리지 마라.
