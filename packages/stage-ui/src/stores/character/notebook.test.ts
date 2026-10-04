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

  it('returns only approved safe-auto tasks for autonomous execution', () => {
    const store = useCharacterNotebookStore()
    const now = Date.now()

    const autonomous = store.scheduleTask({
      title: 'Mở tài liệu',
      dueAt: now,
      autonomy: 'safe-auto',
      safeAction: {
        type: 'open-url',
        url: 'https://example.com',
      },
    })
    store.scheduleTask({
      title: 'Chỉ nhắc',
      dueAt: now,
      autonomy: 'remind',
    })

    expect(store.getDueAutonomousTasks(now, 60_000).map(task => task.id)).toEqual([autonomous.id])

    store.markTaskRun(autonomous.id, 'Opened URL', true)
    expect(autonomous.status).toBe('done')
    expect(autonomous.lastRunResult).toBe('Opened URL')
    expect(store.getDueAutonomousTasks(now, 60_000)).toHaveLength(0)
  })

  it('requires an explicit decision before an approval can execute', () => {
    const store = useCharacterNotebookStore()
    const approval = store.requestApproval({
      title: 'Bấm nút gửi',
      reason: 'Gửi nội dung đã soạn',
      risk: 'high',
      action: {
        type: 'computer-use',
        argv: ['invoke', 'input.click', '--x', '120', '--y', '240'],
      },
    })

    expect(approval.status).toBe('pending')
    expect(store.getNextApprovedApproval()).toBeUndefined()

    store.resolveApproval(approval.id, 'approved')
    expect(approval.status).toBe('approved')
    expect(store.getNextApprovedApproval()?.id).toBe(approval.id)

    store.markApprovalResult(approval.id, { ok: true, result: 'clicked' })
    expect(approval.status).toBe('completed')
    expect(approval.result).toBe('clicked')
    expect(store.getNextApprovedApproval()).toBeUndefined()
  })

  it('expires an unused approval after thirty minutes', () => {
    const store = useCharacterNotebookStore()
    const approval = store.requestApproval({
      title: 'Thao tác cũ',
      risk: 'high',
      action: {
        type: 'computer-use',
        argv: ['invoke', 'input.click', '--x', '10', '--y', '10'],
      },
    })

    store.resolveApproval(approval.id, 'approved')
    expect(approval.expiresAt).toBeTypeOf('number')

    const afterExpiry = (approval.expiresAt ?? 0) + 1
    expect(store.getNextApprovedApproval(afterExpiry)).toBeUndefined()
    expect(approval.status).toBe('expired')
    expect(store.activityLog.some(item => item.kind === 'approval-expired')).toBe(true)
  })

  it('deduplicates identical pending approvals and records activity', () => {
    const store = useCharacterNotebookStore()
    const payload = {
      title: 'Gõ văn bản',
      reason: 'Điền biểu mẫu',
      risk: 'high' as const,
      action: {
        type: 'computer-use' as const,
        argv: ['invoke', 'input.type', '--text', 'hello'],
      },
    }

    const first = store.requestApproval(payload)
    const second = store.requestApproval(payload)

    expect(second.id).toBe(first.id)
    expect(store.approvals).toHaveLength(1)
    expect(store.activityLog.filter(item => item.kind === 'approval-requested')).toHaveLength(1)

    store.resolveApproval(first.id, 'rejected')
    expect(first.status).toBe('rejected')
    expect(store.activityLog.some(item => item.kind === 'approval-rejected')).toBe(true)
  })

  it('runs a multi-step workflow in order and completes after the final step', () => {
    const store = useCharacterNotebookStore()
    const workflow = store.createWorkflow({
      goal: 'Mở tài liệu rồi kiểm tra màn hình',
      steps: [
        {
          title: 'Mở tài liệu',
          action: {
            type: 'safe-action',
            action: { type: 'open-url', url: 'https://example.com' },
          },
          requiresApproval: false,
          approvalRisk: 'medium',
        },
        {
          title: 'Chụp màn hình để kiểm tra',
          action: {
            type: 'computer-use',
            argv: ['invoke', 'display.capture'],
          },
          requiresApproval: false,
          approvalRisk: 'medium',
        },
      ],
    })

    expect(workflow.status).toBe('queued')
    expect(store.getNextRunnableWorkflow()?.id).toBe(workflow.id)

    store.startWorkflow(workflow.id)
    const firstStep = store.getCurrentWorkflowStep(workflow.id)!
    store.markWorkflowStepStarted(workflow.id, firstStep.id)
    store.markWorkflowStepResult(workflow.id, firstStep.id, { ok: true, result: 'opened' })

    expect(workflow.status).toBe('running')
    expect(workflow.currentStepIndex).toBe(1)
    expect(workflow.steps[0]?.status).toBe('completed')

    const secondStep = store.getCurrentWorkflowStep(workflow.id)!
    store.markWorkflowStepStarted(workflow.id, secondStep.id)
    store.markWorkflowStepResult(workflow.id, secondStep.id, { ok: true, result: 'captured' })

    expect(workflow.status).toBe('completed')
    expect(workflow.currentStepIndex).toBe(2)
    expect(workflow.completedAt).toBeTypeOf('number')
  })

  it('pauses a workflow at an approval step and continues only after approval succeeds', () => {
    const store = useCharacterNotebookStore()
    const workflow = store.createWorkflow({
      goal: 'Điền biểu mẫu',
      steps: [
        {
          title: 'Bấm vào ô nhập',
          action: {
            type: 'computer-use',
            argv: ['invoke', 'input.click', '--x', '100', '--y', '200'],
          },
          requiresApproval: true,
          approvalRisk: 'high',
        },
        {
          title: 'Kiểm tra màn hình',
          action: {
            type: 'computer-use',
            argv: ['invoke', 'display.capture'],
          },
          requiresApproval: false,
          approvalRisk: 'medium',
        },
      ],
    })

    store.startWorkflow(workflow.id)
    const step = store.getCurrentWorkflowStep(workflow.id)!
    const approval = store.requestApproval({
      title: step.title,
      risk: step.approvalRisk,
      action: {
        type: 'computer-use',
        argv: ['invoke', 'input.click', '--x', '100', '--y', '200'],
      },
      workflowId: workflow.id,
      workflowStepId: step.id,
    })
    store.markWorkflowStepWaitingApproval(workflow.id, step.id, approval.id)

    expect(workflow.status).toBe('waiting-approval')
    expect(store.getNextRunnableWorkflow()).toBeUndefined()

    store.resolveApproval(approval.id, 'approved')
    expect(workflow.status).toBe('waiting-approval')

    store.markApprovalResult(approval.id, { ok: true, result: 'clicked' })
    expect(workflow.status).toBe('running')
    expect(workflow.currentStepIndex).toBe(1)
    expect(workflow.steps[0]?.status).toBe('completed')
  })

  it('cancels a workflow and invalidates its unused approvals', () => {
    const store = useCharacterNotebookStore()
    const workflow = store.createWorkflow({
      goal: 'Thao tác thử',
      steps: [{
        title: 'Bấm nút',
        action: {
          type: 'computer-use',
          argv: ['invoke', 'input.click', '--x', '1', '--y', '1'],
        },
        requiresApproval: true,
        approvalRisk: 'high',
      }],
    })

    store.startWorkflow(workflow.id)
    const step = store.getCurrentWorkflowStep(workflow.id)!
    const approval = store.requestApproval({
      title: step.title,
      risk: 'high',
      action: {
        type: 'computer-use',
        argv: ['invoke', 'input.click', '--x', '1', '--y', '1'],
      },
      workflowId: workflow.id,
      workflowStepId: step.id,
    })
    store.markWorkflowStepWaitingApproval(workflow.id, step.id, approval.id)
    store.resolveApproval(approval.id, 'approved')

    store.cancelWorkflow(workflow.id)

    expect(workflow.status).toBe('cancelled')
    expect(approval.status).toBe('rejected')
    expect(store.getNextApprovedApproval()).toBeUndefined()
  })

  it('revises the remaining workflow while preserving old steps as history', () => {
    const store = useCharacterNotebookStore()
    const workflow = store.createWorkflow({
      goal: 'Tìm đúng nút rồi tiếp tục',
      steps: [
        {
          title: 'Quan sát',
          action: {
            type: 'computer-use',
            argv: ['invoke', 'display.capture'],
          },
          requiresApproval: false,
          approvalRisk: 'medium',
        },
        {
          title: 'Bấm nút cũ',
          action: {
            type: 'computer-use',
            argv: ['invoke', 'input.click', '--x', '10', '--y', '20'],
          },
          requiresApproval: true,
          approvalRisk: 'high',
        },
      ],
    })

    store.startWorkflow(workflow.id)
    const first = store.getCurrentWorkflowStep(workflow.id)!
    store.markWorkflowStepStarted(workflow.id, first.id)
    store.markWorkflowStepResult(workflow.id, first.id, { ok: true, result: 'layout changed' })

    store.reviseWorkflowPlan(workflow.id, {
      reason: 'Màn hình đã đổi nên vị trí nút cũ không còn đúng.',
      steps: [
        {
          title: 'Quét lại cửa sổ',
          action: {
            type: 'computer-use',
            argv: ['invoke', 'scan.windows'],
          },
          requiresApproval: false,
          approvalRisk: 'medium',
        },
        {
          title: 'Bấm nút mới',
          action: {
            type: 'computer-use',
            argv: ['invoke', 'input.click', '--x', '40', '--y', '50'],
          },
          requiresApproval: true,
          approvalRisk: 'high',
        },
      ],
    })

    expect(workflow.revisionCount).toBe(1)
    expect(workflow.lastEvaluation).toContain('Màn hình đã đổi')
    expect(workflow.steps[1]?.status).toBe('skipped')
    expect(workflow.steps[2]?.title).toBe('Quét lại cửa sổ')
    expect(workflow.currentStepIndex).toBe(2)
    expect(workflow.status).toBe('running')
  })

  it('can reopen a completed plan when evaluation discovers more work', () => {
    const store = useCharacterNotebookStore()
    const workflow = store.createWorkflow({
      goal: 'Mở trang và kiểm tra',
      steps: [{
        title: 'Mở trang',
        action: {
          type: 'safe-action',
          action: { type: 'open-url', url: 'https://example.com' },
        },
        requiresApproval: false,
        approvalRisk: 'medium',
      }],
    })

    store.startWorkflow(workflow.id)
    const step = store.getCurrentWorkflowStep(workflow.id)!
    store.markWorkflowStepStarted(workflow.id, step.id)
    store.markWorkflowStepResult(workflow.id, step.id, { ok: true, result: 'opened' })
    expect(workflow.status).toBe('completed')

    store.reviseWorkflowPlan(workflow.id, {
      reason: 'Trang mở nhưng cần thêm bước xác minh.',
      steps: [{
        title: 'Chụp màn hình xác minh',
        action: {
          type: 'computer-use',
          argv: ['invoke', 'display.capture'],
        },
        requiresApproval: false,
        approvalRisk: 'medium',
      }],
    })

    expect(workflow.status).toBe('running')
    expect(workflow.completedAt).toBeUndefined()
    expect(workflow.currentStepIndex).toBe(1)
    expect(store.getCurrentWorkflowStep(workflow.id)?.title).toBe('Chụp màn hình xác minh')
  })

  it('rolls a recurring reminder forward after completion', () => {
    const store = useCharacterNotebookStore()
    const beforeComplete = Date.now()
    const task = store.scheduleTask({
      title: 'Uống nước',
      dueAt: beforeComplete - 1_000,
      recurrence: {
        type: 'interval',
        everyMinutes: 30,
      },
    })

    store.markTaskDone(task.id)

    expect(task.status).toBe('scheduled')
    expect(task.occurrencesCompleted).toBe(1)
    expect(task.dueAt).toBeGreaterThanOrEqual(beforeComplete + 30 * 60_000)
    expect(task.dueAt).toBeLessThanOrEqual(Date.now() + 30 * 60_000)
    expect(store.activityLog.some(item => item.kind === 'task-recurrence-advanced')).toBe(true)
  })

  it('rolls a recurring safe-auto task forward after a successful run', () => {
    const store = useCharacterNotebookStore()
    const task = store.scheduleTask({
      title: 'Mở trang học',
      dueAt: Date.now(),
      autonomy: 'safe-auto',
      safeAction: {
        type: 'open-url',
        url: 'https://example.com',
      },
      recurrence: {
        type: 'interval',
        everyMinutes: 60,
      },
    })

    store.markTaskRun(task.id, 'Opened URL', true)

    expect(task.status).toBe('scheduled')
    expect(task.occurrencesCompleted).toBe(1)
    expect(task.lastRunResult).toBe('Opened URL')
    expect(task.dueAt).toBeGreaterThan(Date.now())
  })

  it('can disable recurrence without deleting the task', () => {
    const store = useCharacterNotebookStore()
    const task = store.scheduleTask({
      title: 'Nhắc mỗi ngày',
      recurrence: {
        type: 'daily',
        hour: 8,
        minute: 15,
      },
    })

    expect(task.status).toBe('scheduled')
    expect(task.recurrence?.type).toBe('daily')

    store.requeueTask(task.id, { recurrence: null })

    expect(task.status).toBe('queued')
    expect(task.recurrence).toBeUndefined()
    expect(task.dueAt).toBeUndefined()
  })

  it('schedules a recurring workflow and makes it runnable when due', () => {
    const store = useCharacterNotebookStore()
    const workflow = store.createWorkflow({
      goal: 'Kiểm tra desktop mỗi giờ',
      steps: [{
        title: 'Chụp màn hình',
        action: {
          type: 'computer-use',
          argv: ['invoke', 'display.capture'],
        },
        requiresApproval: false,
        approvalRisk: 'medium',
      }],
      recurrence: {
        type: 'interval',
        everyMinutes: 60,
      },
    })

    expect(workflow.status).toBe('scheduled')
    expect(workflow.nextRunAt).toBeTypeOf('number')
    expect(store.getNextRunnableWorkflow((workflow.nextRunAt ?? 0) - 1)).toBeUndefined()
    expect(store.getNextRunnableWorkflow(workflow.nextRunAt)?.id).toBe(workflow.id)
  })

  it('rolls a completed recurring workflow to its next run', () => {
    const store = useCharacterNotebookStore()
    const workflow = store.createWorkflow({
      goal: 'Theo dõi định kỳ',
      runNow: true,
      recurrence: {
        type: 'interval',
        everyMinutes: 30,
      },
      steps: [{
        title: 'Quan sát',
        action: {
          type: 'computer-use',
          argv: ['invoke', 'display.capture'],
        },
        requiresApproval: false,
        approvalRisk: 'medium',
      }],
    })

    expect(workflow.status).toBe('queued')
    store.startWorkflow(workflow.id)
    const step = store.getCurrentWorkflowStep(workflow.id)!
    store.markWorkflowStepStarted(workflow.id, step.id)
    store.markWorkflowStepResult(workflow.id, step.id, { ok: true, result: 'captured' })
    expect(workflow.status).toBe('completed')

    store.scheduleNextWorkflowRun(workflow.id)

    expect(workflow.status).toBe('scheduled')
    expect(workflow.runsCompleted).toBe(1)
    expect(workflow.currentStepIndex).toBe(0)
    expect(workflow.steps[0]?.status).toBe('pending')
    expect(workflow.nextRunAt).toBeGreaterThan(Date.now())
    expect(workflow.revisionCount).toBe(0)
    expect(store.activityLog.some(item => item.kind === 'workflow-recurrence-advanced')).toBe(true)
  })
})
