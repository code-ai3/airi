import type { createContext } from '@moeru/eventa/adapters/electron/main'
import type { BrowserWindow } from 'electron'

import type { ElectronForegroundWindowContext } from '../../../shared/eventa'

import { defineInvokeHandler } from '@moeru/eventa'
import { activeWindow } from 'get-windows'

import { electronGetForegroundWindowContext } from '../../../shared/eventa'

function unavailable(): ElectronForegroundWindowContext {
  return {
    available: false,
    updatedAt: Date.now(),
  }
}

export function createDesktopActivityService(params: {
  context: ReturnType<typeof createContext>['context']
  window: BrowserWindow
}) {
  defineInvokeHandler(params.context, electronGetForegroundWindowContext, async (_, options) => {
    if (params.window.webContents.id !== options?.raw.ipcMainEvent.sender.id)
      return unavailable()

    try {
      const foreground = await activeWindow()
      if (!foreground)
        return unavailable()

      return {
        available: true,
        appName: foreground.owner.name,
        processId: foreground.owner.processId,
        title: foreground.title,
        updatedAt: Date.now(),
        windowId: foreground.id,
      }
    }
    catch (error) {
      console.debug('[DesktopActivity] Foreground window unavailable:', error)
      return unavailable()
    }
  })
}
