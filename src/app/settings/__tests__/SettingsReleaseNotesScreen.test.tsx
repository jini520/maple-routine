// 웹판(312줄)의 명세를 읽어 다시 쓴 것.
//
// 갈린 것 넷
// ① **라우터 프로브가 없다** — 항목을 누르면 `navigate('SettingsReleaseNoteGuide', {…})` 가
//    불리는지를 본다. 웹의 `?s=` 쿼리 자리는 `section` 파라미터다([[ADR-125]] 결정 7 · `routes.ts`).
// ② **`사용 중` 배지의 기준이 빌드 시점 버전으로 좁혀졌다**([[ADR-128]] 결정 7) — `currentVersion`
//    을 물을 수 없어 웹의 폴백 경로만 남았다. 그래서 웹의 「currentVersion 이 있으면/없으면」
//    두 케이스가 하나로 접히고, **「매니페스트를 조회하지 않는다」는 검사할 스토어가 없어 사라진다**
//    (그 계약은 이제 구조가 지킨다 — 이 화면은 live-update 를 import 조차 하지 않는다).
// ③ `closest('li')` → **항목 텍스트에서 위로 올라가** 그 행을 잡는다.
// ④ **픽스처 주입 방식이 갈린다 — getter 가 안 통한다.** 웹은 `vi.mock` 이 돌려준 객체에 getter 를
//    얹어 매 접근마다 픽스처를 갈아 끼웠는데, jest + Babel 조합에서는 **모듈 네임스페이스가 한 번
//    복사되면서 getter 가 그때 딱 한 번 평가된다**(실측 — `__esModule: true` 를 붙여도 같다).
//    그래서 **배열의 정체성을 고정해 두고 내용만 갈아 끼운다**(`mockNotes` 를 비우고 다시 채운다) —
//    화면이 렌더할 때 `.map`/`.length` 를 읽으므로 같은 효과이고, 방식은 오히려 단순해진다.
import { act, fireEvent } from '@testing-library/react-native'

import type { ReleaseNote } from '../../../types'

import packageJson from '../../../../package.json'
import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { SettingsReleaseNotesScreen } from '../SettingsReleaseNotesScreen'
import { useSettingsNavigation } from '../use-settings-navigation'

// 노트 데이터는 **화면이 아니라 데이터 파일이 소유한다**([[ADR-119]] 결정 4) — 여러 건이 필요한
// 케이스(순서·항목 단위 표식)를 위해 `src/data/release-notes.ts` 를 늘리지 않고 여기서 픽스처를
// 주입한다. 아무것도 안 넣으면 `beforeEach` 가 진짜 데이터를 되돌려 놓는다(파일 머리 ④).
// **배열은 팩토리가 만든다.** 바깥에 `const` 로 두면 팩토리가 먼저 돌아(테스트 파일의 import 시점)
// 아직 초기화되지 않은 값을 실어 보낸다 — 화면이 `undefined.length` 에서 죽는다(실측).
jest.mock('../../../data/release-notes', () => ({
  ...jest.requireActual('../../../data/release-notes'),
  RELEASE_NOTES: [],
}))

const mockNotes = jest.requireMock<typeof import('../../../data/release-notes')>(
  '../../../data/release-notes',
).RELEASE_NOTES as ReleaseNote[]

jest.mock('../use-settings-navigation', () => ({ useSettingsNavigation: jest.fn() }))

/** 픽스처를 갈아 끼운다 — **배열 정체성은 유지한다**(파일 머리 ④). */
function setNotes(notes: ReleaseNote[]): void {
  mockNotes.length = 0
  mockNotes.push(...notes)
}

const mockedUseSettingsNavigation = jest.mocked(useSettingsNavigation)
const navigate = jest.fn()
const goBack = jest.fn()

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

/** 그 문구를 담은 눌리는 항목 — 없으면 null(안내가 없는 항목은 눌리지 않는다). */
function pressableItem(view: Rendered, text: string): AtomElement | null {
  let node: AtomElement | null = view.getByText(text)
  while (node !== null && node.props.role !== 'button') node = node.parent
  return node
}

function textsIn(node: AtomElement): string[] {
  const texts: string[] = []
  const walk = (current: AtomElement): void => {
    for (const child of current.children) {
      if (typeof child === 'string') texts.push(child)
      else walk(child)
    }
  }
  walk(node)
  return texts
}

const 진짜노트 = jest.requireActual<typeof import('../../../data/release-notes')>(
  '../../../data/release-notes',
).RELEASE_NOTES

