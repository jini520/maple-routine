# Step 4: account-probe-verdict

이 step 은 **이슈 #177** 을 닫는다 — 계정 선택에서 429 가 "조회 불가" 판정을 삼켜 **못 쓰는 계정이
정상으로 보이고 선택되는** 위음성을 없앤다. 만지는 것은 `use-account-probes.ts` ·
`AccountSelectionList.tsx` + 그 테스트다.

## 읽어야 할 파일

- `/docs/README.md` · `/docs/ADR.md`(지정한 것만)
- `/docs/adr/ADR-116.md` — **결정 3**(003 이 아닌 실패 = 판정 불가 · 판정 불가면 목록을 안 그린다)
- `/docs/adr/ADR-113.md` — **결정 3**(프로브 settle 전에는 목록을 그리지 않는다) · **결정 4**
  (`isSettled` 는 성공이 아니라 settle — **바꾸지 마라**) · **결정 7**(이 step 이 정정하는 결정)
- `/docs/adr/ADR-068.md` 결정 4(전수 프로브를 도입한 이유 — 대표 캐릭터 오염)
- `/docs/adr/ADR-067.md` 결정 1(400 코드 분화 — `OPENAPI00003` 만 영구)
- `/docs/features/onboarding.md` — 계정 선택 프로브 절(step 0 이 갱신했다)
- `/src/features/onboarding/use-account-probes.ts` (**전문** — 특히 `AccountProbe`·`AccountProbesState`
  타입, **121~125행**의 catch, **135~146행**의 `queryable`/`allUnavailable` 계산)
- `/src/app/onboarding/AccountSelectionList.tsx` (**88·95·134~139·151~155행** — 경고·비활성·CTA)
- `/src/features/onboarding/representative-character.ts`
- `/src/features/onboarding/__tests__/use-account-probes.test.ts`
- **step 1~3 산출물**: `noticeApiKeyIssue(kind)` · `useApiKeyNotice(error)`

## 배경 (고칠 결함)

`use-account-probes.ts:121-125` 의 catch 는 `characterUnavailable` 만 담고 **나머지 실패를 버린다.**

```ts
} catch (error) {
  if (toScheduleSyncError(error).kind === 'characterUnavailable') {
    unavailableOcids.add(character.ocid)
  }
}                       // ← 429 는 여기서 조용히 사라진다
```

그 결과 `queryable` 에 **아무것도 확인 못 한 캐릭터가 "조회 가능"으로** 들어가고
`allUnavailable` 은 **항상 false** 가 된다. 화면은 경고도 비활성도 없이 정상적인 목록을 그리고,
대표 캐릭터로 **조회 불가 캐릭터가 뽑힐 수도** 있다([[ADR-068]] 결정 4 가 없앴다고 적은 문제가 429
경로로 되살아난 것). 고르면 그대로 #176 의 잠금이다.

## 작업

TDD 다 — 테스트를 먼저 쓰고, 그다음 구현.

### 1. 판정을 세 갈래로 만든다

지금 `AccountProbe` 는 `allUnavailable: boolean` 하나로 두 갈래만 표현한다. **"확인하지 못했다"를 담을
자리를 만들어라.** 형태는 재량이지만 **아래 성질을 반드시 만족해야 한다**:

| 계정 상태 | 뜻 |
|---|---|
| 조회 가능 | 캐릭터 하나 이상이 **성공적으로 확인됐다** |
| 조회 불가(영구) | 전원이 `OPENAPI00003` 이다 — 지금과 같다 |
| **판정 불가(신규)** | 003 이 아닌 실패가 있어 **확인하지 못한 캐릭터가 남았다**([[ADR-116]] 결정 3) |

- **003 이 아닌 모든 실패**를 판정 불가로 묶는다(429 만이 아니다 — 사용자 결정). 규칙이 하나여서
  *"확인한 것만 보여준다"* 로 단순해진다.
- `queryable`(= 대표 캐릭터 후보)에는 **성공적으로 확인된 캐릭터만** 넣어라. 판정 못 한 캐릭터가 대표로
  뽑히면 [[ADR-068]] 결정 4 가 고친 문제가 그대로 되살아난다.
- **`isSettled` 의 의미를 바꾸지 마라**([[ADR-113]] 결정 4) — settle 은 여전히 "성공"이 아니다. 이 step 이
  바꾸는 것은 **settle 이후에 무엇을 그리는가**다.

### 2. 판정 불가면 목록을 그리지 않는다

