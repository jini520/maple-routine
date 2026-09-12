/**
 * 초상화 규격 셋의 치수. 둘은 이 부품이 쓰고 하나(`PORTRAIT_HEADER`)는 today 머리의 버튼이 쓴다.
 *
 * 값들이 서로를 붙잡고 있어 하나만 옮기면 얼굴·링·글자가 겹친다. 그 관계는
 * `__tests__/portrait-metrics.test.ts` 가 지킨다. 값 자체는 계산이지 실측이 아니라서,
 * 실기기에서 어긋나면 여기 숫자를 고친다.
 */

/** `centerX` 가 이 값에서 나오므로 먼저 뽑는다. */
const RAIL_SLOT_W = 68

/** 레일 칸. 네 화면이 같은 한 벌을 쓴다. */
export const PORTRAIT_RAIL = {
  slotW: RAIL_SLOT_W,
  slotH: 70,
  centerX: RAIL_SLOT_W / 2,
  /** 상자 한가운데(35)가 아니다. 글자가 아래에만 서므로 원이 위로 붙는다. */
  centerY: 32,
  gap: 4,
  /** 얼굴 원의 지름. 크롭이 기준으로 삼는 상자다. */
  faceSize: 40,
  /** stroke 중심선의 반지름. */
  ringR: 26,
  ringStroke: 3,
  /** 링을 안 그리는 화면이 세우는 빈 링. 진행 링과 같은 두께면 안 찬 트랙으로 읽힌다. */
  emptyRingStroke: 1,
  /** 반원 둘일 때만 12시·6시에서 비운다. 온전한 원에서는 틈이 결손으로 읽힌다. */
  ringGapDeg: 5,
  /** 이름과 레벨이 함께 도는 호 하나의 반지름. */
  textR: 35,
  textFontSize: 8.5,
  /** 레벨과 이름 사이를 벌리는 몫. 6시를 기준으로 좌우 절반씩 나눠 쓴다. */
  textGap: 3,
  /** 글자가 베이스라인에서 자라는 높이의 어림값. 겹침 검사만 쓴다. */
  capHeightRatio: 0.75,
} as const

/**
 * 보스 수익 아코디언 헤더의 칸.
 *
 * `slot` 은 못 바꾼다. 헤더 높이 64px 의 재료이고 칸 수와 무관하게 고정이라야 탭을 옮길 때
 * 카드가 안 튄다. 얼굴 상자이면서 링이 서는 테두리라 `faceSize` 보다 크다.
 */
export const PORTRAIT_COMPACT = {
  slot: 40,
  faceSize: 32,
  ringStroke: 2.5,
  /** 칸 사이 간격(둘레 위의 길이). 12칸이 한 원처럼 안 보이는 최소값이다. */
  ringGap: 2.4,
} as const

/**
 * today 머리의 캐릭터 관리 버튼(`app/today/CharacterManageButton.tsx`).
 *
 * 링도 곡선 글자도 없어 값이 지름 하나뿐이고, 그 하나가 **머리 높이를 정한다**. 상한은 제목 줄
 * (`PAGE_HEADER_TITLE_ROW_MIN_H` 32)과 갱신 시각 줄(`DataFreshness` 의 `h-4` 16)을 쌓은 48 이다.
 * 그보다 크면 머리 덩어리가 그 높이를 따라가 today 만 높아지고, 탭을 옮길 때 들썩여 보인다.
 * 그 약속은 `__tests__/portrait-metrics.test.ts` 가 잰다.
 *
 * 40 은 사용자 지시로 32 에서 올린 값이다. 레일 칸의 얼굴(`PORTRAIT_RAIL.faceSize`)과 같은 지름
 * 이라 이 앱이 이미 그리는 크기이고, 상한 48 아래라 머리 높이는 그대로다.
 */
export const PORTRAIT_HEADER = {
  faceSize: 40,
} as const
