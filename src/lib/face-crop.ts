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
 * 원형 프레임 안에 절대 배치할 `<Image>` 의 크기·오프셋·뒤집기.
 *
 * 프레임은 `overflow-hidden rounded-full` 이고, 이 값이 그 안에서 원본을 확대·이동해 크롭 박스가
 * 프레임을 꽉 채우게 만든다.
 *
 * @param size 프레임(원)의 지름
 * @param zoom 크롭 박스를 넓혀 **얼굴을 작게** 보이게 하는 배수. 1 이 기본이고 그때 박스가 프레임을
 *   꽉 채운다. 1.35 면 박스를 35% 넓게 잡아 얼굴 둘레가 더 보인다. 1 보다 작게 주면 더 확대된다
 * @param mirrored 그림을 좌우로 뒤집는다. 줄의 왼쪽 끝에 서는 얼굴이 오른쪽의 글자를 보게 할 때
 * @example faceCropStyle(PORTRAIT_HEADER.faceSize, HEADER_FACE_ZOOM)
 */
export function faceCropStyle(
  size: number = FACE_AVATAR_SIZE,
  zoom = 1,
  mirrored = false,
): {
  width: number
  height: number
  left: number
  top: number
  transform?: { scaleX: number }[]
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
  // 뒤집기는 요소의 중심을 축으로 돌아 원본 x 가 `300 - x` 로 간다. 프레임 중심에 둘 원본 좌표도 거울상이어야
  // 얼굴이 원 가운데에 남는다.
  const framedX = mirrored ? FACE_SOURCE_IMAGE_SIZE - centerX : centerX

  return {
    width: FACE_SOURCE_IMAGE_SIZE * scale,
    height: FACE_SOURCE_IMAGE_SIZE * scale,
    left: size / 2 - framedX * scale,
    top: size / 2 - centerY * scale,
    ...(mirrored ? { transform: [{ scaleX: -1 }] } : {}),
  }
}

/**
 * 머리를 원 밖으로 그리는 얼굴의 비율. `lift` 는 지름에, `top` · `side` 도 지름에 댄 값이다.
 *
 * 크롭 상자를 넓혀(`zoom`) 얼굴을 작게 그리고 위로 올려야(`lift`) 넓힌 위쪽에 머리가 들어간다.
 */
export const HEAD_OVERFLOW = { zoom: 1.1, lift: 0.08, top: 1, side: 1 } as const

/**
 * 머리를 넘기는 얼굴의 마스크 상자. 원의 왼쪽 위가 (0, 0) 인 좌표다.
 *
 * 마스크는 두 조각의 합이다. `upper` 는 상자 위 끝에서 원 중심선까지의 네모, `circle` 은 원래 원이다. 그래서 중심선
 * 아래는 원만 남는다. 두 조각의 좌표는 상자의 왼쪽 위가 (0, 0) 이다.
 *
 * @param size 원의 지름
 */
export function headOverflowFrame(size: number): {
  left: number
  top: number
  width: number
  height: number
  upper: { width: number; height: number }
  circle: { left: number; top: number; size: number }
} {
  const above = HEAD_OVERFLOW.top * size
  const side = HEAD_OVERFLOW.side * size
  const width = size + side * 2
  return {
    left: -side,
    top: -above,
    width,
    height: above + size,
    upper: { width, height: above + size / 2 },
    circle: { left: side, top: above, size },
  }
}

/**
 * 머리를 넘기는 얼굴의 `<Image>` 배치. 마스크 상자(`headOverflowFrame`) 안의 좌표다.
 *
 * @param size 원의 지름
 * @param zoom 호출하는 쪽의 배수. 여기에 `HEAD_OVERFLOW.zoom` 을 곱한다
 * @param mirrored 그림을 좌우로 뒤집는다
 */
export function headOverflowCropStyle(
  size: number,
  zoom = 1,
  mirrored = false,
): ReturnType<typeof faceCropStyle> {
  const frame = headOverflowFrame(size)
  const crop = faceCropStyle(size, zoom * HEAD_OVERFLOW.zoom, mirrored)
  return {
    ...crop,
    left: crop.left - frame.left,
    top: crop.top - frame.top - HEAD_OVERFLOW.lift * size,
  }
}
