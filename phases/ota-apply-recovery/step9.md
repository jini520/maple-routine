# Step 9: docs-finalize

이 step 은 **문서만 고친다. 소스 코드를 단 한 줄도 바꾸지 마라.** 구현이 끝난 상태를 문서에 반영하고,
구현하면서 드러난 사실이 있으면 정정한다(CLAUDE.md — "작업 완료 후 문서를 다시 점검해 완료된 항목을
반영할 것", "ADR 도 '설계, 구현 전' 으로 남는 경우가 많으니 구현 완료 시 상태를 명시할 것").

## 이 phase 가 한 일 (자기완결 요약)

이슈 **#175** — OTA `지금 적용 (재시작)` 후 브랜드 주황 스플래시에서 무한 로딩. 적용 경로가
**되돌아올 수 없는 일방통행**이었고 안전망 셋이 전부 꺼져 있었다. step 1~8 이 고친 것:

| step | 무엇 |
|---|---|
| 1 | `index.html` 에 `#boot-cover` 실패 안전 타이머(8초, **커버가 아직 있을 때만**) — React 트리 밖 |
| 2 | `closeBossProfitDb()` 에 5초 타임아웃(`CLOSE_TIMEOUT_MS`), 여전히 던지지 않는다 |
| 3 | `hideSplashScreen()` 이 `[data-splash-cover]` 도 걷는다 · `applyDownloadedLiveUpdate` 순서를 `close → 커버 → set` 으로 |
| 4 | `apply()` 에 12초 타임아웃 + catch → 커버를 걷고 `'apply-error'` · `'applying'` 추가 · 재진입 가드 |
| 5 | 모달에 `'applying'`·`'apply-error'` 분기(`다시 시도` = **`apply()`**, 재다운로드 아님) |
| 6 | `notifyLiveUpdateReady()` 를 `main.tsx` 첫 문장 → **`AppShell` 마운트 `useEffect`** 로 |
| 7 | ErrorBoundary 폴백이 뜰 때 `hideSplashScreen()` — 커버 제거 + 터치 복구 |
| 8 | `clearCacheDataAndReload` 도 `close → 커버 → reload` 순서로 |

## 읽어야 할 파일

- `/docs/README.md` · `/docs/ADR.md`(**슬림 인덱스만**)
- `/docs/adr/ADR-117.md` (**전문** — step 0 이 쓴 결정 8개)
- `/docs/features/live-update.md` · `/docs/features/splash.md` (step 0 이 갱신한 것)
- `/docs/features/settings.md` — 캐시 삭제 절(step 8 이 순서를 바꿨다)
- `/phases/ota-apply-recovery/index.json` (**step 0~8 의 `summary` 를 전부 읽어라** — 구현이 설계와
  달라진 지점이 거기 적혀 있다)
- 실제 구현 결과를 **소스에서 확인하라**(읽기만): `/index.html` · `/src/storage/sqlite/db.ts` ·
  `/src/native/splash-screen.ts` · `/src/native/live-update.ts` ·
  `/src/features/live-update/store.ts` · `/src/app/UpdatePromptModal.tsx` · `/src/main.tsx` ·
  `/src/App.tsx` · `/src/components/organisms/ErrorBoundary/ErrorBoundary.tsx` ·
  `/src/features/settings/cache-data.ts`

## 작업

### 1. `docs/adr/ADR-117.md` — 상태를 '구현 완료' 로

- `**상태**` 를 `**(구현 완료, 2026-08-08, 이슈 #175)**` 형태로 바꾸고, **결정 8개 중 폐기·수정된
  것이 있으면 명시**하라. `docs/adr/ADR-116.md` 의 상태 줄이 형식 선례다.
- **`## 미검증` 절을 반드시 추가하라.** 이 phase 는 **실기기에서 재현되지 않은 버그**를 고쳤다 —
  시뮬레이터에서는 같은 흐름이 정상 통과했다. 지금 시점에 정직하게 적을 것:
  - **어느 고리가 실제로 끊겼는지는 여전히 모른다.** 이 phase 는 고리 1~3 을 **전부** 막았을 뿐이다.
  - 실기기(iPhone 16 Pro)에서 `지금 적용` → 정상 적용이 되는지 **아직 확인되지 않았다.**
  - 실패 경로(`'apply-error'` 모달)는 **강제 주입 없이는 실기기에서 볼 수 없다.**
  - 8초 실패 안전 타이머가 실제 콜드 스타트에서 오탐하지 않는지 **실기기 확인 필요.**
  - `notifyAppReady` 이전(첫 렌더 커밋 전)에 죽는 번들이 정말 자동 롤백되는지 — **실물 롤백 관측
    없음.** 확인하려면 일부러 부팅에서 던지는 번들을 OTA 로 올려야 한다.
- **구현하면서 설계와 달라진 것이 있으면 결정 본문을 고치지 말고 정정 항목으로 덧붙여라**
  (이 저장소 관행: 옛 내용을 지우지 않는다).

### 2. `docs/ADR.md` 인덱스 줄 갱신

ADR-117 줄의 요약에 **구현 완료** 사실을 반영하라. 다른 줄은 건드리지 마라.

### 3. `docs/features/live-update.md` · `docs/features/splash.md` · `docs/features/settings.md`

- step 0 이 쓴 내용과 **실제 구현이 어긋난 곳**을 실제 소스와 대조해 고쳐라(상수 값·함수 이름·
  상태 문자열·호출 순서).
- **'열린 질문' 항목이 이 phase 로 해소됐으면 제거·정리하라**(CLAUDE.md 규칙).
- `settings.md` 에 캐시 삭제 순서가 바뀐 것을 반영하라(step 8).
- 옛 정책은 지우지 말고 각 문서 하단 `## 폐기된 정책 (history)` 로 내려라.

### 4. `docs/trouble/` 에 이 이슈의 기록을 남길지 판단

`docs/trouble/` 은 **날짜별 네이티브·실기기 트러블슈팅 로그**다. 이 phase 는 실기기 재현에 실패한
상태로 코드만 고친 것이라, 남긴다면 **"재현 못 한 채로 사슬 전체를 막았다"** 는 사실과 **테스터에게
받아야 할 확인**이 핵심이다:

> 앱 완전 종료(앱 스위처에서 위로 밀어 닫기) 후 재실행
> - **풀린다** → 리로드 **이전**에서 멈춘 것(고리 1~3)
> - **그대로다** → 번들이 current 로 박힌 채 부팅에서 죽는 것 → 재설치 말고는 탈출구가 없었다
>
> 같이 받을 것: iOS 버전 · Wi-Fi/셀룰러 · **업데이트 전에 API 키를 넣어 온보딩을 끝냈는지**
> (끝냈다면 SQLite 경로가 열려 고리 2 가 유력해진다)

기존 `docs/trouble/2026-07-15-live-update-testing.md` 의 형식을 보고 판단하라. 남긴다면
`docs/features/live-update.md` 의 **관련 문서** 헤더에 링크를 추가하라.

## Acceptance Criteria

```bash
npm run build
npm test
npm run lint                                    # errors 0 (warnings 17 은 baseline)
grep -q '구현 완료' docs/adr/ADR-117.md
grep -q '미검증' docs/adr/ADR-117.md
git status --porcelain -- src/ index.html | wc -l    # 0 — 소스는 손대지 않는다
```

## 검증 절차

1. 위 AC 를 전부 실행한다.
2. **문서와 소스를 실제로 대조하라** — 아래 값이 문서에 적힌 것과 코드에 있는 것이 일치하는가:
   - 실패 안전 타이머 **8초**(`index.html`)
   - `CLOSE_TIMEOUT_MS` **5초**(`db.ts`)
   - `APPLY_TIMEOUT_MS` **12초**(`store.ts`)
   - 상태 문자열 `'applying'`·`'apply-error'`
   - 적용 순서 `closeBossProfitDb → showSplashScreen → set`
   - `notifyLiveUpdateReady` 가 **`AppShell`** 의 마운트 effect 에 있다
   숫자를 문서에서 **추정하지 마라** — 코드를 열어 확인하고 옮겨라.
3. `docs/README.md` 인덱스 표는 이 phase 로 바뀌는 것이 없다(새 기능·새 소스 디렉터리 없음) —
   `trouble/` 문서를 새로 만든 경우에만 관련 문서 링크가 는다.
4. `phases/ota-apply-recovery/index.json` 의 step 9 갱신 — summary 에 **ADR-117 이 '구현 완료'가
   됐다는 것과 미검증 항목 개수**를 담아라.

## 금지사항

- **`src/` 와 `index.html` 을 한 글자도 고치지 마라.** 이유: 이 step 은 문서 점검이다. 구현 결함을
  발견하면 고치지 말고 **`blocked`** 로 세우고 사유에 파일·줄을 적어라 — 코드 변경은 리뷰 대상이고
  문서 step 에 숨어들면 안 된다.
- **"검증했다"고 쓰지 마라.** 이유: 실기기 검증이 없다. 이 저장소는 미검증을 미검증으로 적는다
  ([[ADR-116]] 이 선례다). 확신 없는 것을 단정하지 마라.
- **결정 8개의 본문을 다시 쓰지 마라.** 달라진 것은 정정 항목으로 덧붙여라 — 옛 내용을 지우지 않는다.
- **다른 ADR 전문을 컨텍스트에 통째로 올리지 마라.** 이유: `docs/ADR.md` 전체는 100KB 에 육박한다.
- 기존 테스트를 깨뜨리지 마라.
