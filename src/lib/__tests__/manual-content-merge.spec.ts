import { mergeManualContentList, orderContentsByTemplate } from '../scheduler/manual-content-merge'
import type { ContentEntry } from '../scheduler/contents'
import type { DailyContent } from '../../types'
import type { ManualTrackedContentItem } from '../../types/scheduler'

function contentItem(contentKey: string): ManualTrackedContentItem {
  return { contentKey, kind: 'daily' }
}

function synced(
  overrides: Partial<DailyContent> & { contentKey: string | null; apiName: string },
): DailyContent {
  return {
    kind: 'contents',
    isRegistered: false,
    nowCount: 0,
    maxCount: 0,
    questState: null,
    ...overrides,
  }
}

function templateEntry(overrides: Partial<ContentEntry> & { key: string; content_name: string }): ContentEntry {
  return {
    category: 'daily_quest',
    displayName: overrides.content_name,
    shortName: overrides.content_name,
    type: 'contents',
    registration_flag: 'false',
    now_count: 0,
    max_count: 0,
    quest_state: null,
    ...overrides,
  }
}

/** 순서만 보는 사례의 줄. API 이름은 key 와 같게 둔다. */
function keyed(key: string): ContentEntry {
  return templateEntry({ key, content_name: key })
}

describe('mergeManualContentList', () => {
  it('synced에 있는 항목은 등록 여부(isRegistered)와 무관하게 synced 값을 그대로 쓴다', () => {
    const tracked = [contentItem('monster_park')]
    const syncedList = [
      synced({
        contentKey: 'monster_park',
        apiName: '몬스터파크',
        kind: 'contents',
        isRegistered: false,
        nowCount: 9,
        maxCount: 14,
        questState: null,
      }),
    ]
    const template = [templateEntry({ key: 'monster_park', content_name: '몬스터파크', now_count: 0, max_count: 14 })]

    const result = mergeManualContentList(tracked, syncedList, template)

    expect(result).toEqual([
      {
        contentKey: 'monster_park',
        apiName: '몬스터파크',
        kind: 'contents',
        isRegistered: true,
        nowCount: 9,
        maxCount: 14,
        questState: null,
      },
    ])
  })

  it('synced에 quest 항목이면 kind/questState까지 synced 값을 그대로 쓴다', () => {
    const tracked = [contentItem('daily_quest_lacheln')]
    const syncedList = [
      synced({
        contentKey: 'daily_quest_lacheln',
        apiName: '[일일 퀘스트] 레헬른의 평온한 밤',
        kind: 'quest',
        isRegistered: true,
        nowCount: 0,
        maxCount: 100,
        questState: 1,
      }),
    ]

    const result = mergeManualContentList(tracked, syncedList, [])

    expect(result).toEqual([
      {
        contentKey: 'daily_quest_lacheln',
        apiName: '[일일 퀘스트] 레헬른의 평온한 밤',
        kind: 'quest',
        isRegistered: true,
        nowCount: 0,
        maxCount: 100,
        questState: 1,
      },
    ])
  })

  // API 이름의 공백이 템플릿과 달라도 key 가 같으면 같은 항목이다. 표시는 받은 원문을 든다.
  it('synced 의 API 이름이 템플릿과 달라도 key 로 잇고, apiName 은 synced 원문이다', () => {
    const tracked = [contentItem('monster_park')]
    const syncedList = [synced({ contentKey: 'monster_park', apiName: '몬스터 파크', nowCount: 3, maxCount: 14 })]
    const template = [templateEntry({ key: 'monster_park', content_name: '몬스터파크', max_count: 14 })]

    const result = mergeManualContentList(tracked, syncedList, template)

    expect(result).toEqual([expect.objectContaining({ contentKey: 'monster_park', apiName: '몬스터 파크', nowCount: 3 })])
  })

  it('synced에 없고 template에만 있으면 template 기본값을 쓰고 quest_state 문자열을 숫자로 변환한다', () => {
    const tracked = [contentItem('daily_quest_road_of_vanishing')]
    const template = [
      templateEntry({
        key: 'daily_quest_road_of_vanishing',
        content_name: '[일일 퀘스트] 소멸의 여로 조사',
        type: 'quest',
        now_count: 0,
        max_count: 100,
        quest_state: '0',
      }),
    ]

    const result = mergeManualContentList(tracked, [], template)

    expect(result).toEqual([
      {
        contentKey: 'daily_quest_road_of_vanishing',
        apiName: '[일일 퀘스트] 소멸의 여로 조사',
        kind: 'quest',
        isRegistered: true,
        nowCount: 0,
        maxCount: 100,
        questState: 0,
      },
    ])
  })

  it('synced에도 template에도 없으면 크래시 없이 안전한 기본값을 반환한다(항목을 버리지 않음)', () => {
    const tracked = [contentItem('unknown_content')]

    const result = mergeManualContentList(tracked, [], [])

    expect(result).toEqual([
      {
        contentKey: 'unknown_content',
        apiName: 'unknown_content',
        kind: 'contents',
        isRegistered: true,
        nowCount: 0,
        maxCount: 0,
        questState: null,
      },
    ])
  })

  // 표시 순서는 멤버십(tracked) 삽입 순서가 아니라 template 순서로
  // 고정한다. 추가/삭제해도 순서가 흔들리지 않게. (구 계약 "tracked 순서 유지"를 대체)
  it('반환 순서는 tracked 삽입 순서가 아니라 template 순서를 따른다', () => {
    const tracked = [contentItem('third'), contentItem('first'), contentItem('second')]
    const template = [keyed('first'), keyed('second'), keyed('third')]

    const result = mergeManualContentList(tracked, [], template)

    expect(result.map((c) => c.contentKey)).toEqual(['first', 'second', 'third'])
  })

  it('template에 없는 tracked 항목은 버리지 않고 template 항목들 뒤에 tracked 순서로 붙인다', () => {
    const tracked = [contentItem('orphan_b'), contentItem('first'), contentItem('orphan_a')]
    const template = [keyed('first'), keyed('second')]

    const result = mergeManualContentList(tracked, [], template)

    // template에 있는 first 먼저, 그다음 template에 없는 고아들은 tracked 순서(orphan_b, orphan_a)로
    expect(result.map((c) => c.contentKey)).toEqual(['first', 'orphan_b', 'orphan_a'])
  })
})

