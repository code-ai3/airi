import type { createContext } from '@moeru/eventa/adapters/electron/main'
import type { BrowserWindow } from 'electron'

import type { ElectronForegroundWindowContext } from '../../../shared/eventa'

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { defineInvokeHandler } from '@moeru/eventa'

import { electronGetForegroundWindowContext } from '../../../shared/eventa'

const execFileAsync = promisify(execFile)

const WINDOWS_FOREGROUND_SCRIPT = "$signature = @'\nusing System;\nusing System.Text;\nusing System.Runtime.InteropServices;\npublic static class AiriForegroundWindow {\n  [DllImport(\"user32.dll\")]\n  public static extern IntPtr GetForegroundWindow();\n  [DllImport(\"user32.dll\", SetLastError=true)]\n  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);\n  [DllImport(\"user32.dll\", CharSet=CharSet.Unicode, SetLastError=true)]\n  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);\n}\n'@\nAdd-Type -TypeDefinition $signature -ErrorAction SilentlyContinue | Out-Null\n$handle = [AiriForegroundWindow]::GetForegroundWindow()\nif ($handle -eq [IntPtr]::Zero) { return }\n$pidValue = [uint32]0\n[AiriForegroundWindow]::GetWindowThreadProcessId($handle, [ref]$pidValue) | Out-Null\n$titleBuffer = New-Object System.Text.StringBuilder 2048\n[AiriForegroundWindow]::GetWindowText($handle, $titleBuffer, $titleBuffer.Capacity) | Out-Null\n$process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue\n[pscustomobject]@{\n  appName = if ($process) { $process.ProcessName } else { $null }\n  processId = [int]$pidValue\n  title = $titleBuffer.ToString()\n  windowId = $handle.ToInt64()\n} | ConvertTo-Json -Compress"

function unavailable(): ElectronForegroundWindowContext {
  return {
    available: false,
    updatedAt: Date.now(),
  }
}

interface WindowsForegroundWindowResult {
  appName?: string
  processId?: number
  title?: string
  windowId?: number
}

async function readWindowsForegroundWindow(): Promise<WindowsForegroundWindowResult | undefined> {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', WINDOWS_FOREGROUND_SCRIPT],
    {
      encoding: 'utf8',
      timeout: 5_000,
      windowsHide: true,
    },
  )

  const text = stdout.trim()
  if (!text)
    return undefined

  return JSON.parse(text) as WindowsForegroundWindowResult
}

export function createDesktopActivityService(params: {
  context: ReturnType<typeof createContext>['context']
  window: BrowserWindow
}) {
  defineInvokeHandler(params.context, electronGetForegroundWindowContext, async (_, options) => {
    if (params.window.webContents.id !== options?.raw.ipcMainEvent.sender.id)
      return unavailable()

    if (process.platform !== 'win32')
      return unavailable()

    try {
      const foreground = await readWindowsForegroundWindow()
      if (!foreground)
        return unavailable()

      return {
        available: true,
        appName: foreground.appName,
        processId: foreground.processId,
        title: foreground.title,
        updatedAt: Date.now(),
        windowId: foreground.windowId,
      }
    }
    catch (error) {
      console.debug('[DesktopActivity] Foreground window unavailable:', error)
      return unavailable()
    }
  })
}
