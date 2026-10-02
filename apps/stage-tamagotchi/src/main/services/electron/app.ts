import type { createContext } from '@moeru/eventa/adapters/electron/main'
import type { BrowserWindow } from 'electron'

import { env } from 'node:process'

import { defineInvokeHandler } from '@moeru/eventa'
import { app, shell } from 'electron'
import { isLinux, isMacOS, isWindows } from 'std-env'

import {
  electron,
  electronAppGetLaunchAtLogin,
  electronAppIsWayland,
  electronAppOpenUserDataFolder,
  electronAppQuit,
  electronAppSetLaunchAtLogin,
} from '../../../shared/eventa'
import { resolveIsWayland } from '../../app/ozone'

export function createAppService(params: { context: ReturnType<typeof createContext>['context'], window: BrowserWindow }) {
  defineInvokeHandler(params.context, electron.app.isMacOS, () => isMacOS)
  defineInvokeHandler(params.context, electron.app.isWindows, () => isWindows)
  defineInvokeHandler(params.context, electron.app.isLinux, () => isLinux)
  defineInvokeHandler(params.context, electronAppIsWayland, () => resolveIsWayland({
    explicitOzonePlatform: app.commandLine.getSwitchValue('ozone-platform'),
    ozonePlatformHint: app.commandLine.getSwitchValue('ozone-platform-hint'),
    env,
  }))
  defineInvokeHandler(params.context, electronAppOpenUserDataFolder, async () => {
    const path = app.getPath('userData')
    const openResult = await shell.openPath(path)
    if (openResult) {
      throw new Error(openResult)
    }
    return { path }
  })
  defineInvokeHandler(params.context, electronAppQuit, () => app.quit())

  function getLaunchAtLoginState() {
    const supported = isWindows && app.isPackaged
    return {
      enabled: supported ? app.getLoginItemSettings().openAtLogin : false,
      supported,
    }
  }

  defineInvokeHandler(params.context, electronAppGetLaunchAtLogin, () => getLaunchAtLoginState())
  defineInvokeHandler(params.context, electronAppSetLaunchAtLogin, (enabled) => {
    const state = getLaunchAtLoginState()
    if (!state.supported)
      return state

    app.setLoginItemSettings({ openAtLogin: Boolean(enabled) })
    return getLaunchAtLoginState()
  })
}
