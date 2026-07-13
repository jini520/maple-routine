# Step 2: content-tab-pill

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 ADR-018 결정 1·3 (탭 pill 스타일을 보스 스케줄러·컨텐츠 스케줄러 두 화면에 동일 적용한다는 결정)
- `/docs/UI_GUIDE.md`의 "탭 토글(주간/월간, 일간/주간 등)" 섹션 — 활성/비활성 탭의 정확한 클래스 값이 명시되어 있다.
- `/docs/PRD.md`의 "1. 컨텐츠 스케줄러" 항목의 "UI 통일(확정, 2026-07-13, [[ADR-018]])" 문단
- `src/app/content-scheduler/ContentScreen.tsx` — 현재 구현. 일간/주간 탭 버튼 부분을 꼼꼼히 읽어라.
- `src/app/boss-scheduler/BossScreen.tsx` — 이전 step(boss-card-ui)에서 이미 탭에 pill 스타일이 적용되어 있다. 이 파일의 탭 버튼 클래스를 그대로 참고해 동일한 값을 컨텐츠 스케줄러에도 적용한다(두 화면의 탭 스타일 문자열이 서로 다르면 안 된다).

## 작업

`src/app/content-scheduler/ContentScreen.tsx`의 일간/주간 탭 버튼 스타일을 `BossScreen.tsx`(step 1에서 개편됨)와 동일한 pill 스타일로 바꾼다:
- 활성 탭: `rounded-full bg-primary/15 text-primary px-3 py-[5px] text-sm font-semibold`
- 비활성 탭: `text-sm font-medium text-text-muted px-3`

컨텐츠 스케줄러에는 보스 스케줄러의 `n/12` 같은 카운트 배지가 없으므로, 배지 관련 레이아웃(justify-between 등)을 새로 추가할 필요는 없다 — 탭 버튼 두 개의 className만 교체하면 된다.

그 외 이 화면의 다른 부분(일간 콘텐츠의 진행률 바, 주간 콘텐츠 리스트, 캐릭터 드롭다운, 빈 상태 처리 등)은 이번 step 범위가 아니다 — 손대지 마라.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `ARCHITECTURE.md` 디렉토리 구조를 따르는가? (이 step은 `app/content-scheduler/ContentScreen.tsx`만 수정한다)
   - `ADR.md`/`ARCHITECTURE.md` 기술 스택·설계를 벗어나지 않았는가?
   - `CLAUDE.md` CRITICAL 규칙을 위반하지 않았는가?
3. `src/app/content-scheduler/__tests__/ContentScreen.test.tsx`에 탭의 활성/비활성 className을 직접 검증하는 테스트가 있다면 새 클래스 문자열에 맞게 갱신한다. 없다면(동작 검증 위주였다면) 그대로 둔다.
4. 결과에 따라 `phases/boss-ui-redesign/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `src/app/boss-scheduler/BossScreen.tsx`를 수정하지 마라. 이유: 보스 카드 개편은 이미 step 1에서 완료되었다.
- 진행률 바, 리스트 아이템 레이아웃, 캐릭터 드롭다운 등 탭 스타일 외의 다른 부분을 "정리"한다는 명목으로 손대지 마라. 이번 범위는 탭 pill 스타일 적용뿐이다.
- 기존 테스트를 깨뜨리지 마라.
