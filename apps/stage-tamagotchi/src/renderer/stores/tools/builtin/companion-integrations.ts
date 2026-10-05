import type { Tool } from '@xsai/shared-chat'

import { tool } from '@xsai/tool'
import { z } from 'zod'

import { executeCreateCompanionWorkflow } from './companion-workflows'

const recurrenceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('interval'),
    everyMinutes: z.number().int().min(5).max(525_600),
  }),
  z.object({
    type: z.literal('daily'),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
  z.object({
    type: z.literal('weekly'),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }),
])

const startEmployeeSessionParams = z.object({
  target: z.enum(['gmail', 'google-calendar', 'github', 'browser', 'vscode']),
  objective: z.string().min(1).max(600).describe('What the user explicitly asked AIRI to accomplish in this service/workspace.'),
  url: z.string().url().max(2048).optional().describe('Required for target=browser. Optional GitHub URL for target=github.'),
  workspacePath: z.string().min(1).max(1024).optional().describe('Required for target=vscode. Absolute local workspace/file path.'),
  recurrence: recurrenceSchema.optional().describe('Optional recurring schedule in the PC local timezone.'),
  runNow: z.boolean().optional().default(true).describe('Run the first cycle now. Set false to wait for the recurring schedule.'),
})
function resolveTarget(input: z.input<typeof startEmployeeSessionParams>) {
  if (input.target === 'gmail') {
    return {
      name: 'Gmail',
      action: {
        type: 'safe-action' as const,
        action: {
          type: 'open-url' as const,
          url: 'https://mail.google.com/',
        },
      },
    }
  }

  if (input.target === 'google-calendar') {
    return {
      name: 'Google Calendar',
      action: {
        type: 'safe-action' as const,
        action: {
          type: 'open-url' as const,
          url: 'https://calendar.google.com/',
        },
      },
    }
  }

  if (input.target === 'github') {
    const url = input.url ?? 'https://github.com/'
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || !['github.com', 'www.github.com'].includes(parsed.hostname))
      throw new Error('GitHub employee sessions only accept HTTPS github.com URLs.')

    return {
      name: 'GitHub',
      action: {
        type: 'safe-action' as const,
        action: {
          type: 'open-url' as const,
          url: parsed.toString(),
        },
      },
    }
  }

  if (input.target === 'browser') {
    if (!input.url)
      throw new Error('target=browser requires url.')

    const parsed = new URL(input.url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      throw new Error('Browser employee sessions only accept HTTP/HTTPS URLs.')

    return {
      name: 'Browser',
      action: {
        type: 'safe-action' as const,
        action: {
          type: 'open-url' as const,
          url: parsed.toString(),
        },
      },
    }
  }

  if (!input.workspacePath?.trim())
    throw new Error('target=vscode requires workspacePath.')

  return {
    name: 'VS Code',
    action: {
      type: 'safe-action' as const,
      action: {
        type: 'open-vscode-workspace' as const,
        path: input.workspacePath.trim(),
      },
    },
  }
}
export async function executeStartEmployeeSession(input: z.input<typeof startEmployeeSessionParams>) {
  const target = resolveTarget(input)
  const objective = input.objective.trim()

  const result = JSON.parse(await executeCreateCompanionWorkflow({
    goal: `[${target.name}] ${objective}`,
    summary: [
      `AIRI is working in ${target.name} using the user's existing signed-in desktop session.`,
      'After opening the target, inspect the visible result and adapt the next steps from evidence on screen.',
      'If sign-in, password, OTP, payment, recovery code, API key, or another secret is required, pause and ask the user to handle it manually.',
      'Any state-changing desktop interaction must continue through the existing approval gate.',
    ].join(' '),
    recurrence: input.recurrence,
    runNow: input.runNow ?? true,
    steps: [{
      title: `Mở ${target.name}`,
      details: `Bắt đầu mục tiêu: ${objective}`,
      action: target.action,
    }],
  }))

  return JSON.stringify({
    ...result,
    target: input.target,
    targetName: target.name,
  })
}

const tools: Promise<Tool>[] = [
  tool({
    name: 'companion_employee_start',
    description: [
      'Start a persistent AI-employee workflow in Gmail, Google Calendar, GitHub, an arbitrary browser page, or a local VS Code workspace.',
      'The first step only opens the requested service/workspace safely. AIRI then observes the result and its adaptive workflow engine decides the next step.',
      'State-changing desktop interactions remain blocked behind the explicit approval gate.',
      'Use the recurrence field for daily/weekly/interval employee routines.',
      'Never ask AIRI to store or type passwords, OTPs, recovery codes, API keys, payment credentials, or other secrets.',
    ].join(' '),
    execute: executeStartEmployeeSession,
    parameters: startEmployeeSessionParams,
  }),
]

export const companionIntegrationTools = async () => Promise.all(tools)
