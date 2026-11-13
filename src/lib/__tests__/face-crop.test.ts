// 얼굴 크롭 표 → RN 배치 변환의 계약.
//
// **틀려도 에러가 안 나고 그림만 이상하게 잘린다.** 300×300 전신 룩을 확대·이동해 얼굴만 원 안에
// 남기는 계산이라, 값이 조금 어긋나면 정수리나 목이 잘린 얼굴이 조용히 나온다.
//
// `zoom` 이 붙으면서 특히 필요해졌다. 아홉 자리가 이 함수 하나를 쓰는데 기본값이 흔들리면 앱의 모든
// 얼굴이 함께 움직인다. 그래서 **`zoom` 1 이 옛 식과 한 픽셀도 다르지 않다**를 첫 케이스로 둔다.
import {
  FACE_AVATAR_SIZE,
  FACE_CROP_BOX,
  FACE_SOURCE_IMAGE_SIZE,
  faceCropStyle,
  headOverflowCropStyle,
  headOverflowFrame,
} from '../face-crop'

/** `zoom` 이 붙기 전의 식. 이 파일이 지키는 기준선이다. */
function 옛식(size: number) {
  const scale = size / FACE_CROP_BOX.size
  return {
    width: FACE_SOURCE_IMAGE_SIZE * scale,
    height: FACE_SOURCE_IMAGE_SIZE * scale,
    left: -FACE_CROP_BOX.x * scale,
    top: -FACE_CROP_BOX.y * scale,
  }
}

describe('기본 크롭', () => {
  /*
   * 회귀 가드. `zoom` 을 안 주는 자리가 여덟이고, 그 여덟은 이 변경으로 움직이면 안 된다.
   *
   * `left`·`top` 을 정확히 비교하지 않는 이유는 **식을 중심 기준으로 다시 썼기 때문**이다.
   * `size/2 - (x + 24) * scale` 과 `-x * scale` 은 대수적으로 같지만 부동소수 연산 순서가 달라
   * 마지막 비트가 갈린다(44px 의 `top` 에서 1e-13). 픽셀로는 0 이고, 1e-9 는 실제 드리프트라면
   * 반드시 넘는 값이다.
   */
  it.each([26, 32, FACE_AVATAR_SIZE, 40, 44, 56, 72])('%spx 에서 옛 식과 같다', (size) => {
    const 지금 = faceCropStyle(size)
    const 옛 = 옛식(size)

    expect(지금.width).toBe(옛.width)
    expect(지금.height).toBe(옛.height)
    expect(지금.left).toBeCloseTo(옛.left, 9)
    expect(지금.top).toBeCloseTo(옛.top, 9)
  })

  // 크롭 박스가 프레임을 꽉 채운다는 것이 기본값의 정의다.
  it('박스가 프레임을 꽉 채운다', () => {
    const { width } = faceCropStyle(48)

    expect(width).toBe(FACE_SOURCE_IMAGE_SIZE)
  })
})

// `zoom` 은 **박스를 넓혀** 얼굴을 작게 보이게 한다. 원을 키우는 것이 아니라 같은 원에서 얼굴이
// 차지하는 몫을 줄이는 값이다.
describe('zoom', () => {
  const SIZE = 40

  it('1 보다 크면 그림이 작아진다. 얼굴 둘레가 더 보인다', () => {
    const 기본 = faceCropStyle(SIZE)
    const 넓게 = faceCropStyle(SIZE, 1.35)

    expect(넓게.width).toBeLessThan(기본.width)
    expect(넓게.width).toBeCloseTo(기본.width / 1.35, 5)
  })

  it('1 보다 작으면 더 확대된다', () => {
    expect(faceCropStyle(SIZE, 0.5).width).toBeGreaterThan(faceCropStyle(SIZE).width)
  })

  /*
   * **중심이 안 움직인다.** 이 관계가 이 값의 핵심이다.
   *
   * 박스의 왼쪽 위를 프레임에 붙이는 옛 식을 그대로 두고 박스만 넓히면 얼굴이 왼쪽 위로 쏠린다.
   * 프레임 중심에 놓이는 원본 좌표가 `zoom` 과 무관하게 같아야 한다.
   */
  it.each([1, 1.35, 2])('zoom %s 에서 프레임 중심이 같은 원본 좌표를 본다', (zoom) => {
    const { left, top, width } = faceCropStyle(SIZE, zoom)
    const scale = width / FACE_SOURCE_IMAGE_SIZE

    // 프레임 중심(SIZE/2)이 원본의 어느 픽셀인가.
    expect((SIZE / 2 - left) / scale).toBeCloseTo(FACE_CROP_BOX.x + FACE_CROP_BOX.size / 2, 5)
    expect((SIZE / 2 - top) / scale).toBeCloseTo(FACE_CROP_BOX.y + FACE_CROP_BOX.size / 2, 5)
  })

  it('가로와 세로가 같은 배율이다. 얼굴이 안 늘어난다', () => {
    const { width, height } = faceCropStyle(SIZE, 1.35)

    expect(width).toBe(height)
  })
})

