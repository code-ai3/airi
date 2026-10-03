<script setup lang="ts">
import SettingsGeneralFields from '@proj-airi/stage-pages/components/settings-general-fields.vue'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { useCharacterNotebookStore } from '@proj-airi/stage-ui/stores/character'
import { FieldCheckbox, FieldSelect } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import {
  electron,
  electronAppGetLaunchAtLogin,
  electronAppIconGet,
  electronAppIconSet,
  electronAppSetLaunchAtLogin,
} from '../../../../shared/eventa'
import { useProactiveCompanionStore } from '../../../stores/proactive-companion'

const { t } = useI18n()
const proactiveCompanion = useProactiveCompanionStore()
const notebook = useCharacterNotebookStore()
const { enabled: proactiveEnabled, observationEnabled, mode: proactiveMode } = storeToRefs(proactiveCompanion)
const approvalQueue = computed(() => notebook.approvals
  .filter(approval => approval.status === 'pending' || approval.status === 'approved')
  .toSorted((a, b) => b.updatedAt - a.updatedAt))
const recentActivity = computed(() => notebook.activityLog
  .toSorted((a, b) => b.createdAt - a.createdAt)
  .slice(0, 20))
const pendingApprovalCount = computed(() => notebook.approvals.filter(approval => approval.status === 'pending').length)
const proactiveModeOptions = [
  { label: 'Bình thường', value: 'normal' },
  { label: 'Tập trung', value: 'focus' },
  { label: 'Im lặng', value: 'silent' },
  { label: 'Ngủ', value: 'sleep' },
]
const getHidden = useElectronEventaInvoke(electronAppIconGet)
const setHidden = useElectronEventaInvoke(electronAppIconSet)
const getLaunchAtLogin = useElectronEventaInvoke(electronAppGetLaunchAtLogin)
const setLaunchAtLogin = useElectronEventaInvoke(electronAppSetLaunchAtLogin)
const isLinux = useElectronEventaInvoke(electron.app.isLinux)
// The value stays undefined on Linux, and the field does not show there.
const hideAppIcon = shallowRef<boolean>()
const launchAtLogin = shallowRef<boolean>()
const launchAtLoginSupported = shallowRef(false)

onMounted(async () => {
  try {
    if (!await isLinux())
      hideAppIcon.value = await getHidden()
  }
  catch {
    toast.error(t('tamagotchi.settings.pages.system.general.hide-app-icon.load-error'))
  }

  try {
    const state = await getLaunchAtLogin()
    launchAtLogin.value = state.enabled
    launchAtLoginSupported.value = state.supported
  }
  catch {
    launchAtLoginSupported.value = false
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

async function updateLaunchAtLogin(enabled: boolean) {
  try {
    const state = await setLaunchAtLogin(enabled)
    launchAtLogin.value = state.enabled
    launchAtLoginSupported.value = state.supported
  }
  catch {
    launchAtLogin.value = false
  }
}

function approvalRiskLabel(risk: 'medium' | 'high' | 'critical') {
  if (risk === 'critical')
    return 'Rủi ro rất cao'
  if (risk === 'high')
    return 'Rủi ro cao'
  return 'Rủi ro vừa'
}

function approvalStatusLabel(status: string) {
  if (status === 'approved')
    return 'Đã duyệt · chờ thực hiện'
  if (status === 'pending')
    return 'Chờ anh duyệt'
  return status
}

function formatActivityTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })
}

function resolveApproval(approvalId: string, decision: 'approved' | 'rejected') {
  const approval = notebook.resolveApproval(approvalId, decision)
  if (!approval)
    return

  if (decision === 'approved')
    toast.success('Đã cho phép. AIRI sẽ thực hiện một lần khi anh đang dùng máy.')
  else
    toast.info('Đã từ chối. AIRI sẽ không thực hiện hành động này.')
}

function clearResolvedApprovals() {
  notebook.clearResolvedApprovals()
  toast.success('Đã dọn các yêu cầu đã xử lý.')
}

