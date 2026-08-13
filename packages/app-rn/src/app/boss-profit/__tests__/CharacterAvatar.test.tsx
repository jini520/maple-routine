// 아바타와 처치 진행 링.
//
// 링이 **진행률의 유일한 표현**이라([[ADR-054]] 정정 7 — `n/12` 텍스트 보류) 접근성 이름이 곧
// 그 정보다. 그리고 그 이름의 주기는 탭을 따라가야 한다([[ADR-059]] 결정 7) — 두 탭이 같은
// 컴포넌트를 쓰므로 "주간"으로 고정하면 월간 탭에서 거짓말이 된다.
import { processColor } from 'react-native'

import { renderAtom, 기본테마 } from '../../../components/__tests__/render-atom'
import {
  AVATAR_FACE_CROP_BOX,
  AVATAR_SIZE,
  AVATAR_SOURCE_IMAGE_SIZE,
  AvatarClearRing,
  CharacterAvatar,
  avatarFaceCropStyle,
} from '../CharacterAvatar'

describe('AvatarClearRing', () => {
  it('주간은 12칸을 그리고 이름으로 진행률을 말한다', async () => {
    const { getByLabelText, getAllByTestId } = await renderAtom(
      <AvatarClearRing cleared={3} total={12} cycle="weekly" />,
    )

    expect(getByLabelText('주간 보스 처치 3 / 12')).toBeTruthy()
    expect(getAllByTestId('avatar-ring-segment')).toHaveLength(12)
  })

  it('월간 탭이면 이름의 주기도 월간이다', async () => {
    const { getByLabelText } = await renderAtom(<AvatarClearRing cleared={1} total={1} cycle="monthly" />)

    expect(getByLabelText('월간 보스 처치 1 / 1')).toBeTruthy()
  })

  // 찬 칸과 빈 칸이 **한 `<Svg>` 안에서 두 색**이라 `className` 이 아니라 테마에서 직접 읽는다
  // (컴포넌트 파일 머리 ③). 색을 손으로 적지 않고 테마 정의에서 가져와 견준다([[ADR-006]] 규약).
  it('찬 칸은 primary, 빈 칸은 border 로 그린다', async () => {
    const { getAllByTestId } = await renderAtom(<AvatarClearRing cleared={2} total={4} cycle="weekly" />)
    // `react-native-svg` 가 색 문자열을 미리 파싱해 `{ type, payload }` 로 바꾼다 — 그 payload 는
    // `processColor` 의 결과라 테마 값에서 같은 방법으로 만들어 견준다(색을 손으로 안 적는다).
    const strokes = getAllByTestId('avatar-ring-segment').map((node) => node.props.stroke.payload)

    expect(strokes).toEqual([
      processColor(기본테마.primary),
      processColor(기본테마.primary),
      processColor(기본테마.border),
      processColor(기본테마.border),
    ])
  })

  // [[ADR-059]] 정정 1 — 나눌 상대가 없는 링에서는 간격이 나눔이 아니라 결손으로 읽힌다.
  it('칸이 하나뿐이면 dash 를 걸지 않고 온전한 원으로 그린다', async () => {
    const { getAllByTestId } = await renderAtom(<AvatarClearRing cleared={1} total={1} cycle="monthly" />)
    const [circle] = getAllByTestId('avatar-ring-segment')

    expect(circle.props.strokeDasharray).toBeUndefined()
    expect(circle.props.strokeDashoffset).toBeUndefined()
  })
})

describe('CharacterAvatar', () => {
  it('초상화가 있으면 얼굴 크롭 좌표 그대로 앉힌다', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterAvatar
        characterName="지내우시"
        imageUrl="https://example.test/face.png"
        clearProgress={{ cleared: 0, total: 12, cycle: 'weekly' }}
      />,
    )

    const image = getByTestId('character-avatar-image')
    // 원격 URI 라 `{ uri }` 로 감싼다(번들 에셋은 반대로 감싸면 안 뜬다).
    expect(image.props.source).toEqual({ uri: 'https://example.test/face.png' })
    expect(image.props.style).toEqual(avatarFaceCropStyle())
  })

  it('초상화가 없으면 이름 첫 글자를 쓴다', async () => {
    const { getByText, queryByTestId } = await renderAtom(
      <CharacterAvatar
        characterName="지내우시"
        imageUrl={null}
        clearProgress={{ cleared: 0, total: 12, cycle: 'weekly' }}
      />,
    )

    expect(getByText('지')).toBeTruthy()
    expect(queryByTestId('character-avatar-image')).toBeNull()
  })
})

describe('avatarFaceCropStyle', () => {
  // 크롭 박스는 사용자가 눈으로 맞춘 값이라([[ADR-015]]) 여기서 다시 계산하지 않고 **정의에서
  // 파생한 관계**만 지킨다 — 배율이 어긋나면 얼굴이 밀린다.
  it('크롭 박스가 32px 슬롯을 꽉 채우도록 확대·이동한다', () => {
    const style = avatarFaceCropStyle()
    const scale = AVATAR_SIZE / AVATAR_FACE_CROP_BOX.size

    expect(style.position).toBe('absolute')
    expect(style.width).toBe(AVATAR_SOURCE_IMAGE_SIZE * scale)
    expect(style.left).toBe(-AVATAR_FACE_CROP_BOX.x * scale)
    expect(style.top).toBe(-AVATAR_FACE_CROP_BOX.y * scale)
  })
})
