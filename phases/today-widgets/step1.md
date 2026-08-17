# Step 1: character-exp

## 읽어야 할 파일

- `/docs/README.md`
- **`/docs/foundation/nexon-api.md` 의 「확인 완료된 사실」절** — 이 step 이 쓰는 실측값이 거기 있다
- **`/docs/adr/ADR-146.md` 결정 7 + 정정 8**
- `/docs/adr/ADR-006.md`(확인 안 한 값을 단정하지 않는다) · `/docs/adr/ADR-057.md`(«모름» 과 «없음»)
- 코드: `packages/core/src/types/nexon-wire.ts` · `packages/core/src/types/character.ts` ·
  `packages/core/src/nexon/character/normalize.ts` ·
  `packages/core/src/nexon/character/__tests__/normalize.test.ts`

## 배경

`today` 의 대표 캐릭터 카드가 **경험치 진행률**을 그린다. 그 값은 `character/basic` 응답 안에 있어
**추가 호출이 0회**다(이미 부르는 응답에 편승).

사용자가 실응답을 확인해 줬다(2026-08-17):

```json
"character_exp": 1390734270108,
"character_exp_rate": "80.300"
```

**`character_exp_rate` 가 숫자가 아니라 문자열인 것이 이 step 의 전부다.** `access_flag` 가
`"true"`/`"false"` 문자열인 것과 **같은 모양의 함정**이고, 문자열째 비교하면 `"9.500" > "80.300"` 이
참이 되어(사전순) 진행률 바가 **조용히 뒤집힌다**.

## 작업

### 1. wire 타입

`packages/core/src/types/nexon-wire.ts` 의 `NexonCharacterBasicResponse` 에 **둘 다 옵셔널**로 더한다:

```ts
character_exp?: number
character_exp_rate?: string   // "80.300" — 숫자가 아니다
```

- 옵셔널인 이유: 미접속 캐릭터의 축약 응답(`/docs/foundation/nexon-api.md` 「응답 축약」)에서 빠질 수
  있고, 실측으로 «항상 온다» 를 확인한 적이 없다.
- **주석으로 문자열이라는 사실을 박아라.** 다음 사람이 `Number` 로 착각하는 것을 타입만으로는 못 막는다.

### 2. 도메인 타입

`packages/core/src/types/character.ts` 의 `CharacterBasicProfile` 에:

```ts
/** 현재 레벨 진행률(%). wire 의 문자열을 Number 로 푼 값. 옛 캐시 엔트리엔 없다. */
expRate?: number
```

- **`character_exp`(누적 절대값)는 도메인에 싣지 않는다.** 레벨이 오를수록 커지는 값이라 «얼마나
  남았나» 를 말하지 못하고, 카드가 답해야 하는 것은 진행률이다. 안 쓰는 값을 캐시에 넣으면 그
  캐시가 커지고 «왜 있지» 가 남는다.
- `world`·`jobClass`·`guildName` 이 이미 옵셔널인 것과 **같은 이유·같은 모양**이다.

### 3. 정규화

`normalizeCharacterBasic` 이 `character_exp_rate` 를 `Number()` 로 풀어 `expRate` 에 싣는다.

- **필드가 없으면 `expRate` 도 없다**(`undefined`). `0` 으로 채우지 마라 — 그 순간 «모름» 이 «0%» 가 된다.
- **`Number()` 결과가 `NaN` 이면 싣지 않는다.** 응답이 예상 밖 형식일 때 화면에 `NaN%` 가 나가는 것보다
  줄이 안 그려지는 편이 낫다.
- 빈 문자열 `""` 은 `Number('')` 이 `0` 이므로 **명시적으로 걸러라**(그 값이 «0%» 로 둔갑한다).

## 테스트 (먼저 작성한다)

`normalize.test.ts` 에 추가:

- `"80.300"` → `80.3`
- 필드 없음 → `expRate` 가 `undefined`
- `""` → `undefined` (0 이 아니다)
- `"abc"` → `undefined` (NaN 이 아니다)
- `"0.000"` → `0` (**진짜 0 은 실어야 한다** — 위 두 케이스와 갈리는 자리다)
- `character_exp` 가 와도 도메인 객체에 실리지 않는다

## 금지사항

- **`character_exp` 를 `CharacterBasicProfile` 에 넣지 마라.** 이유: 위 2번.
- **`expRate` 를 필수 필드로 만들지 마라.** 이유: 옛 캐시 엔트리에 그 필드가 없다 — 필수로 두면 캐시를
  읽는 자리가 전부 깨지거나, 깨지지 않게 `0` 을 채우게 되어 「모름」이 「0%」가 된다.
- **`character-basic-cache` 의 저장 형식이나 마이그레이션을 건드리지 마라.** 이유: 옵셔널 필드가 하나
  느는 것뿐이라 마이그레이션이 필요 없고, 그 파일은 인덱스 락([[ADR-017]] 결정 6)이 걸린 민감한 자리다.
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