function clearActivityLog() {
  notebook.clearActivityLog()
  toast.success('Đã xóa nhật ký hoạt động.')
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
        v-if="launchAtLoginSupported && launchAtLogin !== undefined"
        :model-value="launchAtLogin"
        label="Tự chạy cùng Windows"
        description="Khởi động AIRI tự động khi anh đăng nhập Windows để em có thể tự thức dậy và đồng hành mà không cần anh mở ứng dụng thủ công."
        @update:model-value="updateLaunchAtLogin"
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

  <section class="airi-control-panel">
    <header class="airi-control-header">
      <div>
        <h2>Trung tâm quyền hạn AIRI</h2>
        <p>Những thao tác làm thay đổi máy tính phải được anh duyệt trước. AIRI chỉ được chạy đúng hành động hiển thị bên dưới một lần.</p>
      </div>
      <span v-if="pendingApprovalCount" class="airi-count-badge">
        {{ pendingApprovalCount }} chờ duyệt
      </span>
    </header>

    <div class="airi-section-heading">
      <div>
        <h3>Yêu cầu quyền</h3>
        <p>Kiểm tra kỹ lệnh trước khi bấm Cho phép.</p>
      </div>
      <button class="airi-link-button" type="button" @click="clearResolvedApprovals">
        Dọn yêu cầu đã xử lý
      </button>
    </div>

    <div v-if="approvalQueue.length" class="airi-stack">
      <article
        v-for="approval in approvalQueue"
        :key="approval.id"
        class="airi-approval-card"
        :data-risk="approval.risk"
      >
        <div class="airi-card-top">
          <strong>{{ approval.title }}</strong>
          <div class="airi-badges">
            <span class="airi-badge">{{ approvalRiskLabel(approval.risk) }}</span>
            <span class="airi-badge" :data-status="approval.status">
              {{ approvalStatusLabel(approval.status) }}
            </span>
          </div>
        </div>

        <p v-if="approval.reason" class="airi-card-description">
          {{ approval.reason }}
        </p>
        <code class="airi-command">{{ approval.action.argv.join(' ') }}</code>

        <div v-if="approval.status === 'pending'" class="airi-approval-actions">
          <button class="airi-button airi-button-approve" type="button" @click="resolveApproval(approval.id, 'approved')">
            Cho phép một lần
          </button>
          <button class="airi-button airi-button-reject" type="button" @click="resolveApproval(approval.id, 'rejected')">
            Từ chối
          </button>
        </div>
        <p v-else class="airi-waiting-note">
          AIRI sẽ thực hiện đúng lệnh này ở vòng xử lý tiếp theo khi anh đang dùng máy. Quyền tự hết hạn sau 30 phút.
        </p>
      </article>
    </div>
    <p v-else class="airi-empty-state">
      Hiện không có hành động nào đang chờ anh duyệt.
    </p>

    <div class="airi-section-heading airi-activity-heading">
      <div>
        <h3>Nhật ký hoạt động</h3>
        <p>20 hoạt động gần nhất của cơ chế tự chủ và hệ thống phê duyệt.</p>
      </div>
      <button class="airi-link-button" type="button" @click="clearActivityLog">
        Xóa nhật ký
      </button>
    </div>

    <div v-if="recentActivity.length" class="airi-activity-list">
      <div v-for="entry in recentActivity" :key="entry.id" class="airi-activity-item" :data-status="entry.status">
        <span class="airi-activity-dot" />
        <div class="airi-activity-copy">
          <div class="airi-activity-title">
            <strong>{{ entry.title }}</strong>
            <time>{{ formatActivityTime(entry.createdAt) }}</time>
          </div>
          <p v-if="entry.details">
            {{ entry.details }}
          </p>
        </div>
      </div>
    </div>
    <p v-else class="airi-empty-state">
      Chưa có hoạt động nào được ghi lại.
    </p>
  </section>
</template>

<style scoped>
.airi-control-panel {
  margin-top: 24px;
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 16px;
  padding: 18px;
  background: color-mix(in srgb, currentColor 3%, transparent);
}

.airi-control-header,
.airi-section-heading,
.airi-card-top,
.airi-activity-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.airi-control-header h2,
.airi-section-heading h3,
.airi-card-top strong,
.airi-activity-title strong {
  margin: 0;
}

.airi-control-header p,
.airi-section-heading p,
.airi-card-description,
.airi-waiting-note,
.airi-empty-state,
.airi-activity-copy p {
  margin: 4px 0 0;
  opacity: 0.7;
  font-size: 13px;
  line-height: 1.45;
}

.airi-section-heading {
  margin-top: 20px;
  margin-bottom: 10px;
}

.airi-count-badge,
.airi-badge {
  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 11px;
  white-space: nowrap;
}

.airi-count-badge {
  font-weight: 700;
}

.airi-stack,
.airi-activity-list {
  display: grid;
  gap: 10px;
}

.airi-approval-card {
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  border-radius: 12px;
  padding: 14px;
  background: color-mix(in srgb, currentColor 2%, transparent);
}

.airi-approval-card[data-risk='critical'] {
  border-color: rgba(239, 68, 68, 0.5);
}

.airi-badges,
.airi-approval-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.airi-badge[data-status='approved'] {
  border-color: rgba(34, 197, 94, 0.45);
}

.airi-command {
  display: block;
  margin-top: 10px;
  border-radius: 8px;
  padding: 9px 10px;
  overflow-wrap: anywhere;
  background: rgba(127, 127, 127, 0.12);
  font-size: 12px;
  line-height: 1.45;
}

.airi-approval-actions {
  margin-top: 12px;
}

.airi-button,
.airi-link-button {
  border-radius: 9px;
  cursor: pointer;
  font: inherit;
}

.airi-button {
  border: 0;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
}

.airi-button-approve {
  background: #16a34a;
  color: white;
}

.airi-button-reject {
  background: rgba(127, 127, 127, 0.14);
  color: inherit;
}

.airi-link-button {
  border: 0;
  padding: 4px 0;
  background: transparent;
  color: inherit;
  opacity: 0.72;
  font-size: 12px;
}

.airi-link-button:hover {
  opacity: 1;
}

.airi-activity-heading {
  margin-top: 24px;
}

.airi-activity-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent);
  padding: 8px 2px 10px;
}

.airi-activity-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  margin-top: 5px;
  border-radius: 999px;
  background: #64748b;
}

.airi-activity-item[data-status='success'] .airi-activity-dot {
  background: #16a34a;
}

.airi-activity-item[data-status='warning'] .airi-activity-dot {
  background: #d97706;
}

.airi-activity-item[data-status='error'] .airi-activity-dot {
  background: #dc2626;
}

.airi-activity-copy {
  min-width: 0;
  flex: 1;
}

.airi-activity-title time {
  flex: 0 0 auto;
  opacity: 0.5;
  font-size: 11px;
}

.airi-activity-copy p {
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .airi-control-header,
  .airi-section-heading,
  .airi-card-top,
  .airi-activity-title {
    align-items: flex-start;
    flex-direction: column;
  }

  .airi-badges,
  .airi-approval-actions {
    flex-wrap: wrap;
  }
}
</style>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.system.general.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
