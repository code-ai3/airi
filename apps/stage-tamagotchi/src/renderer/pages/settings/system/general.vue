<script setup lang="ts">
import SettingsGeneralFields from '@proj-airi/stage-pages/components/settings-general-fields.vue'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { FieldCheckbox, FieldSelect } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { onMounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { electron, electronAppIconGet, electronAppIconSet } from '../../../../shared/eventa'
import { useProactiveCompanionStore } from '../../../stores/proactive-companion'

const { t } = useI18n()
const proactiveCompanion = useProactiveCompanionStore()
const { enabled: proactiveEnabled, observationEnabled, mode: proactiveMode } = storeToRefs(proactiveCompanion)
const proactiveModeOptions = [
  { label: 'Bình thường', value: 'normal' },
  { label: 'Tập trung', value: 'focus' },
  { label: 'Im lặng', value: 'silent' },
  { label: 'Ngủ', value: 'sleep' },
]
const getHidden = useElectronEventaInvoke(electronAppIconGet)
const setHidden = useElectronEventaInvoke(electronAppIconSet)
const isLinux = useElectronEventaInvoke(electron.app.isLinux)
// The value stays undefined on Linux, and the field does not show there.
const hideAppIcon = shallowRef<boolean>()

onMounted(async () => {
  try {
    if (!await isLinux())
      hideAppIcon.value = await getHidden()
  }
  catch {
    toast.error(t('tamagotchi.settings.pages.system.general.hide-app-icon.load-error'))
  }
})

async function updateHidden(hidden: boolean) {
  try {
    hideAppIcon.value = await setHidden(hidden)
  }
  catch {
    toast.error(t('tamagotchi.settings.pages.system.general.hide-app-icon.save-error'))
  }
}
</script>

<template>
  <SettingsGeneralFields>
    <template #additional-fields>
      <FieldCheckbox
        v-model="proactiveEnabled"
        label="AIRI chủ động"
        description="Cho phép AIRI tự thức dậy, hỏi thăm, nhắc việc, đi ngủ và xuất hiện lại theo ngữ cảnh."
      />
      <FieldCheckbox
        v-model="observationEnabled"
        label="Quan sát màn hình"
        description="Cho phép AIRI xem ứng dụng/cửa sổ đang dùng và chụp ảnh màn hình tạm thời khi cần hiểu ngữ cảnh."
      />
      <FieldSelect
        v-model="proactiveMode"
        label="Chế độ đồng hành"
        :options="proactiveModeOptions"
      />
      <FieldCheckbox
        v-if="hideAppIcon !== undefined"
        :model-value="hideAppIcon"
        :label="t('tamagotchi.settings.pages.system.general.hide-app-icon.title')"
        :description="t('tamagotchi.settings.pages.system.general.hide-app-icon.description')"
        @update:model-value="updateHidden"
      />
    </template>
  </SettingsGeneralFields>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.system.general.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
