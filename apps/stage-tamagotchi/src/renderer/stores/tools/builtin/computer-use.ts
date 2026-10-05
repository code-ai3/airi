import type { Tool } from '@xsai/shared-chat'

import { defineInvoke } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/renderer'
import { rawTool } from '@xsai/tool'

import { computerUseReadImage, computerUseRun } from '../../../../shared/eventa/computer-use'

export const computerUseReadOnlyCommands = new Set([
  'display.capture',
  'display.list',
  'screen.captureRegion',
  'screen.findText',
  'screen.waitForText',
  'window.list',
  'window.findText',
  'window.waitForText',
  'app.probePermissions',
  'mediaControl.nowPlaying',
  'scan.frame',
  'scan.coverage',
])

const computerUsePlannerStateChangingCommands = new Set([
  'screen.clickText',
  'window.clickText',
  'input.focusText',
  'input.axFocusText',
  'input.typeText',
  'input.pasteText',
  'input.key',
  'input.keys',
  'input.keyboard',
  'input.moveMouse',
  'input.clickPoint',
  'app.activate',
  'mediaControl.play',
  'mediaControl.pause',
  'mediaControl.togglePlayPause',
  'mediaControl.next',
  'mediaControl.previous',
])

export const computerUsePlannerCommandCatalog = {
  readOnly: [
    '["invoke","display.capture"]',
    '["invoke","display.list","--json"]',
    '["invoke","screen.findText","Settings","--json"]',
    '["invoke","screen.waitForText","Ready","--json"]',
    '["invoke","window.list","--json"]',
    '["invoke","window.findText","Settings","--title","Preferences","--json"]',
    '["invoke","window.waitForText","Ready","--title","Target window","--json"]',
    '["invoke","mediaControl.nowPlaying","--json"]',
  ],
  stateChanging: [
    '["invoke","screen.clickText","Continue"]',
    '["invoke","input.clickPoint","100","80"]',
    '["invoke","input.typeText","text to type"]',
    '["invoke","input.key","ctrl+s"]',
  ],
} as const

export function computerUseCommandKnownToPlanner(argv: string[]) {
  if (argv[0] !== 'invoke')
    return false

  const command = argv[1] ?? ''
  return computerUseReadOnlyCommands.has(command)
    || computerUsePlannerStateChangingCommands.has(command)
}

export function computerUseRequiresApproval(argv: string[]) {
  if (argv.includes('--help') || argv.includes('-h'))
    return false

  if (argv[0] !== 'invoke')
    return true

  const command = argv[1] ?? ''
  if (computerUseReadOnlyCommands.has(command))
    return false
  if (command.startsWith('scan.') || command.startsWith('ocr.'))
    return false

  return true
}

/** Creates desktop-only tools. IPC clients are local to the elected renderer executor. */
export async function computerUseTools(): Promise<Tool[]> {
  let invokers: ReturnType<typeof createInvokers> | undefined
  function createInvokers() {
    const { context } = createContext(window.electron.ipcRenderer)
    return {
      run: defineInvoke(context, computerUseRun),
      readImage: defineInvoke(context, computerUseReadImage),
    }
  }
  function client() {
    invokers ??= createInvokers()
    return invokers
  }
  return [
    rawTool({
      name: 'computer_use',
      description: 'Inspect the local computer and perform read-only computer-use operations directly. Any state-changing action such as clicking, typing, activating/manipulating windows, media control, or other side effects requires explicit user approval first: create a companion_approval_request containing the exact computer-use argv instead of running it here. Start with argv ["invoke", "--help"] to inspect commands. Use computer_use_read_image for screenshot artifacts.',
      parameters: {
        type: 'object',
        properties: {
          argv: { type: 'array', items: { type: 'string' }, description: 'AUV arguments beginning with invoke, excluding the executable name.' },
        },
        required: ['argv'],
        additionalProperties: false,
      },
      execute: async (input) => {
        const { argv } = input as { argv: string[] }
        if (computerUseRequiresApproval(argv)) {
          throw new Error([
            'This computer-use action changes local state and requires explicit user approval.',
            'Create a companion_approval_request with action.type="computer-use" and the exact argv, then wait for the user to approve it.',
          ].join(' '))
        }

        const result = await client().run({ argv })
        if (result.exitCode !== 0)
          throw new Error(JSON.stringify(result))
        return JSON.stringify(result)
      },
    }),
    rawTool({
      name: 'computer_use_read_image',
      description: 'View a PNG or JPEG screenshot artifact produced by computer_use. Only files inside AIRI computer-use storage can be read. Select this tool together with computer_use for visual tasks.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Absolute screenshot artifact path returned by computer_use.' } },
        required: ['path'],
        additionalProperties: false,
      },
      execute: async input => [{ type: 'image_url', image_url: { url: await client().readImage(input as { path: string }) } }],
    }),
  ]
}
