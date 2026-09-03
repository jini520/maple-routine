/**
 * 얼굴 크롭. `character/basic` 이 주는 300×300 전신 룩에서 얼굴만 확대해 자른다.
 *
 * 이 표가 네 자리(보스 수익 아바타 · 초상화 레일 · 계정 행 · 캐릭터 카드)에 복사되면 같은
 * 얼굴이 화면마다 다르게 잘린다. 실제로 캐릭터 카드 하나가 56px 그리드 시절의 표를 들고
 * 있었다. 드롭다운 행의 표(48px 크롭 · 36px 아바타)로 통일하고 여기 한 곳에 둔다.
 *
 * 좌표는 실측이 아니라 근사다. 헤어스타일·포즈에 따라 완벽히 얼굴만 나오지 않는다. 넥슨이
 * 크롭 쿼리를 공식 지원하면 그때 이 표가 통째로 없어진다.
 */
export const FACE_SOURCE_IMAGE_SIZE = 300
export const FACE_CROP_BOX = { x: 123, y: 128, size: 48 } as const

/** 캐릭터 행·계정 행이 함께 쓰는 아바타 지름. 두 자리가 같은 크기여야 같은 얼굴로 읽힌다. */
export const FACE_AVATAR_SIZE = 36

/**
 * 원형 프레임 안에 절대 배치할 `<Image>` 의 크기·오프셋.
 *
 * 프레임은 `overflow-hidden rounded-full` 이고, 이 값이 그 안에서 원본을 확대·이동해 크롭 박스가
 * 프레임을 꽉 채우게 만든다.
 */
export function faceCropStyle(size: number = FACE_AVATAR_SIZE): {
  width: number
  height: number
  left: number
  top: number
} {
  const scale = size / FACE_CROP_BOX.size
  return {
    width: FACE_SOURCE_IMAGE_SIZE * scale,
    height: FACE_SOURCE_IMAGE_SIZE * scale,
    left: -FACE_CROP_BOX.x * scale,
    top: -FACE_CROP_BOX.y * scale,
  }
}
