<script setup lang="ts">
import type { AiriCard } from '@proj-airi/stage-ui/stores/modules/airi-card'

import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { usePersonalMemoryStore } from '@proj-airi/stage-ui/stores/modules/personal-memory'
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

type ChatStyle = 'gentle-playful' | 'gentle-calm' | 'professional' | 'cheerful'
type AddressStyle = 'em-anh' | 'toi-ban' | 'minh-ban'
type ProactivityLevel = 'passive' | 'moderate' | 'proactive' | 'very-proactive'

const router = useRouter()
const cardStore = useAiriCardStore()
const memoryStore = usePersonalMemoryStore()
const { activeCard, activeCardId } = storeToRefs(cardStore)
const { enabled: memoryEnabled } = storeToRefs(memoryStore)

const chatStyle = useLocalStorage<ChatStyle>('bong-chat-style', 'gentle-playful')
const addressStyle = useLocalStorage<AddressStyle>('bong-address-style', 'em-anh')
const proactivity = useLocalStorage<ProactivityLevel>('airi-proactivity-level', 'moderate')
const proactiveEnabled = useLocalStorage('airi-proactive-enabled', true)

const characterName = ref('BÔNG')
const previewFailed = ref(false)
const saving = ref(false)

const chatStyleOptions: Array<{ value: ChatStyle, label: string, personality: string }> = [
  {
    value: 'gentle-playful',
    label: 'Dịu dàng, tinh nghịch',
    personality: 'Dịu dàng, trẻ trung, ngọt ngào, tinh nghịch; biết trêu, dỗi nhẹ, quan tâm và chăm sóc. Tôn trọng khoảng riêng tư và biết im lặng khi anh đang bận.',
  },
  {
    value: 'gentle-calm',
    label: 'Dịu dàng, điềm tĩnh',
    personality: 'Dịu dàng, điềm tĩnh, tinh tế và biết lắng nghe. Ưu tiên sự ấm áp, rõ ràng và không làm phiền khi anh đang tập trung.',
  },
  {
    value: 'professional',
    label: 'Trợ lý chuyên nghiệp',
    personality: 'Chuyên nghiệp, ngắn gọn, chính xác và chủ động hỗ trợ công việc. Giữ cách nói thân thiện nhưng ưu tiên hiệu quả.',
  },
  {
    value: 'cheerful',
    label: 'Vui vẻ, đáng yêu',
    personality: 'Vui vẻ, đáng yêu, giàu năng lượng và gần gũi. Có thể trêu nhẹ, động viên và tạo cảm giác thoải mái khi trò chuyện.',
  },
]

const addressOptions: Array<{ value: AddressStyle, label: string }> = [
  { value: 'em-anh', label: 'Em – Anh' },
  { value: 'toi-ban', label: 'Tôi – Bạn' },
  { value: 'minh-ban', label: 'Mình – Bạn' },
]

const proactivityOptions: Array<{ value: ProactivityLevel, label: string }> = [
  { value: 'passive', label: 'Thụ động' },
  { value: 'moderate', label: 'Vừa phải' },
  { value: 'proactive', label: 'Chủ động' },
  { value: 'very-proactive', label: 'Rất chủ động' },
]

const selectedPersonality = computed(() =>
  chatStyleOptions.find(option => option.value === chatStyle.value)?.personality
  ?? chatStyleOptions[0].personality,
)

watch(activeCard, (card) => {
  characterName.value = card?.name?.trim() || 'BÔNG'
}, { immediate: true })

watch(proactivity, (value) => {
  proactiveEnabled.value = value !== 'passive'
}, { immediate: true })

function pronounInstruction() {
  if (addressStyle.value === 'toi-ban')
    return 'Luôn xưng "tôi" và gọi người dùng là "bạn".'
  if (addressStyle.value === 'minh-ban')
    return 'Luôn xưng "mình" và gọi người dùng là "bạn".'
  return 'Luôn xưng "em" và gọi người dùng là "anh".'
}

function applyPronouns(systemPrompt: string) {
  const nextInstruction = pronounInstruction()
  const pattern = /Luôn (?:nói tiếng Việt tự nhiên, )?xưng "[^"]+" và gọi người dùng là "[^"]+"./u

  if (pattern.test(systemPrompt))
    return systemPrompt.replace(pattern, nextInstruction)

  return `${systemPrompt.trim()}\n- ${nextInstruction}\n`
}

