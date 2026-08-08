# Step 5: apply-error-modal

이 step 은 **`src/app/UpdatePromptModal.tsx` 하나만 고친다.** 스토어·어댑터는 건드리지 않는다.

## 배경

step 4 가 스토어에 상태 두 개를 추가했다:

- `'applying'` — 적용 진행 중. 내부에서 `closeBossProfitDb()`(최대 5초) → 커버 → `set()` 이 돈다.
- `'apply-error'` — 적용 실패·타임아웃(12초). **받아둔 번들은 그대로 살아 있다**
  (`downloadedBundleId` 를 비우지 않는다) — 다시 받지 않고 재시도할 수 있다.

지금 이 모달은 `MODAL_STATUSES` 에 없는 상태가 되면 `return null` 이라 **소리 없이 닫힌다.** 그래서
step 4 만으로는 사용자가 `지금 적용` 을 눌렀을 때 **모달이 그냥 사라지는** 상태다. 이 step 이 두
상태에 화면을 준다.

**`'applying'` 이 왜 필요한지**(설계 의도 — 없애지 마라): step 3 이 순서를 뒤집어 커버가 SQLite 닫기
**뒤에** 올라간다. 그래서 닫기가 도는 최대 5초 동안 모달이 살아 있고 버튼도 눌린다. 그 구간에
화면이 여전히 "업데이트 준비 완료"라고 말하면 **거짓말**이고, 사용자는 반응 없는 버튼을 다시 누른다.
`'applying'` 은 ⑴ 그 구간에 정직한 피드백을 주고 ⑵ 버튼을 치워 중복 탭을 막는다([[ADR-117]] 결정 7).

## 읽어야 할 파일

- `/docs/README.md` · `/docs/ADR.md`(**슬림 인덱스만** — 지정한 것만 열어라)
- `/docs/adr/ADR-117.md` — **이 phase 의 계약**. 이 step 은 **결정 7** 과 **결정 1 의 UX 부분** 이다
- `/docs/adr/ADR-065.md` 결정 2 — 실패 모달의 골격(배지 톤 error · `다시 시도` / `나중에` ·
  부 동작 버튼 `GHOST_BTN` 크기) · `/docs/adr/ADR-061.md` 결정 6(결정형 진행률 `h-1.5` 프리미티브)·
  결정 9(말줄임표 `...` · 대기 문구 `~하고 있어요`)
- `/docs/foundation/design-system.md` — 모달·버튼·토큰
- `/docs/features/live-update.md` — step 0 이 갱신한 정책
- `/src/app/UpdatePromptModal.tsx` (**전문** — 특히 `MODAL_STATUSES` · `isDownloading` 배경 탭 가드 ·
  `downloading` 분기 · `download-error` 분기)
- `/src/features/live-update/store.ts` (**읽기만** — step 4 가 만든 두 상태와 `apply()` 계약)
- `/src/app/__tests__/UpdatePromptModal.test.tsx` 가 있으면 전문(없으면 이 step 에서 만든다 —
  아래 경로 확인은 실제 저장소를 보고 판단하라)

## 작업

TDD 다 — **테스트를 먼저 고치고/쓰고**, 그다음 구현이 통과하게 만들어라.

### 1. `MODAL_STATUSES` 에 두 상태 추가

`'applying'`, `'apply-error'` 를 넣어라. 주석에 **왜 둘 다 모달로 알리는지** 한 줄 —
사용자가 `지금 적용` 을 눌러 시작한 흐름이라 [[ADR-065]] 결정 2 의 "사용자가 시작한 실패는 모달"
분류를 그대로 따른다.

### 2. `'applying'` 분기

- 배경 탭으로 닫히면 안 된다. 지금 `onClose={isDownloading ? () => {} : dismiss}` 인데,
  **`'applying'` 도 같은 취급**으로 바꿔라(진행 중 취소 방지). 변수 이름을 `isDownloading` 그대로
  두지 말고 두 상태를 포괄하는 이름으로 바꾸되, **다른 분기의 동작은 바꾸지 마라.**
- 내용: `downloading` 분기와 같은 골격의 **짧은 진행 표시**. 진행률은 **없다**(적용은 퍼센트가
  나오지 않는다) — `ProgressBar` 를 쓰지 마라. 이 저장소에 이미 있는 로딩 표현
  (`MapleSpinner` 등, [[ADR-061]])을 재사용하라. **새 로딩 표현을 만들지 마라.**
- 문구: 제목은 `적용하고 있어요`([[ADR-061]] 결정 9 대기 문구 형식). 부연은 재시작을 예고하는
  한 줄이면 충분하다.
