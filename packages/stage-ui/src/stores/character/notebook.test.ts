// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { useCharacterNotebookStore } from './notebook'

describe('character notebook persistence and due tasks', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('persists scheduled tasks across a new Pinia instance', async () => {
    const store = useCharacterNotebookStore()
    const dueAt = Date.now() + 60_000

    const task = store.scheduleTask({
      title: 'Kiểm tra AIRI',
      details: 'Chạy typecheck',
      dueAt,
      priority: 'high',
    })

    expect(task.status).toBe('scheduled')
    await nextTick()

    setActivePinia(createPinia())
    const restored = useCharacterNotebookStore()
    expect(restored.tasks).toHaveLength(1)
    expect(restored.tasks[0]?.title).toBe('Kiểm tra AIRI')
    expect(restored.tasks[0]?.dueAt).toBe(dueAt)
  })

  it('does not treat an unscheduled queued task as due', () => {
    const store = useCharacterNotebookStore()
    store.scheduleTask({ title: 'Việc chưa hẹn giờ' })

    expect(store.tasks[0]?.status).toBe('queued')
    expect(store.getDueTasks(Date.now(), 60_000)).toHaveLength(0)
  })

  it('returns scheduled tasks inside the notify window and stops after unscheduling', () => {
    const store = useCharacterNotebookStore()
    const now = Date.now()
    const task = store.scheduleTask({
      title: 'Nhắc uống nước',
      dueAt: now + 30_000,
    })

    expect(store.getDueTasks(now, 60_000).map(item => item.id)).toContain(task.id)

    store.requeueTask(task.id)
    expect(store.tasks[0]?.status).toBe('queued')
    expect(store.tasks[0]?.dueAt).toBeUndefined()
    expect(store.getDueTasks(now, 60_000)).toHaveLength(0)
  })

  it('excludes completed tasks from reminders', () => {
    const store = useCharacterNotebookStore()
    const now = Date.now()
    const task = store.scheduleTask({
      title: 'Hoàn thành',
      dueAt: now,
    })

    store.markTaskDone(task.id)
    expect(store.getDueTasks(now, 60_000)).toHaveLength(0)
  })
})
