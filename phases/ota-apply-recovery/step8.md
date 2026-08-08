# Step 8: cache-data-order

이 step 은 **`src/features/settings/cache-data.ts` 의 `clearCacheDataAndReload` 하나만 고친다.**
OTA 경로(`native/live-update.ts`·`features/live-update/store.ts`)는 이미 step 3·4 가 끝냈다.

## 이 step 이 끊는 고리

`clearCacheDataAndReload` 는 **OTA 적용 경로와 똑같은 결함**을 갖는다 — 화면을 먼저 가린 뒤에
매달릴 수 있는 작업을 하고, 그 뒤에 화면을 되살리는 일(`reload()`)이 있다:

```ts
await showSplashScreen().catch(() => {})   // ← 커버가 먼저 올라간다
await closeBossProfitDb()                  // ← 여기서 매달리면
reload()                                   // ← 여기 도달하지 못한다 → 주황 화면 무한
```

증상이 이슈 #175 와 **같다**(브랜드 주황 화면에서 무한 로딩, 터치도 죽음). 다른 트리거로 같은 벽돌에
도착하는 두 번째 문이다. step 2 가 `closeBossProfitDb()` 에 5초 타임아웃을 넣어 매달림 자체는 이미
상한이 생겼지만, **순서가 그대로면 커버가 그 5초 내내 올라가 있다.** 순서를 뒤집어 커버 구간을
리로드 직전으로 좁힌다.

## 읽어야 할 파일

- `/docs/README.md` · `/docs/ADR.md`(**슬림 인덱스만** — 지정한 것만 열어라)
- `/docs/adr/ADR-117.md` — **이 phase 의 계약**. 이 step 은 **결정 8** 이다
- `/docs/adr/ADR-065.md` **결정 3** — 캐시 삭제는 **항상 리로드한다**(실패·타임아웃이어도). 실패는
  토스트가 아니라 `pendingNotice` 플래그로 남기고 부팅 후에 알린다. **이 정책을 바꾸지 마라**
- `/docs/features/settings.md` — 캐시 데이터 삭제 정책
- `/src/features/settings/cache-data.ts` (**전문** — `CLEAR_TIMEOUT_MS` · `clearCacheData` ·
  `clearCacheDataAndReload` 와 그 위 주석)
- `/src/storage/__tests__/cache-data.test.ts` (**전문** — 기존 케이스)
- `/src/storage/sqlite/db.ts` 의 `closeBossProfitDb` (**읽기만** — step 2 가 5초 타임아웃을 넣었고
  **던지지 않는다**)
- `/src/native/live-update.ts` 의 `applyDownloadedLiveUpdate` (**읽기만** — step 3 이 만든
  `close → 커버 → set` 순서. 이 step 이 그것과 **같은 모양**을 만든다)

## 작업

TDD 다 — **테스트를 먼저 고치고/쓰고**, 그다음 구현이 통과하게 만들어라.

### 1. 순서를 뒤집는다

새 순서: **`closeBossProfitDb()` → `showSplashScreen()` → `reload()`**

- 삭제(`clearCacheData` + `CLEAR_TIMEOUT_MS` race)와 `pendingNotice` 처리는 **지금 그대로 앞에** 둔다.
  이 step 이 바꾸는 것은 **그 뒤 세 줄의 순서뿐**이다.
- `showSplashScreen()` 의 `.catch(() => {})` 는 유지하라 — 커버 실패가 리로드를 막으면 안 된다.
- 주석을 갱신하라: **왜 커버가 닫기 뒤인지**([[ADR-117]] 결정 8 — 닫기가 매달릴 때 사용자가 주황
  화면에 갇히지 않도록 커버 구간을 리로드 직전으로 좁힌다). 기존 주석의 근거(리로드 동안 웹뷰
  네이티브 배경색이 드러나므로 덮는다 · stale 커넥션 때문에 미리 닫는다)는 **지우지 말고 유지**하라.

