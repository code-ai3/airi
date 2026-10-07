<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const quickSettings = [
  {
    title: 'BÔNG Card',
    description: 'Tính cách, cách xưng hô và mức độ chủ động.',
    icon: 'i-solar:user-id-line-duotone',
    tone: 'blue',
    to: '/settings/airi-card',
  },
  {
    title: 'Mô hình AI',
    description: 'Nhà cung cấp, mô hình trò chuyện và suy luận.',
    icon: 'i-solar:brain-line-duotone',
    tone: 'violet',
    to: '/settings/modules/consciousness',
  },
  {
    title: 'Giọng nói',
    description: 'Nghe, micro, nhận diện và giọng nói của BÔNG.',
    icon: 'i-solar:microphone-3-line-duotone',
    tone: 'pink',
    to: '/settings/modules/speech',
  },
  {
    title: 'Bộ nhớ',
    description: 'Những điều BÔNG ghi nhớ để hiểu anh hơn.',
    icon: 'i-solar:database-line-duotone',
    tone: 'cyan',
    to: '/settings/memory',
  },
  {
    title: 'Giao diện',
    description: 'Khung cảnh, hình nền và trải nghiệm hiển thị.',
    icon: 'i-solar:palette-line-duotone',
    tone: 'orange',
    to: '/settings/scene',
  },
  {
    title: 'Nâng cao',
    description: 'Hệ thống, dữ liệu và các tùy chọn chuyên sâu.',
    icon: 'i-solar:settings-minimalistic-line-duotone',
    tone: 'slate',
    to: '/settings/system',
  },
]

function open(to: string) {
  void router.push(to)
}
</script>

<template>
  <section class="bong-overview">
    <div class="bong-overview-hero">
      <div>
        <span class="bong-overview-kicker">TRỢ LÝ CỦA RIÊNG ANH</span>
        <h2>BÔNG đã sẵn sàng ♡</h2>
        <p>
          Mọi cài đặt quan trọng được gom lại ở đây để anh chỉnh BÔNG theo đúng cách mình muốn.
        </p>
      </div>
      <div class="bong-overview-orb">
        <span i-solar:heart-shine-bold-duotone />
      </div>
    </div>

    <div class="bong-overview-grid">
      <button
        v-for="item in quickSettings"
        :key="item.to"
        type="button"
        class="bong-overview-card"
        :data-tone="item.tone"
        @click="open(item.to)"
      >
        <div class="bong-overview-card__icon">
          <span :class="item.icon" />
        </div>
        <div class="bong-overview-card__copy">
          <strong>{{ item.title }}</strong>
          <span>{{ item.description }}</span>
        </div>
        <span class="bong-overview-card__arrow" i-solar:alt-arrow-right-line-duotone />
      </button>
    </div>
  </section>
</template>

<style scoped>
.bong-overview {
  padding-bottom: 28px;
}

.bong-overview-hero {
  position: relative;
  overflow: hidden;
  display: flex;
  min-height: 170px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
  border: 1px solid #dce7f7;
  border-radius: 26px;
  padding: 28px 30px;
  background:
    radial-gradient(circle at 90% 30%, rgb(255 219 238 / 80%), transparent 24%),
    linear-gradient(135deg, rgb(239 247 255 / 96%), rgb(251 246 255 / 96%));
  box-shadow: 0 15px 38px rgb(70 105 163 / 9%), inset 0 1px 0 #fff;
}

.bong-overview-kicker {
  color: #5a82d5;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0.12em;
}

.bong-overview-hero h2 {
  margin: 7px 0 5px;
  color: #18294b;
  font-size: 30px;
  font-weight: 820;
  letter-spacing: -0.035em;
}

.bong-overview-hero p {
  max-width: 620px;
  margin: 0;
  color: #7a88a5;
  line-height: 1.55;
}

.bong-overview-orb {
  display: grid;
  width: 112px;
  height: 112px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 90%);
  border-radius: 36px;
  background: linear-gradient(145deg, #fff7fb, #e9f3ff);
  color: #ff82b8;
  font-size: 58px;
  box-shadow: 0 15px 32px rgb(126 113 183 / 12%);
  transform: rotate(5deg);
}

.bong-overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.bong-overview-card {
  --accent: #4e84ec;
  --surface: #eef5ff;
  display: grid;
  min-height: 112px;
  grid-template-columns: 54px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  border: 1px solid #e0e8f5;
  border-radius: 21px;
  padding: 18px;
  background: rgb(255 255 255 / 82%);
  color: #263752;
  cursor: pointer;
  text-align: left;
  box-shadow: inset 0 1px 0 #fff;
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}

.bong-overview-card[data-tone="violet"] {
  --accent: #815fe9;
  --surface: #f2efff;
}

.bong-overview-card[data-tone="pink"] {
  --accent: #ec70ad;
  --surface: #fff0f7;
}

.bong-overview-card[data-tone="cyan"] {
  --accent: #2f9bad;
  --surface: #edfafa;
}

.bong-overview-card[data-tone="orange"] {
  --accent: #e69051;
  --surface: #fff5eb;
}

.bong-overview-card[data-tone="slate"] {
  --accent: #627394;
  --surface: #f1f4f8;
}

.bong-overview-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent) 28%, #dfe8f6);
  box-shadow: 0 13px 28px rgb(66 92 140 / 11%);
}

.bong-overview-card__icon {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  border-radius: 17px;
  background: var(--surface);
  color: var(--accent);
  font-size: 27px;
}

.bong-overview-card__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.bong-overview-card__copy strong {
  color: #25334d;
  font-size: 16px;
  font-weight: 780;
}

.bong-overview-card__copy span {
  color: #8490a7;
  font-size: 13px;
  line-height: 1.4;
}

.bong-overview-card__arrow {
  color: #9cabc3;
  font-size: 22px;
}

@media (max-width: 760px) {
  .bong-overview-grid {
    grid-template-columns: 1fr;
  }

  .bong-overview-orb {
    display: none;
  }

  .bong-overview-hero {
    min-height: 0;
  }
}
</style>

<route lang="yaml">
meta:
  layout: settings
  title: Tổng quan
  subtitle: Trung tâm cài đặt BÔNG
  stageTransition:
    name: slide
</route>
