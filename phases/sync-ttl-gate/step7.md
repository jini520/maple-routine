# Step 7: docs-status

이 task 는 **페이지 이동 API 호출 정책 변경**([[ADR-097]])과 **이슈 #139**(레벨·외형이 피커를 열기 전까지 갱신되지 않음)를 구현했다. 이 step 은 **문서만** 손댄다 — `src/` 를 고치지 마라.

프로젝트 규칙(`CLAUDE.md`): *"ADR도 '설계, 구현 전'으로 남는 경우가 많음 — 구현 완료 시 `docs/adr/` 와 `docs/ADR.md` 인덱스 상태를 '구현 완료'로 명시할 것"*, *"`docs/features/*` 를 읽고 작업할 때 '열린 질문' 항목이 이미 구현됐는지 확인하고, 완료됐으면 열린 질문에서 제거·정리할 것"*.

## 읽어야 할 파일

- `/CLAUDE.md` (문서 규칙 — 위 두 항목)
- `/docs/README.md` (문서 인덱스)
- `/docs/adr/ADR-097.md` (이번 정책의 결정 원장 — 전문을 읽어라)
- `/docs/ADR.md` (슬림 인덱스 — 맨 아래 ADR-097 행)
- `/docs/features/content-scheduler.md` · `/docs/features/boss-scheduler.md` · `/docs/features/boss-profit.md` · `/docs/features/onboarding.md` (각 화면의 정책 문단)
- `/docs/foundation/architecture.md` ("이후 동기화" 절)
- `/docs/foundation/nexon-api.md` (`character/basic` 항목)
- **실제로 들어간 코드**: `/src/lib/sync-freshness.ts` · `/src/features/schedule-sync/sync-run-state.ts` · `/src/features/schedule-sync/schedule-sync.ts` · 세 스토어(`content-scheduler`·`boss-scheduler`·`boss-profit`)의 `store.ts`

## 작업

### 1. 문서와 구현이 어긋난 곳을 먼저 찾아라

ADR-097 은 **구현 전에** 쓰였다. 실제 구현이 결정과 다르게 끝난 부분이 있으면(함수명·자리·마감 처리 등) **문서를 구현에 맞춰 고치되, 결정 자체가 바뀐 것이라면 "정정" 표기를 남겨라**(옛 내용을 지우지 말고 무엇이 왜 바뀌었는지 적는다 — 프로젝트 문서 규칙).

특히 아래를 실제 코드와 대조하라.

- "상수와 자리" 표의 경로·이름(`src/lib/sync-freshness.ts` · `SYNC_TTL_MS` · `isSyncFresh` · 실행 플래그 모듈)
- 결정 4의 옵션 이름(`{ auto: true }`)과 판정 위치(캐시 우선 표시 직후)
- 결정 5의 보스 수익 `lastSyncedAt` 처리
- 결정 7의 편승 갱신 함수 위치

### 2. 상태를 '구현 완료'로 바꿔라

- `docs/adr/ADR-097.md` 의 `**상태**:` 줄 → 구현 완료 + 날짜 + 이슈 번호. 실기기에서 확인하지 않은 것이 있으면 그것도 함께 적어라(이 프로젝트는 "구현 완료"가 코드·자동 테스트 기준임을 문서에 명시해 왔다).
- `docs/ADR.md` 의 ADR-097 행 끝 상태 표기(`(설계 확정 · 구현 전, 이슈 #139)`)를 같은 값으로 맞춰라.

### 3. 검증에서 확인된 사실을 남겨라

ADR-097 의 "검증" 절은 **해야 할 일** 목록으로 쓰여 있다. 자동 테스트로 실제 확인된 항목과, 실기기·실사용으로만 확인 가능한 항목을 갈라 적어라. 각 항목 옆에 그것을 지키는 **테스트 파일 경로**를 적으면 다음 사람이 회귀 가드를 찾을 수 있다.

### 4. `character/basic` 갱신에 관한 문서 정리

- `docs/foundation/nexon-api.md` 의 `character/basic` 항목이 "호출 시점은 둘"이라고 말한다 — 구현과 일치하는지 확인하라.
- `docs/adr/ADR-015.md` 결정 3의 2026-08-06 확장 표기가 구현과 일치하는지 확인하라.

### 5. 이슈 #139 정리

이슈 본문은 수정 방향으로 세 가지를 제안했다(TTL 기반 갱신 / 기존 동기화에 편승 / TTL 값 결정). 실제로 채택된 것과 그 이유가 ADR-097 에 담겨 있는지 확인하고, **이슈에 남길 종결 코멘트 초안**을 이 step 의 `summary` 에 포함하라(코멘트를 직접 달지는 마라 — `gh` 명령을 실행하지 마라).

### 6. TTL 값이 잠정임을 문서가 분명히 말하는지 확인하라

`SYNC_TTL_MS` 는 사용자가 직접 쓰면서 조정하기로 한 값이다. **정책의 근거는 값이 아니라 "새로고침 수단이 있는데도 페이지 이동마다 같은 API 를 부르는 현재 방식이 틀렸다"** 이고, 값은 그 위에서 움직인다. 이 취지가 ADR-097 과 코드 주석 양쪽에 남아 있는지 확인하고, 빠져 있으면 **문서 쪽만** 보강하라.

## Acceptance Criteria

```bash
npm run build   # 문서만 고쳤으므로 그대로 통과해야 한다
npm test        # 그대로 통과해야 한다
npm run lint    # 그대로 통과해야 한다
grep -rn "설계 확정 · 구현 전" docs/adr/ADR-097.md docs/ADR.md   # 결과가 없어야 한다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 문서 체크리스트를 확인한다:
   - `docs/ADR.md` 는 슬림 인덱스로 유지되는가(전문은 `docs/adr/ADR-097.md` 에만)?
   - 옛 정책을 지우지 않고 "정정"·"확장" 표기로 남겼는가?
   - `docs/README.md` 의 기능→문서 매핑이 여전히 맞는가?
3. 결과에 따라 `phases/sync-ttl-gate/index.json` 의 step 7 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "갱신한 문서 목록 + 이슈 #139 종결 코멘트 초안"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`src/` 를 고치지 마라.** 이유: 이 step 은 문서 정리다. 코드가 문서와 다르면 **문서를 고치거나**, 코드 수정이 필요하다는 사실을 `summary` 에 남겨라(다음 작업으로 분리한다).
- **`gh issue close` 등 GitHub 명령을 실행하지 마라.** 이유: 이슈 종결은 사용자의 판단이다. 초안만 남긴다.
- **옛 정책 문장을 삭제하지 마라.** 이유: 이 프로젝트는 정책이 바뀔 때 옛 내용을 지우지 않고 "폐기된 정책 (history)" 또는 정정 표기로 남긴다.
- **ADR 전문을 `docs/ADR.md` 에 옮기지 마라.** 이유: 그 파일은 슬림 인덱스이고, 전문을 넣으면 매 세션 컨텍스트에 통째로 실린다.
- 기존 테스트를 깨뜨리지 마라.