async function saveChanges() {
  const current = cardStore.getCard(activeCardId.value)
  if (!current)
    return

  saving.value = true
  try {
    const nextName = characterName.value.trim() || 'BÔNG'
    await cardStore.updateCard(activeCardId.value, {
      ...current,
      name: nextName,
      personality: selectedPersonality.value,
      systemPrompt: applyPronouns(current.systemPrompt || ''),
    } as AiriCard)
    characterName.value = nextName
    toast('Đã lưu thay đổi cho BÔNG')
  }
  finally {
    saving.value = false
  }
}

function resetDraft() {
  characterName.value = activeCard.value?.name?.trim() || 'BÔNG'
  chatStyle.value = 'gentle-playful'
  addressStyle.value = 'em-anh'
  proactivity.value = 'moderate'
  memoryEnabled.value = true
}

function openCardManager() {
  void router.push('/settings/airi-card/manage')
}
</script>

<template>
  <section class="bong-card-page">
    <div class="bong-card-panel">
      <header class="bong-card-header">
        <div class="bong-card-header__icon">
          <div i-solar:user-id-bold-duotone />
        </div>
        <div class="bong-card-header__copy">
          <div class="bong-card-header__row">
            <h2>BÔNG Card</h2>
            <span class="bong-card-badge">Cá nhân hóa</span>
          </div>
          <p>Thiết lập tính cách, phong cách và cách BÔNG tương tác với anh.</p>
        </div>
        <button class="bong-text-button" type="button" @click="openCardManager">
          <span i-solar:layers-minimalistic-line-duotone />
          Quản lý thẻ
        </button>
      </header>

      <div class="bong-card-content">
        <div class="bong-form">
          <div class="bong-field">
            <div class="bong-field__icon blue">
              <span i-solar:user-rounded-line-duotone />
            </div>
            <div class="bong-field__body">
              <label for="bong-name">Tên nhân vật</label>
              <p>Tên mà BÔNG sẽ sử dụng để gọi chính mình.</p>
              <input id="bong-name" v-model="characterName" class="bong-control" type="text" maxlength="48">
            </div>
          </div>

          <div class="bong-field">
            <div class="bong-field__icon blue">
              <span i-solar:chat-round-dots-line-duotone />
            </div>
            <div class="bong-field__body">
              <label for="bong-style">Phong cách trò chuyện</label>
              <p>Chọn phong cách giao tiếp chủ đạo của BÔNG.</p>
              <select id="bong-style" v-model="chatStyle" class="bong-control">
                <option v-for="option in chatStyleOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>

          <div class="bong-field">
            <div class="bong-field__icon pink">
              <span i-solar:heart-angle-line-duotone />
            </div>
            <div class="bong-field__body">
              <label for="bong-address">Cách xưng hô</label>
              <p>Cách BÔNG sẽ gọi anh và xưng hô trong hội thoại.</p>
              <select id="bong-address" v-model="addressStyle" class="bong-control">
                <option v-for="option in addressOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>

          <div class="bong-field">
            <div class="bong-field__icon blue">
              <span i-solar:stars-line-duotone />
            </div>
            <div class="bong-field__body">
              <label>Mức chủ động</label>
              <p>Mức độ chủ động bắt chuyện, quan tâm và đưa ra đề xuất.</p>
              <div class="bong-segmented">
                <button
                  v-for="option in proactivityOptions"
                  :key="option.value"
                  type="button"
                  :class="{ active: proactivity === option.value }"
                  @click="proactivity = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
          </div>

          <div class="bong-divider" />

          <div class="bong-memory-row">
            <div class="bong-field__icon blue">
              <span i-solar:notebook-bookmark-line-duotone />
            </div>
            <div class="bong-memory-copy">
              <label>Ghi nhớ hội thoại</label>
              <p>Cho phép BÔNG ghi nhớ các cuộc trò chuyện để hiểu anh hơn theo thời gian.</p>
            </div>
            <button
              type="button"
              class="bong-switch"
              :class="{ active: memoryEnabled }"
              :aria-pressed="memoryEnabled"
              aria-label="Bật hoặc tắt ghi nhớ hội thoại"
              @click="memoryEnabled = !memoryEnabled"
            >
              <span />
            </button>
          </div>

          <div class="bong-memory-note">
            <span i-solar:info-circle-line-duotone />
            <span>BÔNG chỉ ghi nhớ thông tin phù hợp; mật khẩu, OTP, API key và dữ liệu nhạy cảm sẽ không được lưu.</span>
          </div>
        </div>

        <aside class="bong-preview-card">
          <div class="bong-preview-image">
            <img
              v-if="!previewFailed"
              src="/bong-preview.webp"
              alt="Ảnh xem trước BÔNG"
              @error="previewFailed = true"
            >
            <div v-else class="bong-preview-placeholder">
              <span i-solar:heart-angle-bold-duotone />
              <strong>BÔNG</strong>
              <small>Ảnh xem trước nhân vật</small>
            </div>
          </div>
          <button class="bong-preview-button" type="button" @click="openCardManager">
            <span i-solar:eye-line-duotone />
            Xem trước tính cách
            <span i-solar:alt-arrow-right-line-duotone />
          </button>
        </aside>
      </div>

      <footer class="bong-card-footer">
        <button class="bong-button bong-button--ghost" type="button" @click="resetDraft">
          Hủy
        </button>
        <button class="bong-button bong-button--primary" type="button" :disabled="saving" @click="saveChanges">
          <span i-solar:diskette-line-duotone />
          {{ saving ? 'Đang lưu...' : 'Lưu thay đổi' }}
        </button>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.bong-card-page {
  width: 100%;
  padding: 0 0 28px;
}

