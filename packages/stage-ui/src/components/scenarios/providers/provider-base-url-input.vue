<script setup lang="ts">
import { FieldInput } from '@proj-airi/ui'

const props = defineProps<{
  placeholder?: string
  required?: boolean
  label?: string
  description?: string
}>()

const modelValue = defineModel<string>({ required: true })
</script>

<template>
  <FieldInput
    v-model="modelValue"
    :label="props.label || 'URL gốc'"
    :description="props.description || (props.required ? 'URL gốc' : 'URL gốc tùy chỉnh (không bắt buộc)')"
    :placeholder="props.placeholder"
    :required="props.required"
    type="text"
  />
</template>