### 2. 실패 UX 를 새로 만들지 마라

이 경로에는 **`'apply-error'` 같은 분기를 만들지 않는다.** [[ADR-065]] 결정 3 이 이미
"항상 리로드한다 — 지운 데이터가 화면 곳곳에 이미 반영돼 있어 어중간한 상태로 두는 것이 더 나쁘다"
로 확정했고, 실패는 `setPendingNotice('cacheClearFailed')` → 부팅 후 토스트로 알린다.
**그 정책은 이 phase 의 대상이 아니다.**

### 3. 테스트 — `cache-data.test.ts`

- **순서 단언이 이 step 의 핵심이다.** `closeBossProfitDb` → `showSplashScreen` → `reload`
  **이 순서로** 불린다는 것을 호출 순서 기록(공유 배열에 push 하는 mock 등)으로 단언하라.
  `toHaveBeenCalled` 만으로는 순서가 안 잡힌다.
- **`closeBossProfitDb` 가 reject 해도 `reload()` 는 불린다**(step 2 가 던지지 않게 만들었지만,
  이 함수의 계약은 "항상 리로드"다 — 그 성질을 여기서도 지킨다).
- **`showSplashScreen` 이 reject 해도 `reload()` 는 불린다.**
- 기존 케이스(삭제 성공/실패/타임아웃 → `pendingNotice` 유무, 항상 `reload`)는 **그대로 통과**해야 한다.

## Acceptance Criteria

```bash
npm run build
npm test
npm run lint                                    # errors 0 (warnings 17 은 baseline)
# 이 step 은 cache-data.ts 와 그 테스트 밖을 건드리지 않는다
git status --porcelain -- src/ | grep -v 'features/settings/cache-data.ts' | grep -v 'storage/__tests__/cache-data.test.ts' | wc -l   # 0
```

## 검증 절차

1. 위 AC 를 전부 실행한다.
2. **판별력을 확인하라**(결과를 summary 에): 순서를 옛 모양(커버 → 닫기 → reload)으로 되돌리면
   **순서 단언 케이스만** 실패하는가? 확인 후 되돌려라.
3. 아키텍처 체크: `features/` 가 `storage/`·`native/` 어댑터를 통해서만 바깥과 만나는가
   (CLAUDE.md CRITICAL). 이 파일은 이미 그 형태다 — 유지하라.
4. **OTA 경로와 모양이 같은지 눈으로 대조하라** — `native/live-update.ts` 의
   `applyDownloadedLiveUpdate` 와 이 함수가 같은 순서를 갖는 것이 이 step 의 목적이다.
   다르면 둘 중 하나가 잘못된 것이다.
5. `phases/ota-apply-recovery/index.json` 의 step 8 갱신 — summary 에 **새 호출 순서**를 담아라.

## 금지사항

- **`'apply-error'` 같은 실패 분기·모달·토스트를 이 경로에 만들지 마라.** 이유: [[ADR-065]] 결정 3 이
  "항상 리로드 + 부팅 후 플래그 토스트"로 확정했다. 다른 정책을 섞으면 같은 실패가 두 방식으로 알려진다.
- **`clearCacheData` 의 삭제 로직·`CLEAR_TIMEOUT_MS`·`pendingNotice` 처리를 건드리지 마라.**
  이유: 이 step 의 범위는 **그 뒤 세 줄의 순서**뿐이다.
- **`closeBossProfitDb()` 를 try/catch 로 감싸지 마라.** 이유: step 2 가 "던지지 않는다"를 계약으로
  만들었다. 중복 방어는 책임 소재를 흐린다.
- **`reload()` 를 조건부로 만들지 마라.** 이유: "항상 리로드한다"가 [[ADR-065]] 결정 3 이다.
- **기존 주석을 지우지 마라.** 새 근거는 더하되 옛것은 남겨라.
- 기존 테스트를 깨뜨리지 마라.
