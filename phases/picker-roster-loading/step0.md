# Step 0: docs-policy

이 phase는 **이슈 #64 — "캐릭터 관리 모달 — 캐시 없을 때 로딩 스피너 + 활성 캐릭터만 표시"** 를 구현한다. 이 step은 CLAUDE.md의 docs-first CRITICAL 규칙에 따라 **문서만** 갱신한다. 코드는 step 1~3에서 바꾼다.

## 배경 (이 step이 필요한 이유)

`getCharacterPickerRoster()`(`src/features/schedule-sync/schedule-sync.ts:83-187`)는 후보 캐릭터 목록을 `onUpdate` 콜백으로 3단계에 걸쳐 흘린다.

| 단계 | 위치 | 방출 내용 |
|---|---|---|
| ① 캐시 stub | `:94-117` | `characterBasicCache` 인덱스의 **캐시된 + `accessFlag: true`** 캐릭터. 캐시가 비면 **아무것도 방출하지 않는다**(`:114`의 `stubEntries.length > 0` 가드) |
| ② `character/list` 응답 | `:119-150` | **캐시 없는 캐릭터를 `imageUrl: null`로 전부 포함**(`:130-137`) — 이 시점엔 `access_flag`를 모르기 때문 |
| ③ `character/basic` 개별 응답 | `:152-183` | 도착하는 대로 patch. `accessFlag: false`면 그제서야 `liveEntries.delete`(`:161`) |

**캐시가 비어 있는 상태**(캐시 데이터 삭제 직후, 재설치 직후)에서 "캐릭터 관리"를 열면:

1. ①이 아무것도 안 내보내 **빈 그리드가 로딩 표시도 없이** 떠 있다 — `CharacterTrackingPicker`(`src/components/CharacterTrackingPicker/CharacterTrackingPicker.tsx:38-42`)에는 로딩/빈 상태 개념 자체가 없다
2. ②에서 **비활성(`access_flag: false`) 캐릭터까지 포함한 전체 목록이 "?" 얼굴로 한꺼번에** 등장
3. ③에서 비활성 캐릭터가 하나씩 사라지고 이미지가 채워지며 **레이아웃이 계속 튄다**

호출부 3곳 모두 `getCharacterPickerRoster(...)`의 **Promise 결과를 버리고 있어**(`.catch(() => {})`) 로딩 여부를 알 방법조차 없다 — `ContentScreen.tsx:715-724`, `BossScreen.tsx:146-155`, `ContentCharacterStep.tsx:22-30`.

## 사용자가 확정한 결정 (이 phase 전체의 전제)

