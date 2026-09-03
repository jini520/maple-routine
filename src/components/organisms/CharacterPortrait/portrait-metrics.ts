/**
 * 초상화 두 규격의 치수. 이 부품이 쓰는 숫자는 여기 다 있다.
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
