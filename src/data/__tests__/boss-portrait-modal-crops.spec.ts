// 파티 분배 모달의 띠 크롭 표.
//
// **카드 표와 갈라 둔 표다.** 띠(240×104)는 카드(358×80)보다 좁고 높아 같은 값이 다른 구도를 낸다.
// 한 표를 같이 쓰면 모달을 맞출 때마다 보스 카드가 함께 움직인다.
//
// 여기서 지키는 것은 값 하나가 아니라 **두 표가 같은 보스를 든다**는 것이다. 카드에만 있는 보스는
// 모달에서 `cover` 로 떨어져 구도가 조용히 달라진다.
import cardCrops from '../boss-portrait-crops.json'
import modalCrops from '../boss-portrait-modal-crops.json'

const SIZE = /^\d+% auto$/
const POSITION = /^-?\d+(\.\d+)?% -?\d+(\.\d+)?%$/

describe('boss-portrait-modal-crops', () => {
  it('카드 표와 같은 보스를 든다', () => {
    expect(Object.keys(modalCrops).sort()).toEqual(Object.keys(cardCrops).sort())
  })

  // `lib/image-crop.ts` 가 이 두 모양만 읽는다. 어긋나면 에러 없이 `cover` 로 떨어진다.
  it('모든 줄이 읽히는 모양이다', () => {
    for (const [slug, crop] of Object.entries(modalCrops)) {
      expect(`${slug} ${crop.size}`).toMatch(new RegExp(`^${slug} ${SIZE.source.slice(1, -1)}$`))
      expect(crop.position).toMatch(POSITION)
    }
  })
})
