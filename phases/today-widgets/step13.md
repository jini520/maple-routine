# Step 13: docs-close

## 읽어야 할 파일

- `/docs/README.md` · **`/docs/features/today.md` 전문** · **`/docs/adr/ADR-146.md` 전문**
- `/docs/ADR.md` 의 ADR-146 행 · `/docs/adr/ADR-132.md` 의 「열린 질문」 · `/docs/adr/ADR-143.md` 결정 4
- `/CLAUDE.md` 의 「문서」절 — *"ADR 도 «설계, 구현 전» 으로 남는 경우가 많다 — 구현 완료 시
  `docs/adr/` 와 `docs/ADR.md` 인덱스 상태를 «구현 완료» 로 명시할 것"*
- **step 0~12 산출물 전부** (각 step 의 `summary` 를 읽어라)

## 배경

CLAUDE.md 의 docs-first 규칙은 **작업 후 점검**까지를 포함한다. 이 step 은 코드를 만들지 않고
**문서를 실제와 맞춘다.**

## 작업

### 1. 상태를 «구현 완료» 로

- `docs/adr/ADR-146.md` 머리의 `(설계 완료, 구현 전, 2026-08-17)` → `(구현 완료 <날짜> · 실기기 미검증)`
- `docs/ADR.md` 의 ADR-146 행 끝 `(**설계 완료, 구현 전**)` 도 같이
- `docs/features/today.md` 의 `**상태**: 설계 완료 · **구현 전**...` 줄

**실기기 검증을 하지 않았다면 «실기기 미검증» 을 반드시 남겨라** — 이 저장소의 다른 ADR 이 전부
그렇게 적혀 있고, 그 표기가 없으면 다음 사람이 검증된 것으로 읽는다.

### 2. 열린 질문 정리

`docs/features/today.md` 와 `ADR-146` 의 「열린 질문」에서 **구현으로 닫힌 것을 취소선 + 결과**로 옮기고,
남은 것만 둔다. **지우지 마라** — 이 저장소는 옛 내용을 지우지 않고 이력으로 남긴다.

구현으로 닫히지 **않는** 것들(그대로 두어야 한다):
- 전투력 도입 여부와 호출 예산
- 타일 탭의 목적지(실기기에서 눌러 보고 정한다)
- 온보딩 직후 착지([[ADR-132]] 열린 질문)
- 간격 12 · 행 높이 76(제안값 — 실기기 확정)
- `drop-history` 예열 여부(실측 뒤)
- 1주·3주 문구 풀이 둘뿐
- 2x2 대표 카드의 직업 잘림

### 3. 다른 문서의 낡은 문장 고치기

- **`docs/adr/ADR-132.md` 결정 8** — 단일 비행 구멍이 step 0 으로 닫혔다. 「열린 질문」의 그 줄을
  취소선 + «닫혔다» 로.
- **`docs/adr/ADR-143.md` 결정 4** — *"지금 이 값을 읽는 화면은 없다"* 가 낡았다(today 가 읽는다).
  이미 이 세션에서 갱신했다면 실제 구현과 일치하는지만 확인하라.
- **`docs/README.md`** 의 today 행 — 실제로 만들어진 파일 경로와 맞는지 확인(`app/today/widgets/` 등).
- **`docs/features/boss-scheduler.md`** — step 3 으로 `displayedBosses` 가 코어로 나갔다. 「관련 소스」에
  그 경로를 더하라.
- **`docs/features/item-drop.md`** — step 4 로 문구가 단계별 풀이 됐다. 그 문서가 문구 구조를 언급하고
  있으면 갱신하라.

### 4. 실측값을 문서에 반영

문서에 **제안값·추정치**로 적힌 것 중 구현으로 확정된 것을 실측값으로 바꿔라:
- 「남은 스케줄」 auto 높이 `55 + 45n` — 실제 구현 값과 다르면 **문서를 실제에 맞춰라**(반대가 아니다)
- 각 크기의 타일 픽셀 치수

### 5. 마지막 점검

`/docs/README.md` 의 「작업 유형별 길잡이」와 기능 인덱스 표가 today 를 정확히 가리키는지 확인.

## Acceptance Criteria (이 step 만 다르다)

```bash
npm run build
npx tsc --noEmit -p packages/app-rn/tsconfig.json
npm test
npm run lint
grep -rn "설계 완료, 구현 전" docs/adr/ADR-146.md docs/ADR.md   # 결과가 없어야 한다
grep -rn "물욕" packages/app-rn/src packages/core/src | grep -v "__tests__" | grep -v "^.*://"  # 화면 문구에 없어야 한다
```

## 금지사항

- **코드를 고치지 마라.** 이 step 은 문서만이다. 문서와 코드가 어긋나면 **문서를 코드에 맞춘다** —
  단, 코드가 ADR 을 위반한 것으로 보이면 고치지 말고 `blocked` 로 세우고 사유를 적어라.
- **열린 질문을 지우지 마라.** 취소선 + 결과로 남긴다.
- **«실기기 검증 완료» 라고 적지 마라.** 실기기에서 돌려 본 적이 없다면 거짓이다.
- **다른 ADR 의 옛 결정을 소급해 고쳐 쓰지 마라.** 폐기된 정책은 각 문서 하단 「폐기된 정책 (history)」로
  내린다(CLAUDE.md 규칙).

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. `docs/README.md` → `docs/features/today.md` → `docs/adr/ADR-146.md` 순으로 읽어 내려가며
   **실제 만들어진 파일과 한 줄씩 대조**한다.
3. 결과에 따라 `phases/today-widgets/index.json` 의 해당 step 을 갱신한다.
