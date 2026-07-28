# Step 4: docs-finalize

구현이 끝났으므로 문서 상태를 "구현 완료"로 맞추고, 문서에 적힌 삭제 범위와 실제 구현이 일치하는지 최종 대조한다. CLAUDE.md의 "작업 완료 후 문서를 다시 점검해 완료된 항목을 반영(체크)할 것", "ADR도 구현 완료 시 상태를 명시할 것" 규칙을 이행하는 step이다.

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — ADR-052 줄의 상태 표기 갱신 대상)
- `/docs/adr/ADR-052.md` — 제목의 상태 표기 갱신 대상.
- `/docs/adr/ADR-035.md` — step 0에서 추가한 "보류 해소" 정정이 실제 구현과 일치하는지 확인.
- `/docs/persistence/lifecycle.md`·`preferences.md`·`sqlite.md`·`README.md` — step 0에서 갱신한 내용이 실제 구현과 일치하는지 확인.
- **이전 step들에서 수정된 코드(읽기만, 로직 수정 금지)**:
  - `/src/storage/sqlite/db.ts` (step 1 — `TABLE_DEFINITIONS`·`BOSS_PROFIT_TABLE_NAMES`)
  - `/src/storage/cache-data.ts` (step 2 — 최종 `KEEP_KEYS`·삭제 범위)
  - `/src/app/settings/CacheClearConfirm.tsx` (step 3 — 확인 모달 문구)

## 작업

### 1. ADR 상태를 "구현 완료"로 표기

- `docs/adr/ADR-052.md` 첫 줄 제목의 `(설계, 구현 전)`을 `(구현 완료, YYYY-MM-DD)`로 바꾼다. 날짜는 `date +%Y-%m-%d`로 실제 오늘 날짜를 구해서 쓴다.
- `docs/ADR.md` 인덱스의 ADR-052 줄에도 `(구현 완료)`를 반영한다(다른 줄들의 표기 형식을 그대로 따를 것).
- ADR-052 말미에 **구현 완료 문단**을 한 단락 추가한다 — 바뀐 파일(`storage/sqlite/db.ts`, `storage/cache-data.ts`, `app/settings/CacheClearConfirm.tsx`)과 각 결정이 어디에 반영됐는지, 그리고 추가된 회귀 가드 테스트 2종(`db.test.ts`의 소스↔export 일치, `cache-data.test.ts`의 전 테이블 DELETE)을 적어라.

### 2. 문서와 구현의 최종 대조

아래를 **실제 코드와 한 항목씩 대조**하고, 어긋나면 **문서 쪽을 실제 구현에 맞춰** 고쳐라(코드는 건드리지 마라).

- `docs/persistence/lifecycle.md`의 mermaid `K2` 보존 노드가 `cache-data.ts`의 `KEEP_KEYS`와 정확히 같은 5개인가?
- 같은 문서 `Y2` 노드의 테이블 목록이 `db.ts`의 `TABLE_DEFINITIONS`와 같은 4개인가?
- `docs/persistence/preferences.md`의 "캐시 삭제 시" 열이 실제 `KEEP_KEYS` 소속 여부와 전부 일치하는가?
- `docs/persistence/sqlite.md`의 테이블 목록·ERD가 `db.ts`와 일치하는가?
- `CacheClearConfirm.tsx`의 삭제됨/유지됨 문구가 `lifecycle.md`의 범위 서술과 일치하는가?

### 3. step 2 조사 결과 반영

step 2의 "작업 4"에서 **캐시 삭제 후 수동 모드(`trackingMode: 'manual'`) 복구 경로**를 조사했다. `phases/cache-clear-scope/index.json`의 step 2 `summary`에서 그 결과를 확인하고:

- 복구 경로가 **살아 있으면** → `docs/persistence/lifecycle.md`에 "캐시 삭제 후 `trackingMode`는 남지만 `manualTrackedContent:*`·`trackedCharacters`는 지워지며, 사용자가 캐릭터를 다시 선택하면 [[ADR-035]] 결정 14(b) 시드로 멤버십이 복구된다"는 취지를 한 문단 추가하라.
- 복구 경로가 **끊겨 있으면** → 문서에 그 사실을 "알려진 제약"으로 적고, **별도 이슈로 올릴 내용을 step summary에 정리**하라. 이 step에서 코드로 고치지 마라.

### 4. 잔재 점검

```bash
grep -rn "3개 테이블\|세 SQLite 테이블\|CLEARED_TABLES" docs/ src/
```

- "3개 테이블" 류의 개수 고정 표현이 문서에 남아 있으면 현행화하라.
- `src/`의 주석에 옛 범위를 서술한 것이 남아 있으면 주석만 고쳐라(로직은 건드리지 마라).

### 5. 열린 질문 점검

`docs/features/settings.md`·`docs/persistence/*`의 "열린 질문"·"후속 task" 항목을 훑어, 이번 작업으로 해소된 항목이 있으면 제거·정리하라(CLAUDE.md 규칙). 이슈 #6(선택 삭제 UI)·#7(IAP 구매 상태 키)은 **미해결이므로 지우지 마라** — 다만 #7에 대해서는 "구매 상태 키가 생기면 반드시 `KEEP_KEYS`에 넣어야 한다"는 규칙이 `docs/persistence/lifecycle.md` 또는 `preferences.md`에 명시돼 있는지 확인하고, 없으면 한 줄 추가하라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 전체 테스트 통과
npm run lint    # 경고 0

# ADR 상태 표기 확인 — 둘 다 결과가 나와야 한다
grep -n "구현 완료" docs/adr/ADR-052.md
grep -n "ADR-052" docs/ADR.md

# 하드코딩 목록이 코드에 남아 있지 않은지 — 결과가 없어야 한다
grep -rn "CLEARED_TABLES" src/
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ADR-052·ADR.md 인덱스가 "구현 완료" 상태로 표기됐는가?
   - `docs/persistence/*`의 삭제 범위 서술이 실제 코드와 **항목 단위로** 일치하는가?
   - 옛 정책을 **삭제**하지 않고 정정/history로 남겼는가?
   - 이 step에서 로직을 바꾸지 않았는가? (`git diff`로 `src/` 변경이 주석뿐인지 확인)
3. 결과에 따라 `phases/cache-clear-scope/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 갱신한 문서·정리한 잔재·(있다면) 별도 이슈로 올릴 항목을 요약하라.
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `src/`의 **로직**을 바꾸지 마라. 이유: 구현은 step 1~3에서 끝났다. 허용되는 `src/` 변경은 사실과 달라진 주석의 현행화뿐이다.
- 문서와 구현이 어긋날 때 코드를 문서에 맞추지 마라. 이유: 테스트로 검증된 구현이 진실이다. 구현 자체가 [[ADR-052]]와 다르다고 판단되면 고치지 말고 `blocked`로 보고하라.
- 수동 모드 복구 경로가 끊겨 있더라도 이 step에서 고치지 마라. 이유: 시드 로직 수정은 이 phase(저장소 삭제 범위)의 범위를 벗어난다 — 별도 이슈 대상이다.
- 이슈 #6·#7 관련 "열린 질문" 항목을 지우지 마라. 이유: 아직 미해결이다.
- 기존 테스트를 깨뜨리지 마라.