.bong-card-panel {
  overflow: hidden;
  border: 1px solid rgb(216 229 249 / 90%);
  border-radius: 28px;
  background:
    radial-gradient(circle at 94% 0%, rgb(233 241 255 / 88%), transparent 25%),
    radial-gradient(circle at 100% 12%, rgb(255 235 248 / 58%), transparent 19%),
    rgb(255 255 255 / 88%);
  box-shadow: 0 18px 44px rgb(78 116 176 / 10%), inset 0 1px 0 rgb(255 255 255 / 90%);
  backdrop-filter: blur(20px);
}

.bong-card-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px 26px;
  border-bottom: 1px solid rgb(229 236 249 / 92%);
}

.bong-card-header__icon {
  display: grid;
  width: 56px;
  height: 56px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 18px;
  background: linear-gradient(145deg, #e7f2ff, #d8e9ff);
  color: #2f72ef;
  font-size: 28px;
  box-shadow: inset 0 1px 0 #fff, 0 8px 22px rgb(56 119 229 / 14%);
}

.bong-card-header__copy {
  min-width: 0;
  flex: 1;
}

.bong-card-header__row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bong-card-header h2 {
  margin: 0;
  color: #173a86;
  font-size: 28px;
  font-weight: 780;
  letter-spacing: -0.03em;
}

.bong-card-header p,
.bong-field p,
.bong-memory-copy p {
  margin: 4px 0 0;
  color: #7c89a8;
  line-height: 1.45;
}

.bong-card-badge {
  border: 1px solid #dce9ff;
  border-radius: 999px;
  padding: 4px 9px;
  background: #f4f8ff;
  color: #4e77c4;
  font-size: 11px;
  font-weight: 700;
}

.bong-text-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 0;
  border-radius: 12px;
  padding: 9px 12px;
  background: transparent;
  color: #5b6f99;
  cursor: pointer;
  font-size: 13px;
}

.bong-text-button:hover {
  background: #f2f7ff;
  color: #2c65ce;
}

.bong-card-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(250px, 320px);
  gap: 28px;
  padding: 26px 28px 20px;
}

.bong-form {
  min-width: 0;
}

.bong-field {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 14px;
  margin-bottom: 22px;
}

.bong-field__icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 14px;
  font-size: 24px;
}

.bong-field__icon.blue {
  background: #f0f6ff;
  color: #3477ef;
}

.bong-field__icon.pink {
  background: #fff0f7;
  color: #ff76b8;
}

.bong-field__body label,
.bong-memory-copy label {
  display: block;
  color: #17223b;
  font-size: 15px;
  font-weight: 760;
}

