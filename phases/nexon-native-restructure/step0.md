# Step 0: nexon-restructure

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — "디렉토리 구조" 섹션의 `nexon/` 항목:
  ```
  ├── nexon/                   # Nexon Open API 클라이언트 ([[ADR-007]]) — 사용자 개인 API 키로 직접 호출, 서버 없음
  │   ├── character/            # GET /maplestory/v1/character/list로 계정 소속 캐릭터 목록 자동 조회(수동 등록 폼 없음)
  │   └── schedule/             # 스케줄러 Open API 호출 + src/data/ 참조 테이블과의 매핑(난이도 영↔한글, 보스명 정규화, cycle 기반 bossDaily 필터링)
  ```
  지금 `src/nexon/`은 이 트리와 다르게 `character/`·`schedule/` 하위 폴더 없이 flat하게(`client.ts`/`errors.ts`/`normalize.ts`) 구현돼 있다. 이번 step은 **문서에 이미 정의된 구조에 맞춰 코드를 재구성**한다(문서는 건드리지 않는다 — 문서가 맞고 코드가 안 맞는 상황을 코드 쪽에서 고친다).
- `src/nexon/client.ts`, `src/nexon/errors.ts`, `src/nexon/normalize.ts` — 지금 구현 전체를 읽어라.
- `src/features/schedule-sync/schedule-sync.ts`, `src/features/onboarding/store.ts` — 이 두 파일과 각각의 테스트 파일이 `nexon/client`·`nexon/errors`를 import하고 있다. 이번 리팩터로 import 경로가 바뀐다.

## 배경

`nexon/client.ts`는 캐릭터 목록 조회(`fetchCharacterList`)와 스케줄 동기화(`fetchSchedulerCharacterState`/`fetchSchedulerStatesForCharacters`)를 한 파일에 같이 갖고 있고, `normalize.ts`도 두 관심사(`normalizeCharacterList`/`normalizeSchedulerCharacterState`)를 같이 갖고 있다. 이번 step은 이걸 문서가 정의한 대로 `character/`와 `schedule/` 두 하위 모듈로 쪼갠다. **동작(런타임 로직)은 하나도 바꾸지 않는다** — 파일 위치와 import 경로만 바뀐다.

## 작업

1. **공용 HTTP 헬�퍼 분리**: 지금 `client.ts` 안에 있는 `requestJson`(내부 헬퍼, `AAbortController` 기반 10초 타임아웃 + 상태 코드별 에러 던지기)을 `src/nexon/http.ts`로 옮겨라. `character/`와 `schedule/` 양쪽이 이걸 가져다 쓴다.

2. **`src/nexon/character/`**:
   - `src/nexon/character/client.ts` — `fetchCharacterList(apiKey: string): Promise<MapleAccount[]>`를 여기로 옮긴다. `nexon/http.ts`의 `requestJson`과 `nexon/character/normalize.ts`의 `normalizeCharacterList`를 사용.
   - `src/nexon/character/normalize.ts` — `normalizeCharacterList`를 여기로 옮긴다.
   - `src/nexon/character/index.ts` — 위 둘을 재수출하는 배럴(선택 사항, 다른 `src/` 모듈들의 배럴 컨벤션과 맞춰라).
   - 테스트: 기존 `src/nexon/__tests__/client.test.ts`·`normalize.test.ts`에서 캐릭터 목록 관련 테스트 케이스를 `src/nexon/character/__tests__/`로 옮긴다.

3. **`src/nexon/schedule/`**:
   - `src/nexon/schedule/client.ts` — `fetchSchedulerCharacterState`/`fetchSchedulerStatesForCharacters`를 여기로 옮긴다.
   - `src/nexon/schedule/normalize.ts` — `normalizeSchedulerCharacterState`와 그 내부 헬퍼(`normalizeDailyContent`/`normalizeWeeklyContent`/`normalizeBossContent`/`DIFFICULTY_MAP`)를 여기로 옮긴다.
   - `src/nexon/schedule/index.ts` — 배럴(선택 사항).
   - 테스트: 스케줄 동기화·정규화 관련 테스트 케이스를 `src/nexon/schedule/__tests__/`로 옮긴다.

4. **`src/nexon/errors.ts`는 그대로 `nexon/` 루트에 둔다** — `character/`와 `schedule/` 양쪽이 공유하는 에러 타입이라 어느 한쪽 하위 폴더에 속하지 않는다.

5. **importer 갱신**: 아래 파일들의 import 경로를 새 위치에 맞게 고쳐라(가져오는 함수 이름 자체는 바뀌지 않는다):
   - `src/features/schedule-sync/schedule-sync.ts` — `fetchCharacterList`는 `nexon/character`에서, `fetchSchedulerCharacterState`는 `nexon/schedule`에서 가져오도록 바꾼다.
   - `src/features/onboarding/store.ts` — `fetchCharacterList`를 `nexon/character`에서 가져오도록 바꾼다.
   - 두 파일의 테스트(`schedule-sync.test.ts`, `onboarding/__tests__/store.test.ts`)의 `vi.mock` 경로도 새 위치에 맞게 고친다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/nexon/`이 `ARCHITECTURE.md`의 트리(`character/`, `schedule/` 하위 폴더 + 루트의 `errors.ts`)와 일치하는가?
   - `src/nexon/client.ts`·`src/nexon/normalize.ts`(옛 flat 파일)가 남아있지 않고 완전히 대체됐는가?
3. 기존 테스트를 전부 새 위치로 옮기되, 테스트 코드 자체(assertion 내용)는 바꾸지 마라 — 파일 위치와 import 경로만 바뀐다. `npm test`가 기존과 동일한 테스트 개수로 전부 통과해야 한다(테스트를 삭제하거나 개수를 줄이지 마라).
4. 결과에 따라 `phases/nexon-native-restructure/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 옮긴 파일 목록을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- 런타임 로직(요청 방식, 에러 처리, 정규화 규칙 등)을 바꾸지 마라. 이유: 이번 step은 순수 파일 재구성이지 동작 변경이 아니다.
- 테스트 케이스를 줄이거나 assertion 내용을 바꾸지 마라. 이유: 위치만 옮기는 리팩터이므로 커버리지가 그대로 유지돼야 한다.
- `errors.ts`를 `character/`나 `schedule/` 밑으로 옮기지 마라. 이유: 두 모듈이 공유하는 에러 타입이라 `nexon/` 루트가 맞다.
- `docs/ARCHITECTURE.md`를 수정하지 마라. 이유: 문서는 이미 맞고, 이번 step은 코드를 문서에 맞추는 작업이다.