- **버튼을 두지 마라.** `나중에`(dismiss)도 없다 — 이미 되돌릴 수 없는 구간에 들어갔고,
  여기서 상태를 비우면 실패했을 때 재시도할 번들 참조를 잃는다.

### 3. `'apply-error'` 분기

`download-error` 분기와 **같은 골격**(배지 톤 `error` · `AlertTriangle` · 제목 · 설명 ·
`PRIMARY_BTN` + `GHOST_BTN`)을 쓰되 내용이 다르다:

- 제목: `업데이트를 적용하지 못했습니다`
- 설명: **받아둔 파일이 그대로 있다**는 사실을 알린다 — 다시 받지 않는다는 것이 사용자에게 의미가 있다.
- 주 동작: `다시 시도` → **`apply()`** (`startDownload()` 가 **아니다.** 이것이 `download-error` 와
  갈리는 핵심이다)
- 부 동작: `나중에` → `dismiss()`
- 어미는 `~습니다`([[ADR-062]] 결정 5, 같은 파일의 `download-error` 문구와 맞춰라)

### 4. 테스트

- `'applying'` 에서: 모달이 **보이고**, `지금 적용 (재시작)` 버튼이 **없고**, 배경 탭으로
  `dismiss` 가 불리지 **않는다.**
- `'apply-error'` 에서: 제목이 보이고, `다시 시도` 를 누르면 **`apply` 가** 불린다
  (**`startDownload` 는 불리지 않는다** — 이 단언을 반드시 넣어라).
- `'apply-error'` 에서 `나중에` → `dismiss` 호출.
- 기존 분기 6개(`update-available`·`confirm-cellular`·`downloading`·`ready-to-apply`·
  `store-required`·`download-error`) 테스트가 **그대로 통과**해야 한다.

## Acceptance Criteria

```bash
npm run build
npm test
npm run lint                                    # errors 0 (warnings 17 은 baseline)
grep -q "'applying'" src/app/UpdatePromptModal.tsx
grep -q "'apply-error'" src/app/UpdatePromptModal.tsx
grep -c 'ProgressBar' src/app/UpdatePromptModal.tsx    # 1 — downloading 분기에서만 쓴다
# 이 step 은 UpdatePromptModal 과 그 테스트 밖을 건드리지 않는다
git status --porcelain -- src/ | grep -v 'UpdatePromptModal' | wc -l    # 0
```

## 검증 절차

1. 위 AC 를 전부 실행한다.
2. **판별력을 확인하라**(결과를 summary 에): `다시 시도` 의 `onClick` 을 `startDownload` 로 바꾸면
   해당 케이스만 실패하는가? 확인 후 되돌려라. (두 실패 분기를 가르는 유일한 차이다.)
3. 디자인 체크: 새 색·새 크기·새 로딩 표현을 만들지 않았는가? 기존 상수(`PRIMARY_BTN`·`GHOST_BTN`·
   `TONE_CLASSES`·`IconBadge`)를 그대로 썼는가? [[ADR-065]] 결정 2 가 4개 분기에 공유시킨
   `GHOST_BTN` 크기를 바꾸지 않았는가?
4. `phases/ota-apply-recovery/index.json` 의 step 5 갱신 — summary 에 **두 분기의 문구와 주 동작
   핸들러**를 담아라.

## 금지사항

- **`src/features/live-update/store.ts` 를 고치지 마라.** 이유: step 4 가 확정한 계약이다.
  모달이 필요로 하는 것이 없어 보이면 고치지 말고 `blocked` 로 세워라.
- **`'applying'` 에 `나중에`/취소 버튼을 두지 마라.** 이유: 이미 되돌릴 수 없는 구간이고,
  `dismiss()` 가 `downloadedBundleId` 를 비워 실패 시 재시도 경로가 사라진다.
- **`'applying'` 에 `ProgressBar` 를 쓰지 마라.** 이유: 적용은 진행률이 나오지 않는다. 가짜로 채우는
  결정형 진행률은 거짓 정보다.
- **새 로딩 스피너·새 배지 톤·새 버튼 크기를 만들지 마라.** 이유: [[ADR-061]]·[[ADR-065]] 가 이미
  표현을 확정했다.
- **`다시 시도` 를 `startDownload()` 에 연결하지 마라.** 이유: 번들은 이미 받아져 있다.
  다시 받는 것은 낭비이고 문구와도 어긋난다.
- 기존 테스트를 깨뜨리지 마라.