// auto 모드 표시 목록을 수동 모드(mergeManualContentList)와 동일한 template 순서로 맞추기 위한 헬퍼.
describe('orderContentsByTemplate', () => {
  it('API/병합 순서와 무관하게 template(=컨텐츠 관리) 순서로 정렬한다', () => {
    const contents = [
      synced({ contentKey: 'third', apiName: '세번째' }),
      synced({ contentKey: 'first', apiName: '첫번째' }),
      synced({ contentKey: 'second', apiName: '두번째' }),
    ]
    const template = [keyed('first'), keyed('second'), keyed('third')]

    const result = orderContentsByTemplate(contents, template)

    expect(result.map((c) => c.contentKey)).toEqual(['first', 'second', 'third'])
  })

  it('template에 없는 항목과 key 가 없는 항목은 뒤로 보내되 원래 순서를 안정적으로 유지한다', () => {
    const contents = [
      synced({ contentKey: 'orphan_b', apiName: '고아B' }),
      synced({ contentKey: null, apiName: '표에 없는 컨텐츠' }),
      synced({ contentKey: 'first', apiName: '첫번째' }),
      synced({ contentKey: 'orphan_a', apiName: '고아A' }),
    ]
    const template = [keyed('first'), keyed('second')]

    const result = orderContentsByTemplate(contents, template)

    expect(result.map((c) => c.apiName)).toEqual(['첫번째', '고아B', '표에 없는 컨텐츠', '고아A'])
  })

  it('원본 배열을 변경하지 않는다', () => {
    const contents = [
      synced({ contentKey: 'second', apiName: '두번째' }),
      synced({ contentKey: 'first', apiName: '첫번째' }),
    ]
    const template = [keyed('first'), keyed('second')]

    orderContentsByTemplate(contents, template)

    expect(contents.map((c) => c.contentKey)).toEqual(['second', 'first'])
  })
})
