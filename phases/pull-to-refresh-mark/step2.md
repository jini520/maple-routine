# Step 2: docs-finalize

이슈 **#38**(당겨서 새로고침)의 인디케이터 마크 변경([[ADR-074]] — 문구 제거 + 단풍잎 로고 링)이 구현됐다.

이 step은 **문서 전용**이다. `src/` 는 한 줄도 건드리지 않는다.

## 읽어야 할 파일

문서와 실제 구현을 **대조**하라:

- `/CLAUDE.md` (구현 완료 시 ADR 상태를 '구현 완료'로 명시할 것)
- `/docs/ADR.md` (ADR-061·072·073·074 행)
- `/docs/adr/ADR-074.md` (현재 `(설계, 구현 전)`)
- `/docs/adr/ADR-073.md` · `/docs/adr/ADR-072.md` · `/docs/adr/ADR-061.md` (폐기·예외 표시가 제대로 붙었는지)
- `/docs/foundation/design-system.md` 의 `### 당겨서 새로고침(pull-to-refresh)` 절 + `## 폐기된 정책 (history)`
- `/docs/features/content-scheduler.md` · `/docs/features/boss-scheduler.md` · `/docs/features/boss-profit.md`
- `/src/components/PullToRefreshIndicator/PullToRefreshIndicator.tsx` (실제 구현)
- `/src/components/PullToRefreshIndicator/__tests__/PullToRefreshIndicator.test.tsx` (실제 테스트)

## 작업

### 1. `docs/adr/ADR-074.md` 상태 갱신

- 상태를 `(설계, 구현 전)` → `(구현 완료, 2026-08-01, 이슈 #38 · 실기기 검증 보류)` 로 바꾼다.
- **`## 구현 메모` 절**을 신설하고 담아라:
  - 링 드로잉의 실제 SVG 속성값(`pathLength`·`strokeDasharray`·`strokeDashoffset` 식·`strokeWidth`·`strokeLinecap`).
  - 당김·재조회 두 구간의 마크 크기 지정 방식과 그것이 눈으로 같음을 무엇이 보장하는지(테스트 이름).
  - 제거한 것들(문구 3종·`MESSAGE` 상수·`role="status"`/`aria-live`·`MapleSweepSpinner` import·회전·불투명도 변화).
  - `aria-hidden` 결정의 대체 통로(헤더 `조회 중...`)가 실제로 존재하는 자리.
  - 세 화면 테스트에서 문구 단언을 무엇으로 바꿨는지.
- **`## 남은 검증` 절**을 신설하라:
  - 실기기에서 링 드로잉이 진행률로 읽히는지, 손을 떼는 순간 마크가 튀지 않는지 미확인.
  - [[ADR-072]]·[[ADR-073]]의 `## 남은 검증`(iOS 러버밴드·60fps)과 상호 참조.

### 2. `docs/ADR.md` 인덱스 동기화

ADR-074 행의 상태를 위와 같은 문구로 맞춘다. ADR-061·072·073 행의 예외·폐기 참조가 정확한지 확인한다.

### 3. 문서-구현 대조

`design-system.md` 의 인디케이터 레시피를 **실제 코드와 한 글자씩** 대조하라(루트 클래스·`aria-hidden`·내용 래퍼·링 속성값·`MapleSpinner size`·문구 없음).

- 코드가 옳고 문서가 낡았으면 **문서를 코드에 맞춰 고친다**.
- 문서가 옳고 코드가 정책을 어겼으면 **구현 결함**이다 — 고치지 말고 summary에 "정책 위반 발견: …"으로 남겨라.

`features/` 3개 문서도 대조하고, '열린 질문' 중 해소된 항목을 정리하라.

### 4. 최종 확인

[[ADR-074]] 결정 1~7 중 **구현되지 않은 것이 있는지** 확인하고, 있으면 `(미구현)` 표시와 이유를 남겨라.

또한 앞선 ADR의 **살아 있는 결정이 이번 변경으로 깨지지 않았는지** 확인하라:
- [[ADR-072]] 결정 9(수익 과거 기간 비활성)·10(헤더 버튼 존치)·11(제스처 발 재조회에만 표시)·14(스크롤 레이어 가드)
- [[ADR-073]] 결정 1~6·8(목록 이동·`transform` 규칙, 특히 **오프셋 0에서 `transform` 미적용**)
- [[ADR-061]] 결정 1이 **PTR 외의 자리에서는 그대로**인지(`MapleSweepSpinner` 가 콜드 스타트·백필 등에서 계속 쓰이는지)

각각을 지키는 테스트가 실재하는지 확인하고, 없으면 summary에 적어라.

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
   - ADR-074와 `ADR.md` 인덱스의 상태 문구가 일치하는가?
   - 옛 레시피가 `## 폐기된 정책 (history)` 에 남아 있는가?
   - ADR-061 결정 1이 **폐기가 아니라 예외**로 표시돼 있는가?
4. 결과에 따라 `phases/pull-to-refresh-mark/index.json` 의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "..."` (불일치와 처리, 생존 결정 점검 결과, 남은 검증을 담아라)
   - 실패 3회 → `"status": "error"`, `"error_message": "..."`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."` 후 중단

## 금지사항

- `src/` 를 수정하지 마라. 이유: 이 step은 문서 정합성만 책임진다. 코드 결함을 발견하면 고치지 말고 보고하라.
- 실기기 검증을 "완료"로 적지 마라. 이유: 이 환경에서 실행할 수 없다.
- ADR-061·072·073을 통째로 폐기 처리하지 마라. 이유: 각각 살아 있는 결정이 대부분이다.
- 결정을 사후에 조용히 고쳐 구현과 맞추지 마라.
- 기존 테스트를 깨뜨리지 마라.
