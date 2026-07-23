# Step 0: storage-tracking-layer

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-035 전체(특히 결정 3, 6, 7, 8, 9, 10)
- `/docs/ARCHITECTURE.md` — `storage/` 디렉토리 설명, 데이터 흐름 절
- `/docs/persistence/README.md`, `/docs/persistence/lifecycle.md` — 영속 데이터 계층 구조, "캐시 데이터 삭제" 삭제 범위(KEEP_KEYS 방식)
- `/src/storage/character-selection.ts` — get/set 왕복 패턴(카캐릭터별 배열을 JSON으로 저장), 기본값 처리 방식 참고
- `/src/storage/keys.ts` — 기존 키 네이밍 컨벤션(`{개념}:{ocid}` 형태 헬퍼 함수들)
- `/src/storage/cache-data.ts` — `KEEP_KEYS`가 allowlist 방식임을 확인할 것(이 step에서 이 파일을 수정하지 않는 이유의 근거)
- `/src/storage/__tests__/character-selection.test.ts` — 테스트 컨벤션(Preferences 모킹 방식)
- `/src/data/scheduler-content-template.json` — 이미 채워진 실제 데이터(daily 18개, weekly 22개, 확정값 — 사용자 확인 완료)

이전 step에서 만들어진 코드는 없다(이 phase의 첫 step). 위 파일을 꼼꼼히 읽고 기존 Preferences 어댑터 패턴을 이해한 뒤 작업하라.

## 작업

ADR-035 결정 1·6·7·8·9에 따라 신규 Preferences 저장 레이어 2개를 추가한다. SQLite는 쓰지 않는다(결정 9 — writer가 사용자 UI 하나뿐이라 락 불필요).

### 1. `src/storage/keys.ts` 수정

- `STORAGE_KEYS` 객체에 `trackingMode: 'trackingMode'`를 추가한다(전역 단일 키, `apiKey`/`selectedAccountId`/`theme`와 동일한 패턴).
- 캐릭터별 키 헬퍼 `manualTrackedContentKey(ocid: string): string`을 추가한다 — `` `manualTrackedContent:${ocid}` `` 반환(기존 `schedulerCacheKey` 등과 동일한 네이밍 컨벤션).

### 2. `src/storage/tracking-mode.ts` 신규

```ts
export type TrackingMode = 'auto' | 'manual'

// 저장된 값이 없으면 'auto'를 기본값으로 반환한다(ADR-035 결정 2 — 자동 모드가 기본).
export async function getTrackingMode(): Promise<TrackingMode>

export async function setTrackingMode(mode: TrackingMode): Promise<void>
```

### 3. `src/storage/manual-tracked-content.ts` 신규

```ts
export interface ManualTrackedItem {
  contentName: string
  kind: 'content' | 'boss'
  difficulty?: string // kind: 'boss'일 때만 사용(보스명만으로는 유일하지 않음)
  maxCount?: number // kind: 'content'이고 카운트형(now_count/max_count)일 때만. ADR-035 결정 7 — 개발자가 템플릿에 미리 채운 값을 그대로 복사해 저장(앱 사용자가 입력하는 UI 없음)
}

// 저장된 값이 없으면 빈 배열을 반환한다.
export async function getManualTrackedContent(ocid: string): Promise<ManualTrackedItem[]>

// 배열 전체를 덮어쓴다(character-selection.ts의 setTrackedCharacterOcids와 동일한 "전체 교체" 패턴 — 부분 추가/삭제는 호출부가 배열을 계산해서 넘긴다).
export async function setManualTrackedContent(ocid: string, items: ManualTrackedItem[]): Promise<void>
```

