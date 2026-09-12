/**
 * 얼굴 크롭. `character/basic` 이 주는 300×300 전신 룩에서 얼굴만 확대해 자른다.
 *
 * 이 표가 네 자리(보스 수익 아바타 · 초상화 레일 · 계정 행 · 캐릭터 카드)에 복사되면 같은
 * 얼굴이 화면마다 다르게 잘린다. 그래서 48px 크롭 · 36px 아바타 한 벌로 통일해 여기 한 곳에 둔다.
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
 *
 * @param size 프레임(원)의 지름
 * @param zoom 크롭 박스를 넓혀 **얼굴을 작게** 보이게 하는 배수. 1 이 기본이고 그때 박스가 프레임을
 *   꽉 채운다. 1.35 면 박스를 35% 넓게 잡아 얼굴 둘레가 더 보인다. 1 보다 작게 주면 더 확대된다
 * @example faceCropStyle(PORTRAIT_HEADER.faceSize, HEADER_FACE_ZOOM)
 */
export function faceCropStyle(
  size: number = FACE_AVATAR_SIZE,
  zoom = 1,
): {
  width: number
  height: number
  left: number
  top: number
} {
  const scale = size / (FACE_CROP_BOX.size * zoom)

  /*
   * 박스의 **중심**을 프레임 중심에 맞춘다.
   *
   * `-x * scale` 로 두면 박스의 왼쪽 위 모서리가 프레임 왼쪽 위에 붙는다. `zoom` 이 1 일 때는 박스와
   * 프레임이 같은 크기라 그것이 곧 중심 정렬이지만, 넓힌 박스에서는 얼굴이 왼쪽 위로 쏠린다.
   * 그래서 중심을 기준으로 적는다. `zoom` 이 1 이면 아래 식이 `-x * scale` 로 되돌아간다.
   */
  const centerX = FACE_CROP_BOX.x + FACE_CROP_BOX.size / 2
  const centerY = FACE_CROP_BOX.y + FACE_CROP_BOX.size / 2

  return {
    width: FACE_SOURCE_IMAGE_SIZE * scale,
    height: FACE_SOURCE_IMAGE_SIZE * scale,
    left: size / 2 - centerX * scale,
    top: size / 2 - centerY * scale,
  }
}
