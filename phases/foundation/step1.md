# Step 1: storage-adapter

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 특히 `storage/` 레이어의 위치와 역할, `features/*`가 `storage/`를 어댑터로만 거쳐 접근해야 한다는 규칙
- `/docs/ADR.md` — 특히 [[ADR-003]](백엔드 없이 기기 로컬 저장소만 사용), [[ADR-007]]의 "API 키는 storage의 보안 영역에 저장" 언급, [[ADR-008]](로컬 저장소 실패 시 사용자에게 명확히 알림, 온보딩 중 API 키 저장 실패 처리)
- `src/types/` (전체 파일) — 이전 step(`core-types`)에서 정의한 `NexonAuthConfig`, `SchedulerCharacterState` 등의 도메인 타입. 이 step은 이 타입들을 그대로 재사용한다.

이전 step에서 만들어진 타입을 꼼꼼히 읽고, 설계 의도를 이해한 뒤 작업하라.

## 배경

이 앱은 백엔드가 없고(ADR-003) 로컬 저장소만 쓴다. 이번 step은 그 로컬 저장소 접근을 캡슐화하는 `storage/` 어댑터를 만드는 것이다. **기술 선택은 이미 확정됨: `@capacitor/preferences`(key-value 저장소)만 사용한다.** SQLite 등 구조화 DB는 도입하지 않는다 — 이번 foundation 단계에서 저장할 데이터(API 키, 선택된 계정, 스케줄러 캐시)는 key-value로 충분하기 때문이다.

이 저장소 어댑터가 다룰 데이터:
1. **API 키** (`NexonAuthConfig.apiKey`) — Nexon Open API 개인 키. 평문으로 로그에 남기면 안 되는 민감 정보.
2. **선택된 계정** (`NexonAuthConfig.selectedAccountId`) — 하나의 Nexon 계정에 여러 메이플 ID(계정)가 있을 수 있어([[ADR-007]]), 사용자가 그중 하나를 선택해 등록한다. 나중에 설정에서 변경 가능해야 한다.
3. **캐릭터별 스케줄러 상태 캐시** (`SchedulerCharacterState`, ocid로 키 구분) — Nexon API 호출 실패 시([[ADR-008]]) 마지막으로 성공한 캐시를 그대로 보여줘야 하므로, 캐릭터(ocid)별로 마지막 동기화 결과를 저장해야 한다.

`@capacitor/preferences`는 iOS Keychain/Android Keystore 수준의 암호화를 자동으로 보장하지 않는다. [[ADR-007]]은 원래 "Keychain/Keystore 또는 암호화된 Preferences"를 요구하지만, 이번 foundation task는 사용자 결정에 따라 `@capacitor/preferences`만 우선 도입하고 강화된 보안 저장(Keychain/Keystore 전용 플러그인 도입 등)은 이후 별도 task로 미룬다. 이 사실을 `src/storage/api-key.ts` 상단에 한 줄 주석으로만 남겨라(별도 문서 작성 금지).

## 작업

1. `npm install @capacitor/preferences`로 의존성을 추가하라.

2. `src/storage/`에 아래 모듈을 작성하라(파일 분리는 재량, 시그니처는 최소 요구사항):

**`src/storage/api-key.ts`**
```ts
export async function getAuthConfig(): Promise<NexonAuthConfig | null>
export async function setApiKey(apiKey: string): Promise<void>
export async function setSelectedAccountId(accountId: string | null): Promise<void>
export async function clearAuthConfig(): Promise<void>
```

**`src/storage/scheduler-cache.ts`**
```ts
export async function getCachedSchedulerState(ocid: string): Promise<SchedulerCharacterState | null>
export async function setCachedSchedulerState(ocid: string, state: SchedulerCharacterState): Promise<void>
export async function clearCachedSchedulerState(ocid: string): Promise<void>
```

3. 내부적으로 `@capacitor/preferences`의 `Preferences.get`/`Preferences.set`/`Preferences.remove`를 사용하되, 저장 키 이름은 상수로 관리해 충돌을 방지하라(예: `apiKey`, `selectedAccountId`, 캐시는 `schedulerCache:{ocid}` 같은 프리픽스 방식).

4. `Preferences`는 문자열만 저장 가능하므로 객체는 `JSON.stringify`/`JSON.parse`로 직렬화하라. **파싱 실패(저장된 값이 손상된 JSON인 경우) 시 예외를 던져 앱을 죽이지 말고 `null`을 반환하라** — [[ADR-008]]의 "로컬 저장소 실패 시 조용히 무시하지 않되, 앱이 죽지 않게 방어적으로 처리한다"는 원칙과 일치시켜야 한다. 단, 쓰기 실패(`Preferences.set` 자체가 reject되는 경우)는 호출자가 알 수 있도록 그대로 에러를 전파하라(삼키지 마라) — [[ADR-008]]은 "쓰기 실패 시 사용자에게 즉시 알린다"고 명시하므로, 이 어댑터 레이어에서 에러를 삼켜버리면 상위 레이어가 실패를 알 방법이 없어진다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `storage/` 밖(예: `features/`, `app/`)에 파일을 추가하지 않았는가?
   - `@capacitor/preferences` 외 다른 저장 기술(SQLite 등)을 도입하지 않았는가?
   - `src/types/`의 기존 타입을 재사용했는가 (새로 중복 정의하지 않았는가)?
3. `src/storage/__tests__/`에 테스트를 먼저 작성한 뒤(TDD) 구현하라. `@capacitor/preferences`는 `vi.mock('@capacitor/preferences')`로 모킹해 실제 네이티브/브라우저 저장소에 의존하지 않고 단위 테스트하라. 최소한 다음을 검증하라:
   - `setApiKey` 후 `getAuthConfig`로 값을 읽으면 저장한 값이 그대로 나온다(round-trip).
   - 저장된 값이 없을 때 `getAuthConfig`/`getCachedSchedulerState`는 에러 없이 `null`을 반환한다.
   - 저장된 JSON이 손상된 경우 예외를 던지지 않고 `null`을 반환한다.
   - `Preferences.set`이 reject되면 `setApiKey`/`setCachedSchedulerState`도 그 에러를 그대로 전파한다(삼키지 않는다).
4. 결과에 따라 `phases/foundation/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성한 파일과 핵심 함수 목록을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- API 키를 `console.log` 등으로 출력하지 마라. 이유: 민감한 개인 인증 정보다.
- SQLite나 다른 구조화 DB를 도입하지 마라. 이유: 이번 foundation task는 `@capacitor/preferences`만 쓰기로 확정했다(추후 데이터가 커지면 별도 task에서 마이그레이션).
- `features/`나 `app/` 디렉토리를 만들거나 그 안에 코드를 작성하지 마라. 이유: 이번 step은 `storage/` 어댑터 레이어만 다룬다.
- 저장소 쓰기 실패를 catch해서 조용히 무시하지 마라. 이유: [[ADR-008]]에 따라 사용자가 쓰기 실패를 알 수 있어야 한다.
- 기존 테스트를 깨뜨리지 마라.
