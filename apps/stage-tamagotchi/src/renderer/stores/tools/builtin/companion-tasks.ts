import type { ScheduledTask } from '@proj-airi/stage-ui/stores/character'
import type { Tool } from '@xsai/shared-chat'

import { useCharacterNotebookStore } from '@proj-airi/stage-ui/stores/character'
import { tool } from '@xsai/tool'
import { z } from 'zod'

const taskPrioritySchema = z.enum(['low', 'normal', 'high', 'critical'])

const createTaskParams = z.object({
  title: z.string().min(1).max(160).describe('Short task title.'),
  details: z.string().max(1000).optional().describe('Optional task details or next action.'),
  priority: taskPrioritySchema.optional().default('normal'),
  dueAt: z.string().optional().describe('Optional ISO 8601 date/time. Omit if the task has no scheduled reminder yet.'),
})

const listTasksParams = z.object({
  status: z.enum(['open', 'scheduled', 'queued', 'done', 'all']).optional().default('open'),
})

const completeTaskParams = z.object({
  taskId: z.string().min(1).describe('Task id returned by companion_task_list or companion_task_create.'),
})

const rescheduleTaskParams = z.object({
  taskId: z.string().min(1),
  dueAt: z.string().optional().describe('New ISO 8601 date/time. Omit to put the task back in the unscheduled queue.'),
  reason: z.string().max(500).optional(),
})

function parseDueAt(value?: string) {
  if (!value?.trim())
    return undefined

  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp))
    throw new Error('dueAt must be a valid ISO 8601 date/time.')
  return timestamp
}

function serializeTask(task: ScheduledTask) {
  return {
    id: task.id,
    title: task.title,
    details: task.details,
    priority: task.priority,
    status: task.status,
    dueAt: typeof task.dueAt === 'number' ? new Date(task.dueAt).toISOString() : undefined,
    createdAt: new Date(task.createdAt).toISOString(),
    updatedAt: new Date(task.updatedAt).toISOString(),
  }
}

export async function executeCreateCompanionTask(input: z.infer<typeof createTaskParams>) {
  const notebook = useCharacterNotebookStore()
  const task = notebook.scheduleTask({
    title: input.title.trim(),
    details: input.details?.trim() || undefined,
    priority: input.priority,
    dueAt: parseDueAt(input.dueAt),
    metadata: {
      createdBy: 'airi-chat-tool',
    },
  })

  return JSON.stringify({
    ok: true,
    task: serializeTask(task),
  })
}

export async function executeListCompanionTasks(input: z.infer<typeof listTasksParams>) {
  const notebook = useCharacterNotebookStore()
  const tasks = notebook.tasks.filter((task) => {
    switch (input.status) {
      case 'all':
        return true
      case 'done':
        return task.status === 'done'
      case 'scheduled':
        return task.status === 'scheduled'
      case 'queued':
        return task.status === 'queued'
      case 'open':
      default:
        return task.status !== 'done' && task.status !== 'dropped'
    }
  })

  return JSON.stringify({
    count: tasks.length,
    tasks: tasks
      .toSorted((a, b) => (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER))
      .map(serializeTask),
  })
}

export async function executeCompleteCompanionTask(input: z.infer<typeof completeTaskParams>) {
  const notebook = useCharacterNotebookStore()
  const task = notebook.tasks.find(item => item.id === input.taskId)
  if (!task)
    throw new Error('Task not found.')

  notebook.markTaskDone(input.taskId)
  const updated = notebook.tasks.find(item => item.id === input.taskId)!
  return JSON.stringify({
    ok: true,
    task: serializeTask(updated),
  })
}

export async function executeRescheduleCompanionTask(input: z.infer<typeof rescheduleTaskParams>) {
  const notebook = useCharacterNotebookStore()
  if (!notebook.tasks.some(item => item.id === input.taskId))
    throw new Error('Task not found.')

  notebook.requeueTask(input.taskId, {
    dueAt: parseDueAt(input.dueAt),
    reason: input.reason?.trim() || undefined,
  })

  const updated = notebook.tasks.find(item => item.id === input.taskId)!
  return JSON.stringify({
    ok: true,
    task: serializeTask(updated),
  })
}

const tools: Promise<Tool>[] = [
  tool({
    name: 'companion_task_create',
    description: 'Create a persistent personal task for the user. A dueAt schedules a proactive reminder; without dueAt the task stays queued without reminder spam.',
    execute: executeCreateCompanionTask,
    parameters: createTaskParams,
  }),
  tool({
    name: 'companion_task_list',
    description: 'List persistent personal tasks and their ids/status/due times.',
    execute: executeListCompanionTasks,
    parameters: listTasksParams,
  }),
  tool({
    name: 'companion_task_complete',
    description: 'Mark a persistent personal task as done.',
    execute: executeCompleteCompanionTask,
    parameters: completeTaskParams,
  }),
  tool({
    name: 'companion_task_reschedule',
    description: 'Reschedule a task. Omit dueAt to return it to the unscheduled queue.',
    execute: executeRescheduleCompanionTask,
    parameters: rescheduleTaskParams,
  }),
]

export const companionTaskTools = async () => Promise.all(tools)
