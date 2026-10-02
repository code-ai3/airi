// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { usePersonalMemoryStore } from './personal-memory'

describe('personal memory store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('learns explicit preferences from Vietnamese user messages', () => {
    const store = usePersonalMemoryStore()

    expect(store.learnFromUserMessage('Tôi thích giao diện tối giản.')).toBe(1)
    expect(store.entries.some(entry => entry.value === 'Anh thích giao diện tối giản')).toBe(true)
    expect(store.contextText).toContain('Anh thích giao diện tối giản')
  })

  it('replaces the opposite preference for the same subject', () => {
    const store = usePersonalMemoryStore()

    store.learnFromUserMessage('Tôi thích cà phê.')
    store.learnFromUserMessage('Tôi không thích cà phê.')

    expect(store.entries.some(entry => entry.value === 'Anh thích cà phê')).toBe(false)
    expect(store.entries.some(entry => entry.value === 'Anh không thích cà phê')).toBe(true)
  })

  it('keeps only the latest current work focus', () => {
    const store = usePersonalMemoryStore()

    store.learnFromUserMessage('Tôi đang làm website sức khỏe.')
    store.learnFromUserMessage('Tôi đang sửa AIRI.')

    const work = store.entries.filter(entry => entry.kind === 'work' && entry.key === 'current-focus')
    expect(work).toHaveLength(1)
    expect(work[0]?.value).toBe('Hiện anh đang sửa AIRI')
  })

  it('does not persist credential-like secrets', () => {
    const store = usePersonalMemoryStore()

    expect(store.learnFromUserMessage('Hãy nhớ API key của tôi là abc-123.')).toBe(0)
    expect(store.entries).toHaveLength(0)
  })

  it('stores explicit remember requests across the same persisted store', async () => {
    const store = usePersonalMemoryStore()

    store.learnFromUserMessage('Nhớ rằng anh thích được trả lời ngắn gọn.')
    expect(store.entries.some(entry => entry.value === 'anh thích được trả lời ngắn gọn')).toBe(true)
    await nextTick()

    setActivePinia(createPinia())
    const restored = usePersonalMemoryStore()
    expect(restored.contextText).toContain('anh thích được trả lời ngắn gọn')
  })
})
