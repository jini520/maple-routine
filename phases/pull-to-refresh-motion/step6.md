# Step 6: docs-finalize

이슈 **#38**(당겨서 새로고침)의 인디케이터 표현을 "목록이 손가락을 따라 내려감"으로 바꾸는 task다([[ADR-073]]). 구현이 끝났다.

이 step은 **문서 전용**이다. `src/` 는 한 줄도 건드리지 않는다.

## 읽어야 할 파일

문서에 적힌 정책과 실제 구현이 일치하는지 **대조**하라:

- `/CLAUDE.md` (구현 완료 시 ADR 상태를 '구현 완료'로 명시할 것, `features/*` 의 '열린 질문' 정리)
- `/docs/ADR.md` (ADR-072·073 행)
- `/docs/adr/ADR-073.md` (현재 `(설계, 구현 전)`)
- `/docs/adr/ADR-072.md` (폐기 표시가 결정 4·5·7에 붙어 있는지)
- `/docs/foundation/design-system.md` 의 `### 당겨서 새로고침(pull-to-refresh)` 절 + `## 폐기된 정책 (history)`
- `/docs/features/content-scheduler.md` · `/docs/features/boss-scheduler.md` · `/docs/features/boss-profit.md`
- `/src/lib/pull-to-refresh.ts` · `/src/lib/use-pull-to-refresh.ts` (실제 상수·시그니처)
- `/src/components/PullToRefreshIndicator/PullToRefreshIndicator.tsx` (실제 클래스)
- 세 화면의 목록 블록 style (실제 배선)

## 작업

### 1. `docs/adr/ADR-073.md` 상태 갱신

- 상태를 `(설계, 구현 전)` → `(구현 완료, 2026-08-01, 이슈 #38 · 실기기 검증 보류)` 로 바꾼다.
- **`## 구현 메모` 절**을 신설하고 담아라:
  - `resolveBandHeightPx` → `resolveContentOffsetPx` 개명과 그 이유(같은 값이 인디케이터 높이이자 목록 오프셋이다).
  - `PULL_SETTLE_TRANSITION` 의 실제 값.
  - 훅에 추가된 `isDragging` 의 계약(손을 떼면 즉시 false — 재조회 중은 드래그가 아니다).
  - `PullToRefreshBanner` → `PullToRefreshIndicator` 교체(경로·`data-testid`·제거한 클래스).
  - 세 화면의 목록 블록에 건 style의 실제 형태와 부여한 `data-testid`.
  - **오프셋 0에서 `transform` 을 걸지 않는다는 결정 3이 테스트로 고정돼 있다는 사실**과 그 테스트 위치.
- **`## 남은 검증` 절**을 신설하고 적어라:
  - 실기기(iOS·Android)에서 목록 이동이 60fps로 손가락을 따라오는지 미확인. jsdom·시뮬레이터로는 확인 불가.
  - [[ADR-072]] `## 남은 검증` 의 iOS 러버밴드 항목도 여전히 미해결임을 상호 참조로 남겨라.

### 2. `docs/ADR.md` 인덱스 갱신

ADR-073 행의 상태를 위와 같은 문구로 동기화한다. ADR-072 행의 폐기 참조가 정확한지 확인한다. 다른 행은 건드리지 마라.

### 3. 문서-구현 대조

`design-system.md` 의 `### 당겨서 새로고침` 절 레시피를 **실제 코드와 한 글자씩** 대조하라(인디케이터 루트 클래스·`h-full` 내용 래퍼·목록 블록 style 형태·상수 값·문구 3종).

- 코드가 옳고 문서가 낡았으면 **문서를 코드에 맞춰 고친다**.
- 문서가 옳고 코드가 정책을 어겼으면 **구현 결함**이다 — 고치지 말고 summary에 "정책 위반 발견: …"으로 남겨라(이 step은 문서 전용이다).

`features/` 3개 문서도 같은 방식으로 대조하고, '열린 질문' 중 해소된 항목을 정리하라.

### 4. 최종 확인

[[ADR-073]] 결정 1~9 중 **구현되지 않은 것이 있는지** 확인하라. 있으면 `(미구현)` 표시와 이유를 남겨라 — 조용히 넘어가지 마라.

또한 [[ADR-072]]의 **살아 있는 결정(1·2·3·9~14)이 이번 변경으로 깨지지 않았는지** 확인하라. 특히:
- 수익 화면 과거 기간 비활성(결정 9)
- 헤더 새로고침 버튼 존치(결정 10)
- 헤더 버튼 재조회에는 인디케이터를 열지 않음(결정 11)
- 스크롤 가능한 레이어 안에서 시작한 터치 무시(결정 14)

각각을 지키는 테스트가 실제로 존재하는지 확인하고, 없으면 summary에 적어라.

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
3. 아키텍처 체크리스트:
   - ADR-073과 `ADR.md` 인덱스의 상태 문구가 일치하는가?
   - 옛 배너 레시피가 `## 폐기된 정책 (history)` 에 남아 있는가? (지워졌으면 복구하라)
   - ADR-072의 살아 있는 결정에 폐기 표시가 잘못 붙지 않았는가?
4. 결과에 따라 `phases/pull-to-refresh-motion/index.json` 의 step 6을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "..."` (문서-구현 불일치와 그 처리, ADR-072 생존 결정 점검 결과, 남은 검증을 담아라)
   - 실패 3회 → `"status": "error"`, `"error_message": "..."`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."` 후 중단

## 금지사항

- `src/` 를 수정하지 마라. 이유: 이 step은 문서 정합성만 책임진다. 코드 결함을 발견하면 고치지 말고 보고하라.
- 실기기 검증을 "완료"로 적지 마라. 이유: 이 환경에서 실행할 수 없다.
- ADR-072를 통째로 폐기 처리하지 마라. 이유: 결정 1·2·3·9~14는 살아 있다.
- 결정을 사후에 조용히 고쳐 구현과 맞추지 마라. 이유: 결정이 바뀌었다면 그것은 새 결정이고, 왜 바뀌었는지가 기록돼야 한다.
- 기존 테스트를 깨뜨리지 마라.
