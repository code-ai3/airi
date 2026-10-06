interface StartupFallbackMessages {
  stage?: { startup?: { failed?: string, retry?: string } }
  settings?: { dialogs?: { onboarding?: { retry?: string } } }
}

/** Serializes boot error labels for the inline splash that runs before Vue. */
export function serializeStartupFallbackLocales(locales: Record<string, StartupFallbackMessages>, localeRemap: Record<string, string>): string {
  const vietnamese = locales.vi?.stage?.startup
  if (!vietnamese?.failed || !vietnamese.retry)
    throw new Error('Vietnamese startup error labels are required')

  const labels = Object.fromEntries(Object.entries(locales).map(([locale, messages]) => [locale, {
    failed: messages.stage?.startup?.failed ?? vietnamese.failed,
    retry: messages.stage?.startup?.retry ?? messages.settings?.dialogs?.onboarding?.retry ?? vietnamese.retry,
  }]))

  return JSON.stringify({ labels, localeRemap }).replaceAll('<', '\\u003c')
}
