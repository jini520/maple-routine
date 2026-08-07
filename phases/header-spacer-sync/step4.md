# Step 4: docs-verify

이 step 은 **문서만** 바꾼다. 구현이 끝난 상태를 문서에 반영해 마감한다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 실제로 무엇이 만들어졌는지 확인하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 관련 ADR 만 열어라. 전체를 컨텍스트에 올리지 말 것)
- `/docs/adr/ADR-112.md` — step 0 이 쓴 결정. **상태가 아직 '설계·구현 전'일 것이다**
- `/phases/header-spacer-sync/index.json` — step 1~3 의 `summary` 와 note. 실제로 무엇이 만들어졌고
  무엇을 정정했는지의 1차 출처다
- `/src/lib/use-measured-height.ts` + `/src/lib/__tests__/use-measured-height.test.tsx`
- `/src/components/templates/PageHeader/PageHeader.tsx` + 그 테스트
- `/src/app/boss-profit/BossProfitScreen.tsx` (측정 부분) + `/src/app/boss-profit/__tests__/BossProfitScreen.test.tsx`
- `/docs/features/boss-profit.md` · `/docs/foundation/design-system.md` — step 0 이 갱신한 절

## 작업

### 1. `docs/adr/ADR-112.md` 마감

- 상태를 **'구현 완료'** 로 고친다. 날짜(2026-08-08)와 이슈 번호(#168), 그리고 **실제 수치**를
  적어라 — `npm test -- --run` 의 최종 테스트 수, build·lint 에러 0.
- **'실기기 미검증'을 명시하라.** 이 프로젝트는 브라우저에서 멀쩡하던 것이 실기기에서 깨진 이력이
  반복됐다([[ADR-079]]·[[ADR-085]]·[[ADR-098]]). 남은 확인 대상을 구체적으로 적어라:
  - 보스 수익에서 기록 없는 과거 기간으로 이동할 때 로딩 카드가 **한 번에 제자리에** 그려지는가
  - 기록이 **있는** 기간 이동에서도 어긋난 프레임이 없는가
  - 컨텐츠·보스 스케줄러에서 로딩 카드 → 탭 줄 전환(콜드 스타트) 때 목록이 튀지 않는가
  - 펼친 캐릭터 카드의 중첩 sticky 헤더가 stuck 위치를 유지하는가([[ADR-047]] — 이 실측값을 쓴다)
- **검증 절을 실재하는 테스트로 재작성하라.** "~를 검증한다" 같은 추상 서술이 아니라 파일·describe·
  케이스 수를 적어라. 자동 테스트가 **덮지 못하는 자리**도 명시하라 — jsdom 은 레이아웃을 계산하지
  않으므로 "실제로 한 프레임 어긋나는가"는 테스트가 아니라 실기기·브라우저의 몫이다. 테스트가
  담보하는 것은 **측정 시점**(같은 커밋에 spacer 가 따라오는가)이지 픽셀이 아니다.
- **구현하며 설계에서 벗어난 것이 있으면 '정정' 항목으로 남겨라.** `index.json` 의 note 들을 읽고
  판단하라 — 훅 API 가 바뀌었다거나, 기존 테스트를 삭제·재작성했다거나, 스텁을 요소별로 좁혔다면
  전부 여기 남길 사실이다. **없으면 억지로 쓰지 마라.**

### 2. `docs/ADR.md` 인덱스 행 갱신

step 0 이 넣은 ADR-112 행의 상태 표기를 구현 완료로 고친다. 다른 행은 건드리지 마라.

### 3. `docs/features/boss-profit.md` · `docs/foundation/design-system.md` 점검

step 0 이 미리 쓴 내용이 **실제 구현과 일치하는지** 대조하라. 훅 이름·파일 경로·effect 분담 설명이
코드와 다르면 코드 쪽을 진실로 삼아 문서를 고쳐라.

`docs/README.md` 의 기능→소스 매핑 표에 `lib/use-measured-height` 를 더할 자리가 있는지 확인하라
(디자인 시스템 행 또는 보스 수익 행). **억지로 넣지는 마라** — 표의 입도를 보고 판단하라.

### 4. 이슈 #168 완료 조건 대조

이슈 본문의 "검증" 4개 항목 각각에 대해 **무엇이 충족됐고 무엇이 남았는지** ADR 에 명시하라.
자동 테스트로 닫힌 것과 실기기가 남은 것을 섞지 마라.

### 5. `docs/features/*` 의 '열린 질문' 점검

CLAUDE.md 규칙 — `docs/features/boss-profit.md` 의 '열린 질문' 항목 중 이번 작업으로 해소된 것이
있으면 제거·정리하라. **없으면 손대지 마라.**

## Acceptance Criteria

```bash
grep -q "구현 완료" docs/adr/ADR-112.md
grep -q "미검증" docs/adr/ADR-112.md          # 실기기 상태가 명시돼 있다
npm run build
npm run lint
npm test -- --run                              # 전부 통과
git diff --stat                                # docs/ 밖 파일이 바뀌지 않았다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. ADR 에 적은 테스트 수가 `npm test -- --run` 의 실제 출력과 일치하는지 대조한다. **기억이나
   추정으로 쓰지 마라 — 출력을 보고 적어라.**
3. ADR 에 적은 파일 경로·describe 이름이 실재하는지 `grep` 으로 확인한다.
4. 아키텍처 체크리스트:
   - CLAUDE.md 의 "ADR 도 '설계, 구현 전'으로 남는 경우가 많음 — 구현 완료 시 상태를 명시할 것" 을 지켰는가.
   - 옛 내용을 지우지 않고 history 로 옮겼는가(이번엔 뒤집는 정책이 없으므로 대개 해당 없음).
5. 결과에 따라 `phases/header-spacer-sync/index.json` 의 step 4 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **제품 코드(`src/`)를 건드리지 마라.** 이유: 이 step 은 문서 마감이다. 코드 수정이 필요하다고
  판단되면 고치지 말고 `index.json` 에 사실로 남겨라 — 별도 판단이 필요한 일이다.
- **실기기에서 확인했다고 쓰지 마라.** 이유: 이 세션은 실기기에 접근할 수 없다. 확인하지 않은 것을
  확인한 것처럼 쓰면 다음 사람이 잘못된 전제 위에서 판단한다.
- **테스트 수를 추정해 쓰지 마라.** 이유: ADR 의 수치는 나중에 회귀를 판별하는 기준선이 된다.
- **이슈 #168 을 '전부 해결'로 단정하지 마라.** 이유: 실기기 확인이 남아 있고, 공용 `PageHeader`
  쪽은 애초에 사용자 관측이 없던 구조적 결함이다 — 고쳤다는 사실과 관측됐다는 사실을 섞지 마라.
