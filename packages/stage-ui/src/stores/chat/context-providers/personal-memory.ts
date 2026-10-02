import type { ContextMessage } from '../../../types/chat'

import { ContextUpdateStrategy } from '@proj-airi/server-sdk'
import { nanoid } from 'nanoid'

const PERSONAL_MEMORY_CONTEXT_ID = 'system:airi-personal-memory'

export function createPersonalMemoryContext(memoryText: string): ContextMessage | undefined {
  if (!memoryText.trim())
    return undefined

  return {
    id: nanoid(),
    contextId: PERSONAL_MEMORY_CONTEXT_ID,
    strategy: ContextUpdateStrategy.ReplaceSelf,
    metadata: {
      source: { id: PERSONAL_MEMORY_CONTEXT_ID },
    },
    text: memoryText,
    createdAt: Date.now(),
  }
}