- **`access_flag`가 확인되지 않은 캐릭터는 목록에 넣지 않는다.**
- **표시할 캐시가 하나도 없는 콜드 스타트에서는 중간 결과를 흘리지 않고**, 조회가 전부 끝난 뒤 **한 번에** 완성된 목록을 그린다. 그동안은 로딩 스피너를 보여준다.
- **캐시가 있는 평상시 경로는 [[ADR-016]] 캐시 우선 표시(Stale-While-Revalidate)를 그대로 유지**한다 — stub 즉시 표시 + 개별 patch, 스피너 없음.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스 — "캐릭터 관리" 피커가 어느 feature 문서에 서술돼 있는지 여기서 판단하라. 컨텐츠 스케줄러·보스 스케줄러·온보딩 세 문서가 후보다)
- `/docs/ADR.md` (슬림 인덱스 — 새 ADR 한 줄을 여기 추가한다. **ADR 전문을 통째로 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-016.md` — 캐시 우선 표시(Stale-While-Revalidate)와 예열. 결정 4에 "`CharacterTrackingPicker`가 열릴 때 캐시된 값으로 먼저 그리드를 그리고 API 응답이 개별적으로 도착하는 대로 patch한다"가 있다. **이 정책은 캐시가 있을 때 그대로 유지된다.**
- `/docs/adr/ADR-017.md` — 결정 6(피커를 열 때마다 캐시된 캐릭터를 즉시 먼저 채우는 규칙). `schedule-sync.ts:86-93` 주석이 참조하는 결정이다.
- `/docs/adr/ADR-015.md` — 캐릭터 관리 피커의 원 설계(즐겨찾기 우선 정렬, 이미지 카드, `character/basic` 병렬 조회).
- `/docs/foundation/design-system.md` — 스피너·빈 상태 문구 규약. `MapleSpinner` 사용 관례를 확인하라.
- `/docs/foundation/error-resilience.md` — 실패 처리·빈 상태 원칙. **"실패를 빈 상태로 위장하지 않는다"** 는 관점이 이 작업의 핵심 중 하나다.
- 아래는 **읽기만** 하라(이 step에서 수정 금지):
  - `/src/features/schedule-sync/schedule-sync.ts` (`getCharacterPickerRoster` `:83-187`)
  - `/src/components/CharacterTrackingPicker/CharacterTrackingPicker.tsx`
  - `/src/app/content-scheduler/ContentScreen.tsx` (`:699-724`)
  - `/src/app/boss-scheduler/BossScreen.tsx` (`:139-155`)
  - `/src/app/onboarding/ContentCharacterStep.tsx`
  - `/src/components/MapleSpinner/MapleSpinner.tsx`

이 phase의 첫 step이라 이전 step 산출물은 없다.

## 작업

### 1. `docs/adr/ADR-053.md` 신규 작성

기존 ADR 파일과 동일한 형식(`docs/adr/ADR-050.md` 참고 — `### ADR-NNN: 제목 (상태)` / `**배경**` / `**결정**` / `**이유**` / `**트레이드오프**`).

- 제목: `### ADR-053: 캐릭터 관리 피커 — access_flag 미확인 캐릭터 비표시, 콜드 스타트 로딩 스피너 (설계, 구현 전)`
- **배경**은 위 "배경" 절의 3단계 표와 콜드 스타트 증상을 담아라. 이 증상이 #63(캐시 데이터 삭제 범위) 작업 중 드러났다는 경위도 한 줄 적어라 — 캐시 삭제는 `characterBasicCache:*`와 `trackedCharacters`를 함께 지우므로, 삭제 직후 사용자가 가장 먼저 하는 행동("캐릭터 관리"를 열어 다시 고르기)이 정확히 이 경로를 밟는다.
- **결정**은 아래 3가지:
  1. **`access_flag`가 확인된 캐릭터만 방출한다.** ②단계에서 캐시가 없는(=`access_flag` 미상) 캐릭터를 `character/list` 값으로 채워 넣던 분기를 제거한다. 목록에 한 번이라도 나타난 캐릭터는 활성이 확인된 캐릭터뿐이다.
  2. **표시할 캐시가 하나도 없으면(콜드 스타트) 중간 결과를 흘리지 않고 조회 완료 후 1회만 방출한다.** ①에서 stub을 하나도 못 내보낸 경우에 한해 ②·③의 중간 `onUpdate`를 억제하고, 모든 `character/basic`이 끝난 뒤 최종 1회만 방출한다. **캐시가 있으면 기존 [[ADR-016]] SWR 동작(stub 즉시 + 개별 patch)을 그대로 유지**한다.
  3. **피커와 온보딩 캐릭터 선택 단계는 로딩 상태와 실패 상태를 갖는다.** `getCharacterPickerRoster`는 이미 `Promise`를 반환하므로 시그니처를 바꾸지 않고 호출부가 로딩 여부를 관리한다. 표시할 항목이 없고 조회 중이면 스피너, 조회가 끝났는데 항목이 없으면 **"활성 캐릭터 0명"과 "조회 실패"를 구분해** 안내한다(401/429는 전역 실패로 throw되므로 스피너가 영구히 걸리지 않게 반드시 해제한다).
- **이유**: 결정 2가 [[ADR-016]]의 "`Promise.all`로 뭉쳐 기다리지 않는다" 원칙과 충돌하지 않는 이유를 명시하라 — 그 원칙은 "보여줄 게 있는데도 늦게 보여주지 마라"는 뜻이고, 콜드 스타트는 **애초에 보여줄 게 없는** 상태다. 중간 결과가 오히려 잘못된 정보(비활성 캐릭터 포함)이거나 튀는 레이아웃이 되므로, 그 구간에서는 스피너가 더 정확한 표현이다.
- **트레이드오프**: 콜드 스타트에서 첫 화면까지의 시간이 "가장 느린 `character/basic` 응답"만큼으로 늘어난다(모두 병렬이라 총합이 아니라 최대값). 캐시가 있는 평상시엔 아무 변화가 없다.

### 2. `docs/ADR.md` 인덱스에 한 줄 추가

기존 표 형식에 맞춰 마지막 줄 다음에 ADR-053을 추가한다.

> **주의**: 다른 phase들이 ADR-051(`account-selection-always`)·ADR-052(`cache-clear-scope`)를 쓴다. 이 phase는 **ADR-053**을 쓴다. 인덱스에 그 줄들이 있든 없든 ADR-053으로 작성하라.

### 3. `docs/adr/ADR-016.md`·`docs/adr/ADR-017.md`에 정정 문단 추가

**본문의 기존 문장은 절대 지우거나 고쳐 쓰지 마라.** 각 문서 하단(기존 정정 문단들과 같은 위치)에 정정을 추가한다.

- **ADR-016**: 결정 4의 피커 관련 부분에 대해 — `**정정(2026-07-29) — 콜드 스타트 예외 ([[ADR-053]])**: ~~캐시가 없으면 character/list 응답으로라도 먼저 그린다~~ → 캐시가 하나도 없을 때는 중간 결과를 흘리지 않고 스피너를 보여준 뒤 조회 완료 시 한 번에 그린다. **캐시가 있을 때의 SWR 동작(즉시 표시 + 개별 patch)은 변경 없음.**
- **ADR-017**: 결정 6(피커를 열 때 캐시된 캐릭터를 즉시 먼저 채우는 규칙)에 대해 — 그 규칙 자체는 유지되고, **캐시가 하나도 없는 경우의 처리만** [[ADR-053]]으로 달라진다는 취지의 정정 한 문단.

### 4. feature 문서 갱신

`docs/README.md`의 기능별 인덱스를 보고 "캐릭터 관리" 피커와 온보딩 캐릭터 선택 단계가 서술된 문서를 **직접 판단해** 고른 뒤(컨텐츠 스케줄러 / 보스 스케줄러 / 온보딩), 각 문서의 UI·정책 절에 아래를 반영하라:

- 피커는 **활성(`access_flag: true`)이 확인된 캐릭터만** 목록에 넣는다.
- 표시할 캐시가 없으면 **스피너 → 조회 완료 후 한 번에 목록**, 캐시가 있으면 **즉시 표시 + patch**(기존 [[ADR-016]] 동작).
- 조회가 끝났는데 목록이 비면 **"활성 캐릭터 없음"** 과 **"조회 실패"** 를 구분해 안내한다.
- 각 문서 하단 "폐기된 정책 (history)"에 `- ~~캐시가 없으면 character/list 응답으로 access_flag 미상 캐릭터까지 먼저 표시~~ → 활성 확인된 캐릭터만 표시, 콜드 스타트는 스피너([[ADR-053]], 2026-07-29).` 형식의 한 줄을 추가한다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음(코드 무변경이므로 그대로 통과해야 한다)
npm test        # 전체 테스트 통과(코드 무변경이므로 그대로 통과해야 한다)
npm run lint    # 경고 0

# 문서 반영 확인 — 아래가 모두 결과를 내야 한다
test -f docs/adr/ADR-053.md && echo "ADR-053 OK"
grep -q "ADR-053" docs/ADR.md && echo "index OK"
grep -q "ADR-053" docs/adr/ADR-016.md && grep -q "ADR-053" docs/adr/ADR-017.md && echo "정정 OK"
grep -rq "ADR-053" docs/features/ && echo "features OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ADR 전문은 `docs/adr/ADR-053.md`에, 인덱스에는 한 줄만 들어갔는가?
   - ADR-016·ADR-017 본문의 옛 내용을 **삭제하지 않고** 정정 문단으로 남겼는가?
   - **"캐시가 있을 때의 SWR 동작은 바뀌지 않는다"** 는 점이 ADR-053과 정정 문단 양쪽에서 분명히 읽히는가? (이걸 흐리게 쓰면 다음 step이 SWR을 통째로 없애는 구현을 할 위험이 있다)
   - `src/` 아래 파일을 하나도 수정하지 않았는가? (`git status`로 확인)
3. 결과에 따라 `phases/picker-roster-loading/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 **ADR-053의 결정 1·2·3을 한 줄로 압축**하고, 갱신한 feature 문서 경로를 명시하라(다음 step들이 이 요약만 보고 구현 규칙과 문서 위치를 알 수 있어야 한다).
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `src/` 아래 어떤 파일도 수정하지 마라. 이유: docs-first CRITICAL 규칙에 따라 이 step은 문서 확정 전용이고, 구현은 step 1~3에서 TDD로 진행한다.
- `docs/adr/ADR-016.md`·`ADR-017.md` 본문의 기존 결정·이유 문장을 고쳐 쓰거나 삭제하지 마라. 이유: 옛 결정의 맥락을 추적할 수 있어야 한다.
- ADR-053에 "캐시 우선 표시(SWR)를 폐기한다"고 쓰지 마라. 이유: 사실이 아니다. 바뀌는 것은 **캐시가 하나도 없는 경우**의 처리뿐이고, 캐시가 있으면 [[ADR-016]] 결정 4가 그대로 적용된다.
- 새 ADR을 `docs/ADR.md` 본문에 통째로 쓰지 마라. 이유: `ADR.md`는 슬림 인덱스다.
- 기존 테스트를 깨뜨리지 마라.
