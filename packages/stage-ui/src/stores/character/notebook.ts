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
  workflowId?: string
  workflowStepId?: string
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

export type CompanionWorkflowStatus
  = | 'queued'
    | 'running'
    | 'waiting-approval'
    | 'paused'
    | 'completed'
    | 'failed'
    | 'cancelled'

export type CompanionWorkflowStepStatus
  = | 'pending'
    | 'running'
    | 'waiting-approval'
    | 'completed'
    | 'failed'
    | 'skipped'

export type CompanionWorkflowStepAction
  = | { type: 'safe-action', action: TaskSafeAction }
    | { type: 'computer-use', argv: string[] }

export interface CompanionWorkflowStep {
  id: string
  title: string
  details?: string
  action: CompanionWorkflowStepAction
  status: CompanionWorkflowStepStatus
  requiresApproval: boolean
  approvalRisk: CompanionApprovalRisk
  approvalId?: string
  startedAt?: number
  completedAt?: number
  lastResult?: string
}

export interface CompanionWorkflow {
  id: string
  goal: string
  summary?: string
  status: CompanionWorkflowStatus
  steps: CompanionWorkflowStep[]
  currentStepIndex: number
  createdAt: number
  updatedAt: number
  completedAt?: number
  lastError?: string
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
  const workflows = useLocalStorageManualReset<CompanionWorkflow[]>(
    'companion/notebook/workflows/v1',
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

  function createWorkflow(payload: {
    goal: string
    summary?: string
    steps: Array<{
      title: string
      details?: string
      action: CompanionWorkflowStepAction
      requiresApproval: boolean
      approvalRisk?: CompanionApprovalRisk
    }>
    metadata?: Record<string, unknown>
  }) {
    if (!payload.steps.length)
      throw new Error('Workflow requires at least one step.')

    const now = Date.now()
    const workflow: CompanionWorkflow = {
      id: nanoid(),
      goal: payload.goal,
      summary: payload.summary,
      status: 'queued',
      steps: payload.steps.map(step => ({
        id: nanoid(),
        title: step.title,
        details: step.details,
        action: step.action,
        status: 'pending',
        requiresApproval: step.requiresApproval,
        approvalRisk: step.approvalRisk ?? 'high',
      })),
      currentStepIndex: 0,
      createdAt: now,
      updatedAt: now,
      metadata: payload.metadata,
    }

    workflows.value.push(workflow)
    appendActivity({
      kind: 'workflow-created',
      title: `AIRI đã lập kế hoạch: ${workflow.goal}`,
      details: workflow.summary ?? `${workflow.steps.length} bước`,
      status: 'info',
      metadata: {
        workflowId: workflow.id,
        stepCount: workflow.steps.length,
      },
    })
    return workflow
  }

  function getNextRunnableWorkflow() {
    const runningWorkflow = workflows.value
      .filter(workflow => workflow.status === 'running')
      .toSorted((a, b) => a.updatedAt - b.updatedAt)[0]
    if (runningWorkflow)
      return runningWorkflow

    if (workflows.value.some(workflow => workflow.status === 'waiting-approval'))
      return undefined

    return workflows.value
      .filter(workflow => workflow.status === 'queued')
      .toSorted((a, b) => a.createdAt - b.createdAt)[0]
  }

  function getCurrentWorkflowStep(workflowId: string) {
    const workflow = workflows.value.find(item => item.id === workflowId)
    if (!workflow)
      return undefined
    return workflow.steps[workflow.currentStepIndex]
  }

  function startWorkflow(workflowId: string) {
    const workflow = workflows.value.find(item => item.id === workflowId)
    if (!workflow || (workflow.status !== 'queued' && workflow.status !== 'running'))
      return workflow

    if (workflow.status === 'queued') {
      workflow.status = 'running'
      workflow.updatedAt = Date.now()
      appendActivity({
        kind: 'workflow-started',
        title: `AIRI bắt đầu mục tiêu: ${workflow.goal}`,
        details: workflow.summary,
        status: 'info',
        metadata: { workflowId: workflow.id },
      })
    }
    return workflow
  }

  function markWorkflowStepStarted(workflowId: string, stepId: string) {
    const workflow = workflows.value.find(item => item.id === workflowId)
    const step = workflow?.steps.find(item => item.id === stepId)
    if (!workflow || !step)
      return

    const now = Date.now()
    workflow.status = 'running'
    workflow.updatedAt = now
    step.status = 'running'
    step.startedAt ??= now
    appendActivity({
      kind: 'workflow-step-started',
      title: `Bước ${workflow.currentStepIndex + 1}: ${step.title}`,
      details: step.details,
      status: 'info',
      metadata: {
        workflowId: workflow.id,
        workflowStepId: step.id,
      },
    })
  }

  function markWorkflowStepWaitingApproval(workflowId: string, stepId: string, approvalId: string) {
    const workflow = workflows.value.find(item => item.id === workflowId)
    const step = workflow?.steps.find(item => item.id === stepId)
    if (!workflow || !step)
      return

    step.status = 'waiting-approval'
    step.approvalId = approvalId
    workflow.status = 'waiting-approval'
    workflow.updatedAt = Date.now()
  }

  function markWorkflowStepResult(workflowId: string, stepId: string, payload: { ok: boolean, result: string }) {
    const workflow = workflows.value.find(item => item.id === workflowId)
    const step = workflow?.steps.find(item => item.id === stepId)
    if (!workflow || !step)
      return

    const now = Date.now()
    step.lastResult = payload.result
    step.completedAt = now
    workflow.updatedAt = now

    if (!payload.ok) {
      step.status = 'failed'
      workflow.status = 'paused'
      workflow.lastError = payload.result
      appendActivity({
        kind: 'workflow-step-failed',
        title: `Bước bị dừng: ${step.title}`,
        details: payload.result,
        status: 'error',
        metadata: {
          workflowId: workflow.id,
          workflowStepId: step.id,
        },
      })
      return
    }

    step.status = 'completed'
    step.approvalId = undefined
    workflow.currentStepIndex += 1
    workflow.lastError = undefined

    if (workflow.currentStepIndex >= workflow.steps.length) {
      workflow.status = 'completed'
      workflow.completedAt = now
      appendActivity({
        kind: 'workflow-completed',
        title: `AIRI đã hoàn thành mục tiêu: ${workflow.goal}`,
        details: payload.result,
        status: 'success',
        metadata: { workflowId: workflow.id },
      })
      return
    }

    workflow.status = 'running'
    appendActivity({
      kind: 'workflow-step-completed',
      title: `Đã xong bước: ${step.title}`,
      details: payload.result,
      status: 'success',
      metadata: {
        workflowId: workflow.id,
        workflowStepId: step.id,
        nextStepIndex: workflow.currentStepIndex,
      },
    })
  }

  function resumeWorkflow(workflowId: string) {
    const workflow = workflows.value.find(item => item.id === workflowId)
    if (!workflow || (workflow.status !== 'paused' && workflow.status !== 'failed'))
      return workflow

    const step = workflow.steps[workflow.currentStepIndex]
    if (step && step.status === 'failed') {
      step.status = 'pending'
      step.approvalId = undefined
      step.startedAt = undefined
      step.completedAt = undefined
      step.lastResult = undefined
    }

    workflow.status = 'running'
    workflow.lastError = undefined
    workflow.updatedAt = Date.now()
    appendActivity({
      kind: 'workflow-resumed',
      title: `Tiếp tục mục tiêu: ${workflow.goal}`,
      status: 'info',
      metadata: { workflowId: workflow.id },
    })
    return workflow
  }

  function cancelWorkflow(workflowId: string) {
    const workflow = workflows.value.find(item => item.id === workflowId)
    if (!workflow || ['completed', 'cancelled'].includes(workflow.status))
      return workflow

    const now = Date.now()
    workflow.status = 'cancelled'
    workflow.updatedAt = now
    for (const step of workflow.steps) {
      if (step.status === 'pending' || step.status === 'running' || step.status === 'waiting-approval')
        step.status = 'skipped'
    }

    for (const approval of approvals.value) {
      if (approval.workflowId !== workflow.id || (approval.status !== 'pending' && approval.status !== 'approved'))
        continue
      approval.status = 'rejected'
      approval.resolvedAt = now
      approval.updatedAt = now
      approval.result = 'Workflow cancelled before execution.'
    }

    appendActivity({
      kind: 'workflow-cancelled',
      title: `Đã hủy mục tiêu: ${workflow.goal}`,
      status: 'warning',
      metadata: { workflowId: workflow.id },
    })
    return workflow
  }

  function requestApproval(payload: {
    title: string
    reason?: string
    risk: CompanionApprovalRisk
    action: CompanionComputerUseAction
    workflowId?: string
    workflowStepId?: string
  }) {
    const actionKey = JSON.stringify(payload.action)
    const existing = approvals.value.find((approval) => {
      return approval.status === 'pending'
        && approval.title === payload.title
        && approval.risk === payload.risk
        && approval.workflowId === payload.workflowId
        && approval.workflowStepId === payload.workflowStepId
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
      workflowId: payload.workflowId,
      workflowStepId: payload.workflowStepId,
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
        workflowId: approval.workflowId,
        workflowStepId: approval.workflowStepId,
      },
    })

    if (decision === 'rejected' && approval.workflowId && approval.workflowStepId) {
      markWorkflowStepResult(approval.workflowId, approval.workflowStepId, {
        ok: false,
        result: 'Anh đã từ chối bước này. Workflow được tạm dừng.',
      })
    }

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
          workflowId: approval.workflowId,
          workflowStepId: approval.workflowStepId,
        },
      })

      if (approval.workflowId && approval.workflowStepId) {
        markWorkflowStepResult(approval.workflowId, approval.workflowStepId, {
          ok: false,
          result: 'Quyền cho bước này đã hết hạn sau 30 phút. Workflow được tạm dừng.',
        })
      }
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
        workflowId: approval.workflowId,
        workflowStepId: approval.workflowStepId,
      },
    })

    if (approval.workflowId && approval.workflowStepId) {
      markWorkflowStepResult(approval.workflowId, approval.workflowStepId, {
        ok: payload.ok,
        result: payload.result,
      })
    }
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
    workflows,
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
    createWorkflow,
    getNextRunnableWorkflow,
    getCurrentWorkflowStep,
    startWorkflow,
    markWorkflowStepStarted,
    markWorkflowStepWaitingApproval,
    markWorkflowStepResult,
    resumeWorkflow,
    cancelWorkflow,
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
