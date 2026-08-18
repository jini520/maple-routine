# Step 11: widget-drops

## 읽어야 할 파일

- `/docs/README.md` · **`/docs/features/today.md` 의 「4·7·8」·「8. 아이템 드롭 가뭄」절**
- **`/docs/adr/ADR-147.md` 결정 9 + 정정 6·10·14**
- `/docs/features/item-drop.md` · `/docs/adr/ADR-071.md`
- 코드: `packages/core/src/lib/drop-history.ts` · `packages/app-rn/src/components/mapleLeafPath.ts` ·
  `packages/app-rn/src/app/boss-profit/DropHistoryScreen.tsx`(무작위 인덱스를 고르는 관례)
- **step 4·6·7 산출물**: 단계별 문구 풀 · 뷰모델 · 위젯 껍데기


## 공통 규칙 (이 step 의 모든 위젯에 걸린다)

- **위젯은 스토어를 모른다.** `data: TodayViewModel` 프롭만 읽는다([[ADR-147]] 결정 4).
- **`w`·`h` 로 갈라 스스로 다르게 그린다** — 크기가 줄면 **무엇을 버릴지 위젯이 정한다.**
- **타일은 스스로 커지거나 줄지 않고, 타일 안에서 스크롤하지 않는다.** 넘치면 자르거나 접는다.
- **위젯은 사라지지 않는다**([[ADR-147]] 결정 5) — 데이터가 없어도 자기 타일 안에서 빈 상태를 말한다.
- **«없다» 와 «모른다» 를 가른다.**
- **색은 테마 토큰만 쓴다.** 하드코딩 hex 금지.
- **선언한 크기를 전부 구현한다**(사용자 확정) — v1 배치가 안 쓰는 크기도 남긴다. 각 크기는
  **스냅샷 테스트**로 검증한다(그것이 안 쓰이는 분기의 유일한 안전망이다).


## 작업

### 1. 가격 미입력 드롭 — `widgets/UnpricedDropsWidget.tsx`

| 크기 | 형태 |
|---|---|
| **2x1** (기본) | 숫자 배지 36 + 「가격 미입력」 + `기록하기 ›` |
| 2x2 | 헤더 + 아이템 **셋까지 미리보기** + `외 N건 · 기록하기 ›` |
| 1x1 | 숫자 + 「가격 미입력」 |

- **0건이어도 타일은 남는다** — 「전부 기록했습니다」로 내용을 바꾼다. 사라지면 격자에 구멍이 나고,
  다음 주에 다시 나타날 때 «새 기능» 처럼 보인다.
- 2x2 의 미리보기가 있는 이유: 「값을 적어야지」보다 **「그 연마석 얼마에 팔았지」** 가 손을 움직이는 문장이다.

### 2. 아이템 드롭 가뭄 — `widgets/ValuableDroughtWidget.tsx`

| 크기 | 형태 |
|---|---|
| **4x1** (기본) | 단풍잎 26 + 헤드라인 + `마지막 · 7월 3주차 · 생명의 연마석 외 1개` + `3주째` 칩 |
| 2x2 | 단풍잎 54(크게) + 헤드라인 + `3주째 아이템 드롭 없음` (마지막 기간 줄 없음) |
| 2x1 | 단풍잎 22 + 헤드라인 + `3주째` |

- **단풍잎은 `components/mapleLeafPath.ts` 의 `MAPLE_LEAF_PATH`** 를 쓴다. 새로 그리지 마라.
- **잎이 단계에 따라 기울고 흐려진다** — `getValuableDroughtTier(weeksSince)` 로 단계를 얻어
  회전각·불투명도를 고른다(0주 = 곧게 선 진한 잎 → 4주+ = 거의 누운 옅은 잎).
- **0주(이번 주 획득)만 배경이 바뀐다** — `primary-tint`. 유일하게 축하하는 타일이라 여기서만 쓴다.
- **`summarizeValuableDrought` 가 `null` 이면 «아직 아이템 드롭 기록이 없습니다»** — «0주째» 로
  위장하지 마라. 안 먹은 것과 안 적은 것은 다르다.
- **무작위 인덱스는 마운트당 한 번** 고른다(`useState(() => ...)` 초기화 함수). 매 렌더마다 고르면
  리렌더 때 문구가 깜빡인다. `valuableDroughtHeadlineCount(weeksSince)`(step 4)로 범위를 얻는다.

### 3. 용어 — 「물욕」을 쓰지 마라 ([[ADR-147]] 정정 14)

- 화면에 보이는 한국어는 **「아이템 드롭」**이다. `«3주째 아이템 드롭 없음»` ·
  `«아직 아이템 드롭 기록이 없습니다»`.
- **영문 식별자는 그대로다** — `valuable-drought` · `isValuableDrop` · `summarizeValuableDrought`.
- 실측상 **지금 앱의 사용자 노출 문구에 「물욕」이 한 번도 안 나온다** — 이 규칙은 «새로 들이지 않는 것» 이다.

## 테스트

- 세 크기 × 두 위젯 스냅샷
- 미입력 0건 → 「전부 기록했습니다」, **타일은 남는다**
- `drought === null` → 「아직 아이템 드롭 기록이 없습니다」(0주째가 아니다)
- 0주 → 배경이 `primary-tint`, 나머지 단계는 기본 배경
- 단계별 잎 각도·불투명도가 `getValuableDroughtTier` 를 따른다
- 문구가 **리렌더에도 안 바뀐다**(마운트당 한 번)
- **렌더 결과 어디에도 「물욕」 문자열이 없다**

## 금지사항

- **「물욕」을 화면 문구에 쓰지 마라.** 이유: [[ADR-147]] 정정 14.
- **영문 식별자를 리네임하지 마라.** 이유: 코어 API 이름을 바꾸면 [[ADR-038]]·[[ADR-071]] 계약이
  이름만 다른 두 벌이 된다.
- **`Math.random()` 을 렌더 본문에서 부르지 마라.** 이유: 리렌더마다 문구가 깜빡인다.
- **미입력 0건일 때 타일을 숨기지 마라.** 이유: 좌표 배치라 빈 사각형이 남는다.
- **`summarizeValuableDrought` 의 `null` 을 «0주» 로 취급하지 마라.** 이유: 안 먹은 것과 안 적은 것은 다르다.
- 기존 테스트를 깨뜨리지 마라.

## Acceptance Criteria

```bash
npm run build                                       # core 타입 검사 포함
npx tsc --noEmit -p packages/app-rn/tsconfig.json   # RN 타입 (루트 tsconfig 는 참조 스텁이라 무의미하다)
npm test                                            # vitest(core·capacitor) + jest(app-rn)
npm run lint
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. 아키텍처 체크리스트:
   - `/docs/foundation/architecture.md` 디렉토리 구조를 따르는가?
   - CLAUDE.md CRITICAL — `features/*` 가 저장소·네이티브를 직접 만지지 않는가([[ADR-003]]·[[ADR-005]])?
   - CLAUDE.md CRITICAL — `src/data/` 의 게임 수치를 임의로 추정하지 않았는가([[ADR-006]])?
   - 새 컴포넌트를 만들었다면 아토믹 계층 자리가 맞는가(`components/__tests__/layer-dependencies.test.ts`)?
3. 결과에 따라 `phases/today-widgets/index.json` 의 해당 step 을 갱신한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."` 후 즉시 중단

