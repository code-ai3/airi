import type {} from 'pinia-plugin-synced'

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { computed } from 'vue'

export type NotebookEntryKind = 'note' | 'diary' | 'focus'

export interface NotebookEntry {
  id: string
  kind: NotebookEntryKind
  text: string
  createdAt: number
  tags?: string[]
  metadata?: Record<string, unknown>
}

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical'
export type TaskStatus = 'queued' | 'scheduled' | 'done' | 'dropped'
export type TaskAutonomy = 'remind' | 'safe-auto'

export type TaskSafeAction
  = | { type: 'open-url', url: string }
    | { type: 'open-path', path: string }

export type CompanionApprovalRisk = 'medium' | 'high' | 'critical'
export type CompanionApprovalStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'failed' | 'expired'

export interface CompanionComputerUseAction {
  type: 'computer-use'
  argv: string[]
}

export interface CompanionApprovalRequest {
  id: string
  title: string
  reason?: string
  risk: CompanionApprovalRisk
  action: CompanionComputerUseAction
  status: CompanionApprovalStatus
  createdAt: number
  updatedAt: number
  resolvedAt?: number
  expiresAt?: number
  executedAt?: number
  result?: string
}

export type CompanionActivityStatus = 'info' | 'success' | 'warning' | 'error'

export interface CompanionActivityLogEntry {
  id: string
  kind: string
  title: string
  details?: string
  status: CompanionActivityStatus
  createdAt: number
  metadata?: Record<string, unknown>
}

export interface ScheduledTask {
  id: string
  title: string
  details?: string
  priority: TaskPriority
  status: TaskStatus
  autonomy: TaskAutonomy
  safeAction?: TaskSafeAction
  dueAt?: number
  createdAt: number
  updatedAt: number
  lastNotifiedAt?: number
  nextNotifyAt?: number
  lastRunAt?: number
  lastRunResult?: string
  metadata?: Record<string, unknown>
}