beforeEach(() => {
  setNotes(진짜노트)
  mockedUseSettingsNavigation.mockReturnValue({ navigate, goBack } as unknown as ReturnType<
    typeof useSettingsNavigation
  >)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('SettingsReleaseNotesScreen', () => {
  it('"개발 노트" 제목과 뒤로 버튼을 그리고, 뒤로를 누르면 pop 한다', async () => {
    const view = await renderOverlay(<SettingsReleaseNotesScreen />)

    expect(view.getByText('개발 노트')).toBeTruthy()

    await press(view.getByLabelText('뒤로'))

    expect(goBack).toHaveBeenCalledTimes(1)
  })

  // 앱 번들에 실린 진짜 데이터를 그대로 그린다 — 이 화면의 계약이 "네트워크 0회, 과거 전체"다.
  it('RELEASE_NOTES 의 모든 버전과 모든 항목 문구를 그린다', async () => {
    const view = await renderOverlay(<SettingsReleaseNotesScreen />)

    expect(진짜노트.length).toBeGreaterThan(0)
    for (const note of 진짜노트) {
      expect(view.getByText(note.version)).toBeTruthy()
      expect(view.getByText(note.date)).toBeTruthy()
      for (const item of note.items) expect(view.getByText(item.text)).toBeTruthy()
    }
  })

  // [[ADR-119]]: "최신이 먼저"는 데이터의 계약이고 그 강제는 데이터 테스트가 한다 — 화면이 다시
  // 정렬하면 같은 규칙의 진실이 두 곳에 생긴다.
  it('배열 순서를 그대로 그린다 — 화면이 정렬하지 않는다', async () => {
    setNotes([
      { version: '1.0.4', date: '2026-08-20', items: [{ category: 'feature', text: '나중 것' }] },
      { version: '1.0.3', date: '2026-08-09', items: [{ category: 'feature', text: '먼저 것' }] },
    ])
    const view = await renderOverlay(<SettingsReleaseNotesScreen />)

    expect(view.getAllByTestId('release-note-version').map((node) => node.props.children)).toEqual([
      '1.0.4',
      '1.0.3',
    ])
  })

  // [[ADR-119]] 결정 3: 표식은 버전이 아니라 **항목**에 붙는다 — 한 릴리스에 OTA 변경과 네이티브
  // 변경이 섞이는 것이 정상이고, 버전 단위로 묶으면 OTA 로 받을 수 있는 나머지까지 못 받는
  // 것처럼 읽힌다.
  it('requiresStoreUpdate 인 항목에만 「스토어 업데이트 필요」 표식을 붙인다', async () => {
    setNotes([
      {
        version: '1.0.4',
        date: '2026-08-20',
        items: [
          { category: 'improvement', text: 'OTA 로 가는 변경' },
          { category: 'feature', text: '네이티브가 필요한 변경', requiresStoreUpdate: true },
        ],
      },
    ])
    const view = await renderOverlay(<SettingsReleaseNotesScreen />)

    const badges = view.getAllByText('스토어 업데이트 필요')
    expect(badges).toHaveLength(1)

    // 그 배지가 네이티브 항목과 같은 덩이 안에 있어야 한다 — 위로 올라가며 형제 글자를 본다.
    let block: AtomElement | null = badges[0]
    while (block !== null && !textsIn(block).includes('네이티브가 필요한 변경')) block = block.parent
    expect(block).not.toBeNull()
    expect(textsIn(block as AtomElement)).not.toContain('OTA 로 가는 변경')
  })

  // [[ADR-119]] 결정 9: 항목마다 배지를 반복하는 대신 카테고리로 묶는다. 순서는 데이터가 아니라
  // RELEASE_NOTE_CATEGORY_ORDER 가 정한다 — 어떤 순서로 적든 화면은 같아야 한다.
  it('카테고리로 묶어 그리고, 순서는 데이터 순서가 아니라 정해진 순서다', async () => {
    setNotes([
      {
        version: '1.0.4',
        date: '2026-08-20',
        items: [
          // 일부러 뒤섞어 둔다 — 데이터 순서를 따라가면 이 케이스가 깨진다.
          { category: 'fix', text: '고친 것' },
          { category: 'feature', text: '새 기능' },
          { category: 'improvement', text: '나아진 것' },
        ],
      },
    ])
    const view = await renderOverlay(<SettingsReleaseNotesScreen />)

    const groups = view.getAllByTestId('release-note-group')
    expect(groups.map((group) => textsIn(group)[0])).toEqual(['기능', '개선', '버그'])
    expect(textsIn(groups[0])).toContain('새 기능')
    expect(textsIn(groups[1])).toContain('나아진 것')
    expect(textsIn(groups[2])).toContain('고친 것')
  })

  // `ThemeSelector` 의 카테고리 섹션과 같은 규칙 — 거른 결과가 0이면 헤더째 감춘다.
  it('항목이 없는 카테고리는 제목째 그리지 않는다', async () => {
    setNotes([
      { version: '1.0.4', date: '2026-08-20', items: [{ category: 'fix', text: '고친 것' }] },
    ])
    const view = await renderOverlay(<SettingsReleaseNotesScreen />)

    expect(view.getAllByTestId('release-note-group')).toHaveLength(1)
    expect(view.getByText('버그')).toBeTruthy()
    expect(view.queryByText('기능')).toBeNull()
    expect(view.queryByText('개선')).toBeNull()
  })

  // 배지의 기준이 **빌드 시점 버전**이다(파일 머리 ②).
  it('지금 실행 중인 버전에만 "사용 중" 배지를 붙인다', async () => {
    setNotes([
      { version: packageJson.version, date: '2026-08-09', items: [{ category: 'feature', text: 'A' }] },
      { version: '0.0.1', date: '2026-01-01', items: [{ category: 'feature', text: 'B' }] },
    ])
    const view = await renderOverlay(<SettingsReleaseNotesScreen />)

    const badges = view.getAllByText('사용 중')
    expect(badges).toHaveLength(1)

    let card: AtomElement | null = badges[0]
    while (card !== null && card.props.testID !== 'release-note') card = card.parent
    expect(textsIn(card as AtomElement)).toContain(packageJson.version)
  })

  // 없는 것을 지어내지 않는다 — 1.0.2 이전 사용자는 자기 버전이 목록에 없다([[ADR-119]] 결정 4).
  it('일치하는 버전이 없으면 배지를 하나도 붙이지 않는다', async () => {
    setNotes([
      { version: '0.0.1', date: '2026-01-01', items: [{ category: 'feature', text: '항목' }] },
    ])
    const view = await renderOverlay(<SettingsReleaseNotesScreen />)

    expect(view.queryByText('사용 중')).toBeNull()
  })

  it('노트가 하나도 없으면 빈 상태를 그린다', async () => {
    setNotes([])
    const view = await renderOverlay(<SettingsReleaseNotesScreen />)

    expect(view.getByText('아직 기록된 변경 내역이 없습니다')).toBeTruthy()
    expect(view.queryAllByTestId('release-note')).toHaveLength(0)
  })

  // [[ADR-125]] 결정 5: 안내가 있는 항목만 눌린다. 버그 수정 한 줄에 붙일 사용법은 없고, 액션이
  // 없는 자리에 액션처럼 보이는 것을 두지 않는다.
  it('guideId 가 있는 항목만 눌리고, 누르면 그 안내로 민다', async () => {
    setNotes([
      {
        version: '1.0.4',
        date: '2026-08-20',
        items: [
          { category: 'feature', text: '안내가 있는 기능', guideId: 'boss-party' },
          { category: 'fix', text: '안내가 없는 수정' },
        ],
      },
    ])
    const view = await renderOverlay(<SettingsReleaseNotesScreen />)

    expect(pressableItem(view, '안내가 없는 수정')).toBeNull()
    expect(view.getByText('안내가 없는 수정')).toBeTruthy()

    const guided = pressableItem(view, '안내가 있는 기능')
    expect(guided).not.toBeNull()
    await press(guided as AtomElement)

    expect(navigate).toHaveBeenCalledWith('SettingsReleaseNoteGuide', {
      guideId: 'boss-party',
      section: undefined,
    })
  })

  // [[ADR-125]] 결정 7: 릴리스에서 바뀐 것은 보통 기능 전체가 아니라 그중 한 마디다.
  it('guideSectionId 가 있으면 그 마디까지 넘긴다', async () => {
    setNotes([
      {
        version: '1.0.4',
        date: '2026-08-20',
        items: [
          {
            category: 'improvement',
            text: '마디를 가리키는 항목',
            guideId: 'boss-party',
            guideSectionId: 'card',
          },
        ],
      },
    ])
    const view = await renderOverlay(<SettingsReleaseNotesScreen />)

    await press(pressableItem(view, '마디를 가리키는 항목') as AtomElement)

    expect(navigate).toHaveBeenCalledWith('SettingsReleaseNoteGuide', {
      guideId: 'boss-party',
      section: 'card',
    })
  })

  // 안내 없는 항목은 **트리가 종전과 같다** — 래퍼도 클래스도 만들지 않는다([[ADR-125]] 결정 5).
  it('안내가 하나도 없으면 chevron 도 하나도 없다', async () => {
    setNotes([
      {
        version: '1.0.4',
        date: '2026-08-20',
        items: [
          { category: 'fix', text: '수정 하나' },
          { category: 'fix', text: '수정 둘' },
        ],
      },
    ])
    const view = await renderOverlay(<SettingsReleaseNotesScreen />)

    expect(view.queryAllByTestId('release-note-item-chevron')).toHaveLength(0)
  })
})
