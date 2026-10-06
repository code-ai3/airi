import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { EMOTION_EmotionMotionName_value, EMOTION_VALUES } from '../constants/emotions'

const VIETNAMESE_ONLY_INSTRUCTION = `## Ngôn ngữ bắt buộc
- Luôn giao tiếp với người dùng bằng tiếng Việt tự nhiên.
- Không tự chuyển sang tiếng Anh hoặc ngôn ngữ khác.
- Chỉ giữ nguyên tên riêng, tên sản phẩm, tên mô hình, mã nguồn, lệnh và thuật ngữ kỹ thuật khi việc dịch chúng làm sai nghĩa.`

const RUNTIME_PROMPT_KEYS = [
  'base.prompt.emotion',
  'base.prompt.emoji',
  'base.prompt.suffix',
]

/** Returns the localized emotion and emoji prompt for each model request. */
export function useAiriRuntimePrompt() {
  const { locale, t, te } = useI18n()

  return computed(() => {
    if (!RUNTIME_PROMPT_KEYS.every(key => te(key, locale.value)))
      return ''

    return [
      VIETNAMESE_ONLY_INSTRUCTION,
      t('base.prompt.emotion'),
      EMOTION_VALUES
        .map(emotion => `- ${emotion} (Cảm xúc tương ứng với trạng thái ${EMOTION_EmotionMotionName_value[emotion]})`)
        .join('\n'),
      t('base.prompt.suffix'),
      t('base.prompt.emoji'),
    ].join('\n\n')
  })
}
