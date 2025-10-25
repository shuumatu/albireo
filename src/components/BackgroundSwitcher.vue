<template>
  <div
    class="background-switcher"
    :style="{ backgroundImage: currentBackground }"
    @mousemove="emit('mousemove', $event)"
    @mouseleave="emit('mouseleave')"
    ref="bgContainer"
  >
    <!-- 插槽内容，比如箭头或其他内容 -->
    <slot />

    <!-- 圆点区域 -->
    <div
      class="dot-zone"
      @mouseenter="dotsVisible = true"
      @mouseleave="dotsVisible = false"
    >
      <div
        v-for="(dot, index) in dots"
        :key="dot.id"
        class="dot-wrapper"
        @mouseenter="hoverDot(dot)"
        @mouseleave="hoverDot(null)"
      >
        <div
          v-motion
          :initial="{ y: 80, opacity: 0 }"
          :enter="dotsVisible
            ? {
                y: 0,
                opacity: 1,
                transition: {
                  delay: index * 100,
                  type: 'spring',
                },
              }
            : {
                y: 80,
                opacity: 0,
                transition: { delay: index * 100 },
              }"
          :hover="{ y: -10 }"
          class="dot"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineProps, defineEmits } from 'vue'

// Props
const props = defineProps<{
  defaultImage: string
  images: { id: string; image: string }[]
}>()

const emit = defineEmits(['mousemove', 'mouseleave'])

const dotsVisible = ref(false)
const hoveredDot = ref<string | null>(null)

const dots = ref(props.images)

const currentBackground = computed(() => {
  const match = dots.value.find(d => d.id === hoveredDot.value)
  return match?.image ?? `url(${props.defaultImage})`
})

function hoverDot(dot: { id: string } | null) {
  hoveredDot.value = dot?.id ?? null
}

const bgContainer = ref<HTMLElement | null>(null)
defineExpose({ bgContainer })
</script>

<style scoped>
.background-switcher {
  width: 100%;
  height: calc(100vh - 64px);
  background-size: cover;
  background-position: 50% center;
  background-repeat: no-repeat;
  overflow: hidden;
  position: relative;
}

.dot-zone {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 24px;
  z-index: 3;
}

.dot-wrapper {
  width: 20px;
  height: 20px;
}

.dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: white;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.6);
  cursor: pointer;
}
</style>