// `mirrored` 는 그림을 좌우로 뒤집는다. RN 의 transform 은 요소의 중심을 축으로 돌아서, 뒤집으면 프레임 중심에
// 놓이는 원본 좌표가 거울상(300 - x)이 된다. 그 자리를 안 옮기면 얼굴이 원 안에서 옆으로 쏠린다.
describe('mirrored', () => {
  const SIZE = 36

  it('뒤집으면 프레임 중심이 거울상 원본 좌표를 본다', () => {
    const { left, top, width } = faceCropStyle(SIZE, 1, true)
    const scale = width / FACE_SOURCE_IMAGE_SIZE
    const centerX = FACE_CROP_BOX.x + FACE_CROP_BOX.size / 2

    expect((SIZE / 2 - left) / scale).toBeCloseTo(FACE_SOURCE_IMAGE_SIZE - centerX, 5)
    expect((SIZE / 2 - top) / scale).toBeCloseTo(FACE_CROP_BOX.y + FACE_CROP_BOX.size / 2, 5)
  })

  it('뒤집으면 transform 이 붙고, 안 뒤집으면 없다', () => {
    expect(faceCropStyle(SIZE, 1, true).transform).toEqual([{ scaleX: -1 }])
    expect(faceCropStyle(SIZE).transform).toBeUndefined()
  })
})

// 머리를 원 밖으로 그리는 얼굴. 원 중심선 위는 원 위로 지름만큼 · 양옆으로 지름만큼 넓힌 네모로 자르고, 아래는 원으로
// 자른다. 값이 어긋나도 에러는 안 나고 머리가 엉뚱한 높이에서 잘릴 뿐이라 관계로 지킨다.
describe('머리 넘침', () => {
  const SIZE = 36
  const 중심X = FACE_CROP_BOX.x + FACE_CROP_BOX.size / 2
  const 중심Y = FACE_CROP_BOX.y + FACE_CROP_BOX.size / 2

  it('마스크 상자는 원 위로 지름만큼, 양옆으로 지름만큼 넓다', () => {
    const frame = headOverflowFrame(SIZE)

    expect(frame.top).toBe(-SIZE)
    expect(frame.left).toBe(-SIZE)
    expect(frame.width).toBe(SIZE * 3)
    expect(frame.height).toBe(SIZE * 2)
  })

  // 원 조각이 옮겨 가면 중심선 아래가 원래 원과 다른 자리에서 잘린다.
  it('원 조각은 원래 원 자리에 그대로 선다', () => {
    const frame = headOverflowFrame(SIZE)

    expect(frame.circle).toEqual({ left: -frame.left, top: -frame.top, size: SIZE })
  })

  it('네모 조각은 상자 위 끝에서 원 중심선까지라, 중심선 아래는 원만 남는다', () => {
    const frame = headOverflowFrame(SIZE)

    expect(frame.upper.width).toBe(frame.width)
    expect(frame.upper.height).toBe(frame.circle.top + SIZE / 2)
  })

  it('크롭 상자를 1.1 배로 넓혀 얼굴이 작아진다. 받은 배수에 곱한다', () => {
    expect(headOverflowCropStyle(SIZE).width).toBeCloseTo(faceCropStyle(SIZE).width / 1.1, 9)
    expect(headOverflowCropStyle(40, 1.35).width).toBeCloseTo(faceCropStyle(40, 1.35).width / 1.1, 9)
  })

  // 얼굴이 올라간 만큼 넓힌 위쪽에 머리가 들어간다. 원 중심이 원본에서 그만큼 아래를 본다.
  it('얼굴이 지름의 8% 만큼 위로 올라간다', () => {
    const frame = headOverflowFrame(SIZE)
    const { left, top, width } = headOverflowCropStyle(SIZE)
    const scale = width / FACE_SOURCE_IMAGE_SIZE
    const 원중심 = { x: frame.circle.left + SIZE / 2, y: frame.circle.top + SIZE / 2 }

    expect((원중심.x - left) / scale).toBeCloseTo(중심X, 5)
    expect((원중심.y - top) / scale).toBeCloseTo(중심Y + (SIZE * 0.08) / scale, 5)
  })

  it('뒤집어도 올리는 양은 같고, 원 중심이 거울상 원본 좌표를 본다', () => {
    const frame = headOverflowFrame(SIZE)
    const 뒤집음 = headOverflowCropStyle(SIZE, 1, true)
    const scale = 뒤집음.width / FACE_SOURCE_IMAGE_SIZE

    expect(뒤집음.top).toBe(headOverflowCropStyle(SIZE).top)
    expect(뒤집음.transform).toEqual([{ scaleX: -1 }])
    expect((frame.circle.left + SIZE / 2 - 뒤집음.left) / scale).toBeCloseTo(FACE_SOURCE_IMAGE_SIZE - 중심X, 5)
  })
})