- 계정이 하나라도 판정 불가면 `AccountSelectionList` 는 **목록을 그리지 않는다**([[ADR-116]] 결정 3 —
  [[ADR-113]] 결정 3 의 *"모르는 동안은 보여주지도 않는다"* 를 429 에도 적용).
- **그 자리에서 사용자가 앞으로 갈 수 있어야 한다**([[ADR-116]] 결정 4). 이 phase 의 429 경로는
  **모달**이 제공하므로, 판정 불가의 원인이 429 면 step 1~3 의 진입점을 부르면 된다 —
  `useApiKeyNotice` 를 쓰거나 원인을 위로 올려 화면이 부르게 하라. **`AccountProbe` 에 원인을 담아
  올리는 편이 낫다**(지금은 실패를 담을 자리가 없어 화면이 429 를 안다는 사실 자체가 없다).
- 429 가 아닌 원인(`network` 등)으로 판정 불가면 **모달을 띄우지 마라** — 그 자리에 맞는 실패 표시
  (`ErrorState`)와 재시도를 준다. 429 만 키 교체가 처방이다.
- **부분 판정으로 목록을 그리지 마라** — "일부는 확인했으니 그것만 보여준다"는 [[ADR-113]] 결정 3 과
  어긋난다(확신 없는 목록을 확신에 찬 모습으로 그리는 것이 이 이슈의 결함이다).

### 3. 테스트

`use-account-probes.test.ts`:
- 전원 003 → 조회 불가(기존 동작 회귀 가드).
- **429 가 섞이면 판정 불가**이고, `allUnavailable` 이 **false 로 위장되지 않는다**(이 이슈의 핵심).
- **429 로 확인 못 한 캐릭터는 대표로 뽑히지 않는다**([[ADR-068]] 결정 4 회귀 가드).
- `network` 실패도 판정 불가다(003 이 아닌 모든 실패).
- 성공/003 만 있으면 지금과 동일하게 동작한다.

`AccountSelectionList` 테스트:
- 판정 불가가 있으면 **목록·CTA 가 그려지지 않는다**.
- 003 계정의 기존 경고·비활성 동작은 **그대로**다(회귀 가드).

## Acceptance Criteria

```bash
npm run build
npm test
npm run lint                                     # errors 0
# 429 를 버리던 자리가 사라졌다
grep -c "kind === 'characterUnavailable'" src/features/onboarding/use-account-probes.ts   # 여전히 1 (003 판정은 남는다)
# 이 step 은 계정 선택 경로 밖을 건드리지 않는다
git status --porcelain -- src/ | grep -vE 'use-account-probes|AccountSelectionList|representative-character' | wc -l   # 0
```

## 검증 절차

1. 위 AC 를 전부 실행한다.
2. **판별력**: 판정 불가 분기를 지워 옛 동작(429 를 버리고 `queryable` 에 남김)으로 되돌리면 새 테스트
   중 **"429 가 섞이면 판정 불가"** 와 **"대표로 뽑히지 않는다"** 가 실제로 실패하는가? 확인 후 되돌리고
   결과를 summary 에 적어라.
3. **#177 → #176 인과가 끊겼는지 확인하라**(수동 추적): 429 로 판정 못 한 계정이 **선택 가능한 목록에
   나타나지 않으므로** 사용자가 그것을 골라 캐릭터 선택 잠금으로 갈 수 없다. 끊기는 고리가 있으면 적어라.
4. 아키텍처 체크: `features/` 가 `storage/`·`nexon/` 어댑터만 쓰는가 · [[ADR-113]] 결정 4(`isSettled`)를
   안 건드렸는가 · [[ADR-086]] 결정 9(계정별 캐시 인덱스)를 깨지 않았는가.
5. `index.json` step 4 갱신 — summary 에 **새 판정 타입의 형태**를 담아라(step 5·6 이 읽는다).

## 금지사항

- **`isSettled` 를 "성공"으로 바꾸지 마라.** 이유: 무한 스피너를 막는 장치다([[ADR-113]] 결정 4).
- **003 판정을 느슨하게 만들지 마라.** 이유: 그것만이 영구 판정이고([[ADR-067]] 결정 1), 넓히면 일시적
  실패가 영구 실패로 굳는다.
- **부분 판정으로 목록을 그리지 마라.** 이유: 이 이슈의 결함이 정확히 그것이다.
- **fan-out 동시성 캡을 넣지 마라.** 이유: 사용자가 이번 범위에서 기각했다([[ADR-116]] 결정 5).
- **`ErrorState` 컴포넌트 계약을 고치지 마라**(step 5).
- 기존 테스트를 깨뜨리지 마라.