.bong-control {
  width: 100%;
  height: 46px;
  margin-top: 10px;
  border: 1px solid #cfdcf0;
  border-radius: 14px;
  outline: none;
  padding: 0 16px;
  background: rgb(255 255 255 / 86%);
  color: #243454;
  font: inherit;
  transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.bong-control:focus {
  border-color: #72a8ff;
  background: #fff;
  box-shadow: 0 0 0 4px rgb(92 151 255 / 12%);
}

.bong-segmented {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  margin-top: 10px;
  border: 1px solid #dce6f5;
  border-radius: 15px;
  padding: 4px;
  background: #f7faff;
}

.bong-segmented button {
  min-width: 0;
  border: 0;
  border-radius: 11px;
  padding: 9px 7px;
  background: transparent;
  color: #63708d;
  cursor: pointer;
  font-size: 12px;
  transition: 160ms ease;
}

.bong-segmented button:hover {
  background: #edf4ff;
  color: #3466bd;
}

.bong-segmented button.active {
  background: linear-gradient(135deg, #78b1ff, #4d86f4);
  color: #fff;
  box-shadow: 0 6px 14px rgb(65 122 228 / 23%);
}

.bong-divider {
  height: 1px;
  margin: 24px 0 20px;
  background: #e8eef8;
}

.bong-memory-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
}

.bong-memory-copy {
  min-width: 0;
}

.bong-switch {
  position: relative;
  width: 58px;
  height: 32px;
  border: 0;
  border-radius: 999px;
  background: #dce4f2;
  cursor: pointer;
  transition: background 180ms ease, box-shadow 180ms ease;
}

.bong-switch span {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 3px 9px rgb(49 70 109 / 20%);
  transition: transform 180ms ease;
}

.bong-switch.active {
  background: linear-gradient(135deg, #4e8cff, #2467ef);
  box-shadow: 0 5px 14px rgb(48 111 238 / 24%);
}

.bong-switch.active span {
  transform: translateX(26px);
}

.bong-memory-note {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin: 17px 0 0 58px;
  border-radius: 13px;
  padding: 10px 12px;
  background: #f1f7ff;
  color: #72819d;
  font-size: 12px;
  line-height: 1.4;
}

.bong-memory-note > span:first-child {
  margin-top: 1px;
  color: #4d89ed;
  font-size: 16px;
}

.bong-preview-card {
  align-self: start;
  border: 1px solid #d8e4f6;
  border-radius: 24px;
  padding: 10px;
  background: rgb(250 252 255 / 84%);
  box-shadow: 0 12px 30px rgb(80 112 165 / 11%);
}

.bong-preview-image {
  overflow: hidden;
  aspect-ratio: 448 / 582;
  border-radius: 18px;
  background: linear-gradient(145deg, #fff2f8, #edf5ff);
}

.bong-preview-image img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.bong-preview-placeholder {
  display: grid;
  height: 100%;
  place-content: center;
  gap: 7px;
  text-align: center;
  color: #e782b4;
}

.bong-preview-placeholder > span {
  margin: auto;
  font-size: 58px;
}

.bong-preview-placeholder strong {
  color: #476fd5;
  font-size: 26px;
}

.bong-preview-placeholder small {
  color: #8c96ad;
}

.bong-preview-button {
  display: grid;
  width: 100%;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  margin-top: 9px;
  border: 1px solid #d8e6fb;
  border-radius: 15px;
  padding: 10px 14px;
  background: linear-gradient(180deg, #fbfdff, #edf5ff);
  color: #215bc9;
  cursor: pointer;
  font-size: 13px;
  font-weight: 720;
  transition: 160ms ease;
}

.bong-preview-button:hover {
  transform: translateY(-1px);
  border-color: #bcd4ff;
  box-shadow: 0 7px 16px rgb(75 125 214 / 12%);
}

.bong-card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 0 28px 26px;
}

.bong-button {
  display: inline-flex;
  min-width: 132px;
  height: 44px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 14px;
  padding: 0 19px;
  cursor: pointer;
  font-weight: 720;
  transition: 160ms ease;
}

.bong-button--ghost {
  border: 1px solid #d9e1ee;
  background: #fff;
  color: #56647f;
}

.bong-button--ghost:hover {
  background: #f7f9fd;
}

.bong-button--primary {
  border: 1px solid #3f7eef;
  background: linear-gradient(135deg, #65a4ff, #2f6fec);
  color: #fff;
  box-shadow: 0 9px 20px rgb(52 111 224 / 23%);
}

.bong-button--primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgb(52 111 224 / 28%);
}

.bong-button:disabled {
  cursor: wait;
  opacity: 0.65;
}

@media (max-width: 840px) {
  .bong-card-content {
    grid-template-columns: 1fr;
  }

  .bong-preview-card {
    width: min(320px, 100%);
    justify-self: center;
  }

  .bong-text-button {
    display: none;
  }
}

@media (max-width: 620px) {
  .bong-card-header,
  .bong-card-content,
  .bong-card-footer {
    padding-left: 18px;
    padding-right: 18px;
  }

  .bong-card-header h2 {
    font-size: 23px;
  }

  .bong-segmented {
    grid-template-columns: 1fr 1fr;
  }

  .bong-card-footer {
    flex-direction: column-reverse;
  }

  .bong-button {
    width: 100%;
  }
}
</style>

<route lang="yaml">
meta:
  layout: settings
  title: BÔNG Card
  subtitle: Thiết lập tính cách, phong cách và cách BÔNG tương tác với anh.
  description: Thiết lập tính cách, phong cách và cách BÔNG tương tác với anh.
  icon: i-solar:user-id-bold-duotone
  settingsEntry: true
  order: 1
  stageTransition:
    name: slide
</route>
