# Step 6: profit-profile-reread

이 step 은 **GitHub 이슈 #139** 의 마무리다([[ADR-097]] 결정 7 후단).

**맥락**: 스케줄 동기화(`syncSchedules`)가 도는 회차에 그 대상 캐릭터의 `character/basic` 도 함께 받아 `character-basic-cache` 를 갱신하도록 앞선 step 에서 바꿨다(레벨·외형·월드·길드가 피커를 열기 전까지 굳던 문제). 컨텐츠·보스 스케줄러는 동기화가 끝난 **뒤** 그 캐시를 읽어 정렬·표시하므로 새 값이 그 회차에 바로 반영된다.

**문제**: 보스 수익 화면만 다르다. 이 스토어의 `refresh` 는 캐릭터 프로필(이미지·월드·정렬 순서)을 `getSortedCharacterInfo(ocids)` 로 **`syncSchedules` 보다 먼저** 읽는다. 그래서 편승 갱신으로 캐시가 새로워져도 **그 회차 화면은 옛 값을 그린다** — 새 레벨·이미지가 다음 진입으로 밀린다.

**처방**: 동기화 완료 분기에서 프로필을 다시 읽는다. 이것은 **로컬 캐시 읽기라 네트워크가 0회**다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — **TDD: 테스트 먼저**)
- `/docs/README.md` (문서 인덱스)
- `/docs/adr/ADR-097.md` (결정 원장 — 특히 **결정 7** 의 마지막 항목)
- `/docs/features/boss-profit.md` ("자동 기록" 절의 [[ADR-097]] 항목)
- `/src/features/boss-profit/store.ts` (이번 수정 대상 — `refresh` 와 그 안의 `getSortedCharacterInfo` 사용처를 끝까지 읽어라)
- `/src/features/schedule-sync/schedule-sync.ts` (편승 갱신이 들어간 자리 — 언제 캐시가 새로워지는지 확인하라)
- `/src/features/boss-profit/__tests__/store.test.ts` (기존 테스트 — `getCachedCharacterBasic` 이 모킹돼 있다)

## 작업

`src/features/boss-profit/store.ts` 의 `refresh` 에서, `results = await syncSchedules(ocids)` 가 **성공적으로 반환된 뒤** `getSortedCharacterInfo(ocids)` 를 다시 부르고, 그 결과로 아래 세 값을 새로 만들어 **동기화 완료 이후 코드가 그것을 쓰게** 한다.

- 정렬 순서(`sortedOcids`)
- 이미지 맵(ocid → imageUrl)
- 월드 맵(ocid → world)

동기화 이후에 이 값들을 쓰는 자리는 최소한 다음 셋이다. 전부 새 값을 쓰도록 바꿔라(빠뜨리면 화면 일부만 갱신돼 더 헷갈린다).

1. `characterProfiles` 를 조립하는 루프(`results` 를 돌며 `imageUrl`·`world` 를 채우는 곳)
2. `sortRowsByOcidOrder(unionRows, …)` 의 정렬 기준
3. `buildWeeklySubtotalsForMonth(…)` 에 넘기는 ocid 순서

기존 변수는 `const` 라 재대입할 수 없다. **이름을 나눠라**(예: 동기화 이후 값에 별도 이름을 주고, 캐시 우선 표시 단계는 기존 이름을 그대로 쓴다).

### 반드시 지킬 규칙

- **캐시 우선 표시 단계(동기화 이전)는 옛 값을 그대로 써야 한다.** 그 단계의 목적이 "지금 아는 것으로 즉시 그리기"다. 거기서 새 값을 기다리면 첫 페인트가 늦어진다.
- **재조회는 로컬 캐시 읽기여야 한다.** `getSortedCharacterInfo` 가 네트워크를 타지 않는다는 것을 코드로 확인하라. 새 API 호출을 추가하지 마라.
- **정렬이 바뀔 수 있다는 것은 의도된 결과다.** 레벨이 바뀌면 캐릭터 순서가 바뀐다 — 그게 이 step 의 목적이다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과 (신규 테스트 포함)
npm run lint    # ESLint 통과
```

### 테스트에 반드시 포함할 항목

`src/features/boss-profit/__tests__/store.test.ts` 에 케이스를 더한다.

- `getCachedCharacterBasic` 모킹이 **동기화 전후로 다른 값**(레벨·이미지)을 주도록 두고, `refresh` 완료 후의 `rows` 가 **나중 값**(imageUrl)을 담는다.
- 레벨이 바뀌어 순서가 뒤집히는 경우, 최종 `rows` 의 캐릭터 순서가 **새 레벨 기준**이다.
- 네트워크 호출 수가 늘지 않는다(`syncSchedules` 모킹 호출 횟수 불변).

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `docs/foundation/architecture.md` 레이어 규칙을 따르는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/sync-ttl-gate/index.json` 의 step 6 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(재조회 위치·갱신된 사용처)"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **캐시 우선 표시 단계에서 프로필을 다시 읽지 마라.** 이유: 그 단계는 네트워크 이전에 즉시 그리는 것이 목적이라, 조회를 하나 더 붙이면 첫 페인트가 그만큼 늦어진다.
- **동기화가 실패해 조기 반환하는 경로에 재조회를 넣지 마라.** 이유: 그 경로는 화면을 갱신하지 않고 에러 상태로 끝난다 — 쓰지 않을 값을 읽는 것이다.
- **`refresh` 를 리팩터링하지 마라**(함수 분리·순서 변경). 이유: 이 함수는 세대 가드·백필·자동 기록이 얽혀 있어 무관한 이동이 섞이면 회귀 원인을 가릴 수 없다.
- **새 API 호출을 추가하지 마라.** 이유: 이 step 의 전제가 "로컬 읽기라 네트워크 0회"다.
- 기존 테스트를 깨뜨리지 마라.