**`kind` 필드에 대한 설계 해석(ADR-035 원문이 enum을 명시하지 않아 이 step에서 확정)**: `'content' | 'boss'`로 둔다 — 기존 코드베이스가 이미 `trackedCharacters:content`/`:boss`로 컨텐츠·보스 두 축을 독립적으로 다루고 있어(`storage/character-selection.ts`), 같은 축 구분을 그대로 재사용하는 것이 일관적이다. 컨텐츠 항목이 일간인지 주간인지는 이 배열이 알 필요 없다 — 화면(컨텐츠 스케줄러)이 이미 어느 탭을 보여주는지 알고 있으므로, 표시 시점에 `contentName`으로 해당 탭의 카탈로그(스케줄 캐시 또는 템플릿)에서 조회하면 된다(이 조회 로직은 이후 step 7의 범위).

### 4. `src/data/scheduler-content-template.json`의 `note` 필드 정리

이 파일은 이미 실제 확정 데이터(daily 18개 + weekly 22개, 사용자 확인 완료)로 채워져 있는데, `note` 필드가 여전히 "아래 두 항목은 형태를 보여주기 위한 예시이니 실제 목록으로 교체·확장할 것"이라는 stale한 문구를 담고 있다. 이 문장만 제거하고 나머지 설명(용도, ADR-006 절차 안내, content_name 일치 필요성 등)은 그대로 둔다. **수치 자체(특히 `max_count`)는 이미 확정값이므로 절대 변경하지 마라.**

### 테스트 (TDD)

`src/storage/__tests__/tracking-mode.test.ts`, `src/storage/__tests__/manual-tracked-content.test.ts`를 신규 작성한다. `character-selection.test.ts`의 `@capacitor/preferences` 모킹 패턴(Map 기반 인메모리 store)을 그대로 재사용한다. 최소 검증 항목:
- `getTrackingMode()`는 저장된 값이 없으면 `'auto'`를 반환한다.
- `setTrackingMode('manual')` 후 `getTrackingMode()`는 `'manual'`을 반환한다.
- `getManualTrackedContent(ocid)`는 저장된 값이 없으면 `[]`를 반환한다.
- `setManualTrackedContent(ocid, items)` 후 `getManualTrackedContent(ocid)`는 저장한 배열을 그대로 반환한다.
- 서로 다른 ocid의 데이터는 독립적으로 저장된다(character-selection.test.ts의 "content/boss 독립성" 테스트와 동일한 취지).

테스트를 먼저 작성하고 실패를 확인한 뒤 구현으로 통과시켜라(CLAUDE.md TDD 규칙).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `storage/` 레이어에만 변경이 있는가(features/*를 건드리지 않았는가)?
   - `manual-tracked-content.ts`에 `nowCount`/`questState`/`isComplete`/`isRegistered` 같은 동기화 유래 값 필드를 추가하지 않았는가(ADR-035 결정 6 — 단일 진실 공급원 원칙)?
   - `scheduler-content-template.json`의 수치를 하나라도 바꾸지 않았는가(ADR-006 CRITICAL)?
3. 결과에 따라 `phases/manual-tracking-mode/index.json`의 `step: 0`을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `storage/cache-data.ts`의 `KEEP_KEYS`에 `trackingMode`나 `manualTrackedContent:*`를 추가하지 마라. 이유: 사용자가 "캐시 데이터 삭제 시 트래킹 모드를 보존하지 않는다"고 명시적으로 결정했다. `KEEP_KEYS`는 allowlist라 아무것도 추가하지 않아도 새 키는 자동으로 삭제 대상이 된다 — 여기에 키를 추가하면 오히려 사용자 결정과 반대로 "보존"이 되어버린다.
- `features/*` 코드를 이 step에서 만들거나 수정하지 마라. 이유: 다음 step(`tracking-mode-store`, `manual-tracking-seed`)의 범위이며, 한 step에서 한 레이어만 다루는 원칙을 지키기 위함이다.
- `scheduler-content-template.json`의 `daily`/`weekly` 배열 항목이나 수치를 추가·수정·삭제하지 마라(`note` 필드 텍스트 정리만 허용). 이유: 이 값들은 이미 사용자가 확정한 게임 레퍼런스 데이터다(ADR-006).
- 기존 테스트를 깨뜨리지 마라.
