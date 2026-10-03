import { describe, expect, it } from 'vitest'

import { computerUseRequiresApproval } from './computer-use'

describe('computer-use approval gate', () => {
  it('allows help and read-only capture commands', () => {
    expect(computerUseRequiresApproval(['invoke', '--help'])).toBe(false)
    expect(computerUseRequiresApproval(['invoke', 'display.capture'])).toBe(false)
    expect(computerUseRequiresApproval(['invoke', 'ocr.read'])).toBe(false)
    expect(computerUseRequiresApproval(['invoke', 'scan.windows'])).toBe(false)
  })

  it('requires approval for state-changing actions', () => {
    expect(computerUseRequiresApproval(['invoke', 'input.click', '--x', '100', '--y', '100'])).toBe(true)
    expect(computerUseRequiresApproval(['invoke', 'input.type', '--text', 'hello'])).toBe(true)
    expect(computerUseRequiresApproval(['invoke', 'window.move', '--x', '20', '--y', '20'])).toBe(true)
    expect(computerUseRequiresApproval(['invoke', 'media_control.play'])).toBe(true)
  })

  it('fails closed for unknown command shapes', () => {
    expect(computerUseRequiresApproval([])).toBe(true)
    expect(computerUseRequiresApproval(['something-else'])).toBe(true)
  })
})