export const useCharacterNotebookStore = defineStore('character-notebook', () => {
  const persistenceOptions = { listenToStorageChanges: false, deep: true }
  const entries = useLocalStorageManualReset<NotebookEntry[]>(
    'companion/notebook/entries/v1',
    [],
    persistenceOptions,
  )
  const tasks = useLocalStorageManualReset<ScheduledTask[]>(
    'companion/notebook/tasks/v1',
    [],
    persistenceOptions,
  )
  const approvals = useLocalStorageManualReset<CompanionApprovalRequest[]>(
    'companion/notebook/approvals/v1',
    [],
    persistenceOptions,
  )
  const activityLog = useLocalStorageManualReset<CompanionActivityLogEntry[]>(
    'companion/notebook/activity/v1',
    [],
    persistenceOptions,
  )

  const partitionDiary = computed(() => entries.value.filter(entry => entry.kind === 'diary'))
  const partitionFocus = computed(() => entries.value.filter(entry => entry.kind === 'focus'))

  function addEntry(kind: NotebookEntryKind, text: string, options?: { tags?: string[], metadata?: Record<string, unknown> }) {
    const entry: NotebookEntry = {
      id: nanoid(),
      kind,
      text,
      createdAt: Date.now(),
      tags: options?.tags,
      metadata: options?.metadata,
    }

    entries.value.push(entry)
    return entry
  }

  function addNote(text: string, options?: { tags?: string[], metadata?: Record<string, unknown> }) {
    return addEntry('note', text, options)
  }

  function addDiaryEntry(text: string, options?: { tags?: string[], metadata?: Record<string, unknown> }) {
    return addEntry('diary', text, options)
  }

  function addFocusEntry(text: string, options?: { tags?: string[], metadata?: Record<string, unknown> }) {
    return addEntry('focus', text, options)
  }

  function scheduleTask(payload: {
    title: string
    details?: string
    priority?: TaskPriority
    autonomy?: TaskAutonomy
    safeAction?: TaskSafeAction
    dueAt?: number
    metadata?: Record<string, unknown>
  }) {
    const now = Date.now()
    const task: ScheduledTask = {
      id: nanoid(),
      title: payload.title,
      details: payload.details,
      priority: payload.priority ?? 'normal',
      status: payload.dueAt ? 'scheduled' : 'queued',
      autonomy: payload.autonomy ?? 'remind',
      safeAction: payload.safeAction,
      dueAt: payload.dueAt,
      createdAt: now,
      updatedAt: now,
      metadata: payload.metadata,
    }

    tasks.value.push(task)
    return task
  }

  function markTaskDone(taskId: string) {
    const task = tasks.value.find(item => item.id === taskId)
    if (!task)
      return

    task.status = 'done'
    task.updatedAt = Date.now()
  }

  function requeueTask(taskId: string, options?: { dueAt?: number, reason?: string }) {
    const task = tasks.value.find(item => item.id === taskId)
    if (!task)
      return

    task.status = options?.dueAt ? 'scheduled' : 'queued'
    task.dueAt = options?.dueAt
    task.updatedAt = Date.now()
    task.metadata = {
      ...task.metadata,
      requeueReason: options?.reason,
    }
  }

  function markTaskNotified(taskId: string, nextNotifyAt?: number) {
    const task = tasks.value.find(item => item.id === taskId)
    if (!task)
      return

    task.lastNotifiedAt = Date.now()
    task.nextNotifyAt = nextNotifyAt
    task.updatedAt = Date.now()
  }

  function markTaskRun(taskId: string, result: string, completed = false) {
    const task = tasks.value.find(item => item.id === taskId)
    if (!task)
      return

    task.lastRunAt = Date.now()
    task.lastRunResult = result
    task.updatedAt = Date.now()
    if (completed) {
      task.status = 'done'
      task.nextNotifyAt = undefined
    }
  }

  function getDueTasks(now: number, windowMs: number) {
    return tasks.value.filter((task) => {
      if (task.status !== 'scheduled' || typeof task.dueAt !== 'number')
        return false
      const dueAt = task.dueAt
      if (dueAt > now + windowMs)
        return false
      if (typeof task.nextNotifyAt === 'number' && task.nextNotifyAt > now)
        return false
      return true
    })
  }

  function getDueAutonomousTasks(now: number, windowMs: number) {
    return getDueTasks(now, windowMs).filter(task => task.autonomy === 'safe-auto' && task.safeAction)
  }

  function appendActivity(payload: {
    kind: string
    title: string
    details?: string
    status?: CompanionActivityStatus
    metadata?: Record<string, unknown>
  }) {
    const entry: CompanionActivityLogEntry = {
      id: nanoid(),
      kind: payload.kind,
      title: payload.title,
      details: payload.details,
      status: payload.status ?? 'info',
      createdAt: Date.now(),
      metadata: payload.metadata,
    }

    activityLog.value.push(entry)
    if (activityLog.value.length > 300)
      activityLog.value.splice(0, activityLog.value.length - 300)
    return entry
  }

  function requestApproval(payload: {
    title: string
    reason?: string
    risk: CompanionApprovalRisk
    action: CompanionComputerUseAction
  }) {
    const actionKey = JSON.stringify(payload.action)
    const existing = approvals.value.find((approval) => {
      return approval.status === 'pending'
        && approval.title === payload.title
        && approval.risk === payload.risk
        && JSON.stringify(approval.action) === actionKey
    })
    if (existing)
      return existing

    const now = Date.now()
    const approval: CompanionApprovalRequest = {
      id: nanoid(),
      title: payload.title,
      reason: payload.reason,
      risk: payload.risk,
      action: payload.action,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }
    approvals.value.push(approval)
    appendActivity({
      kind: 'approval-requested',
      title: `AIRI xin phép: ${approval.title}`,
      details: approval.reason,
      status: approval.risk === 'critical' ? 'warning' : 'info',
      metadata: {
        approvalId: approval.id,
        risk: approval.risk,
      },
    })
    return approval
  }

  function resolveApproval(approvalId: string, decision: 'approved' | 'rejected') {
    const approval = approvals.value.find(item => item.id === approvalId)
    if (!approval || approval.status !== 'pending')
      return approval

    const now = Date.now()
    approval.status = decision
    approval.resolvedAt = now
    approval.expiresAt = decision === 'approved' ? now + 30 * 60 * 1_000 : undefined
    approval.updatedAt = now
    appendActivity({
      kind: decision === 'approved' ? 'approval-approved' : 'approval-rejected',
      title: decision === 'approved'
        ? `Đã cho phép: ${approval.title}`
        : `Đã từ chối: ${approval.title}`,
      details: approval.reason,
      status: decision === 'approved' ? 'success' : 'warning',
      metadata: {
        approvalId: approval.id,
        risk: approval.risk,
      },
    })
    return approval
  }

  function getNextApprovedApproval(now = Date.now()) {
    for (const approval of approvals.value) {
      if (approval.status !== 'approved' || typeof approval.expiresAt !== 'number' || approval.expiresAt > now)
        continue

      approval.status = 'expired'
      approval.updatedAt = now
      appendActivity({
        kind: 'approval-expired',
        title: `Quyền đã hết hạn: ${approval.title}`,
        details: 'AIRI không thực hiện vì quyền cho phép đã quá 30 phút.',
        status: 'warning',
        metadata: {
          approvalId: approval.id,
          risk: approval.risk,
        },
      })
    }

    return approvals.value
      .filter(approval => approval.status === 'approved')
      .toSorted((a, b) => a.updatedAt - b.updatedAt)[0]
  }

  function markApprovalResult(approvalId: string, payload: { ok: boolean, result: string }) {
    const approval = approvals.value.find(item => item.id === approvalId)
    if (!approval)
      return

    const now = Date.now()
    approval.status = payload.ok ? 'completed' : 'failed'
    approval.executedAt = now
    approval.updatedAt = now
    approval.result = payload.result
    appendActivity({
      kind: payload.ok ? 'action-completed' : 'action-failed',
      title: payload.ok
        ? `AIRI đã làm xong: ${approval.title}`
        : `AIRI không làm được: ${approval.title}`,
      details: payload.result,
      status: payload.ok ? 'success' : 'error',
      metadata: {
        approvalId: approval.id,
        risk: approval.risk,
      },
    })
  }

  function clearActivityLog() {
    activityLog.value.splice(0)
  }

  function clearResolvedApprovals() {
    approvals.value = approvals.value.filter(approval => approval.status === 'pending' || approval.status === 'approved')
  }

  return {
    entries,
    tasks,
    approvals,
    activityLog,
    partitionDiary,
    partitionFocus,
    addNote,
    addDiaryEntry,
    addFocusEntry,
    scheduleTask,
    markTaskDone,
    requeueTask,
    markTaskNotified,
    markTaskRun,
    getDueTasks,
    getDueAutonomousTasks,
    appendActivity,
    requestApproval,
    resolveApproval,
    getNextApprovedApproval,
    markApprovalResult,
    clearActivityLog,
    clearResolvedApprovals,
  }
}, {
  synced: {
    state: true,
  },
})
