# Step 5: boss-scheduler-solo-party-filter

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/UI_GUIDE.md` — "솔로/파티 서브 필터" 섹션(정확한 클래스명, 옵션 순서, 탭별 독립 상태 규칙) 전체
- `/docs/ADR.md` — ADR-019 결정 3(미설정=솔로, 필터의 "솔로"에 포함)·결정 6(필터는 현재 활성 탭 안에서만 적용, 두 축은 서로 독립)
- `/src/app/boss-scheduler/BossScreen.tsx` — **Step 4에서 수정된** 최신 상태를 읽을 것. 특히 주간/월간 탭 pill 버튼의 기존 className 패턴(`rounded-full bg-primary/15 px-3 py-[5px] text-sm font-semibold text-primary` / `px-3 text-sm font-medium text-text-muted`)과 `registeredWeeklyBosses`/`registeredMonthlyBosses` 계산부, `partySizes`를 가져오는 부분(Step 4에서 이미 연결되어 있음)
- `/src/features/boss-scheduler/store.ts` — `partySizes`(`Record<string, number>`) 시그니처 재확인

이전 step들에서 만들어진 파티 배지·모달 코드를 정확히 이해한 뒤 작업하라.

## 작업

`BossScreen.tsx`에 주간/월간 탭 바로 아래 "전체/솔로/파티" 서브 필터 pill 행을 추가한다.

1. 필터 상태는 탭별로 독립적으로 유지해야 한다(ADR-019 결정 6 — 주간 탭에서 "파티"를 고른 채 월간 탭으로 전환해도 월간 탭은 "전체" 그대로). `activeTab`과 마찬가지로 SQLite 등에 영속화할 필요 없는 화면 로컬 상태이므로, `useState<Record<BossTab, 'all' | 'solo' | 'party'>>({ weekly: 'all', monthly: 'all' })` 형태로 두거나 `weeklyFilter`/`monthlyFilter` 두 개의 `useState`로 나눠도 된다(에이전트 재량, 둘 다 탭별 독립 요구사항을 만족하면 됨).
2. 필터 행 마크업은 `docs/UI_GUIDE.md` "솔로/파티 서브 필터" 섹션의 스펙을 그대로 따른다:
   ```
   필터 행: flex items-center gap-2 (탭 행 바로 다음 줄)
   활성 필터: rounded-full bg-primary/15 text-primary px-3 py-1 text-xs font-semibold
   비활성 필터: 배경 없음, text-xs font-medium text-text-muted, 좌우 패딩 동일(px-3)
   옵션: 전체 / 솔로 / 파티 (이 순서 고정)
   ```
   기존 주간/월간 탭 버튼과 같은 pill 스타일을 재사용하되 `text-xs`로 한 단계 작게 — 새 스타일을 만들지 마라(UI_GUIDE 명시).
3. 현재 활성 탭(`activeTab`)의 필터 값에 따라 `registeredWeeklyBosses`/`registeredMonthlyBosses`를 클라이언트 사이드에서 필터링한 뒤 `BossCard` 목록에 넘긴다:
   - `all`: 필터링 없음(현재 동작 그대로)
   - `solo`: `partySizes`에 값이 없거나 1인 보스만
   - `party`: `partySizes`에 2 이상 값이 있는 보스만
   - 보스별 조회 키는 Step 2에서 정의한 `` `${ocid}:${boss}:${difficulty}` `` (boss는 `matchedBossName ?? apiName`)를 그대로 쓴다 — Step 4에서 이미 같은 키로 배지를 그리고 있으니 그 로직을 재사용/추출해서 중복 계산하지 마라.
   - 별도 API 재호출 없이 이미 로드된 `partySizes` 맵으로만 필터링한다(UI_GUIDE·ARCHITECTURE 명시).
4. 필터링 결과가 0개인 경우의 빈 상태 문구는 기존 "표시할 항목이 없습니다 — 게임에서 스케줄러에 등록해주세요" 문구를 그대로 쓰지 말고(그 문구는 "등록된 스케줄 자체가 없다"는 의미라 필터 때문에 안 보이는 것과 다른 상황이다), 필터로 인해 0개가 된 경우에는 "이 조건에 해당하는 보스가 없습니다" 같은 별도 문구를 써라. 두 빈 상태를 구분하라.

### 테스트(TDD)

`BossScreen.test.tsx`에 다음을 검증하는 테스트를 추가한다:
- 필터를 "파티"로 선택하면 파티원 2인 이상인 보스만 보이는지
- 필터를 "솔로"로 선택하면 미설정+1인 보스만 보이는지
- 주간 탭에서 필터를 바꾼 뒤 월간 탭으로 전환해도 월간 탭 필터는 "전체"로 유지되는지(탭별 독립)
- 필터로 인해 결과가 0개일 때와 애초에 등록된 보스가 없을 때 서로 다른 빈 상태 문구가 보이는지

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 필터 pill 스타일이 UI_GUIDE.md 스펙과 정확히 일치하는가(새 스타일을 만들지 않았는가)?
   - 필터가 API를 재호출하지 않고 이미 로드된 `partySizes`만으로 클라이언트 사이드 필터링을 하는가?
   - 주간/월간 두 탭의 필터 상태가 서로 완전히 독립적인가?
3. 결과에 따라 `phases/boss-party-management/index.json`의 `step: 5`를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
4. **이 step이 phase의 마지막 step이다.** 성공적으로 완료되면 `phases/boss-party-management/index.json`에 `"completed_at"`이 기록되고(execute.py 자동 처리), `phases/index.json`의 `boss-party-management` 항목 상태도 `"completed"`로 갱신되는지 확인한다.

## 금지사항

- `docs/UI_GUIDE.md`에 명시된 필터 pill 스타일과 다른 스타일(예: 드롭다운, 토글 스위치)로 구현하지 마라. 이유: 문서에 이미 "기존 탭과 동일한 pill 스타일 재사용, 두 축을 하나의 드롭다운으로 합치는 안보다 명확하다"는 사용자 선택 근거가 기록돼 있다.
- Step 4에서 만든 파티 배지·모달의 조건부 렌더링 로직(파티 배지는 2인 이상만, 진입 버튼 등)을 바꾸지 마라. 이 step은 필터 UI 추가만 다룬다.
- 기존 테스트를 깨뜨리지 마라.
