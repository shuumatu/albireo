<template>
  

  <div
    class="background-container"
    ref="bgContainer"
    @mousemove="handleMouseMove"
    @mouseleave="stopMoving"
  >
    <!-- 背景图部分 -->
    <div class="bg-images">
      <img
        v-for="(dot, index) in allBgs"
        :key="dot.bg"
        :src="dot.bg"
        class="moving-bg"
        :style="{
          objectPosition: `${backgroundX}% center`,
          opacity: dot.bg === currentBg ? 1 : 0,
          zIndex: dot.bg === currentBg ? 1 : 0
        }"
        loading="eager"
      />
    </div>

    <!-- 左右箭头 -->
    <img
      v-if="showLeftArrow"
      class="arrow left-arrow"
      src="../assets/icon/KeyboardArrowLeftTwotone.svg"
      alt="←"
    />
    <img
      v-if="showRightArrow"
      class="arrow right-arrow"
      src="../assets/icon/KeyboardArrowRightTwotone.svg"
      alt="→"
    />

    <!-- 底部圆点 -->
    <div class="trigger-area" @mouseenter="showDots" @mouseleave="hideDots">
      <div class="dots-container">
        <div
          v-for="(dot, index) in dots"
          :key="index"
          class="dot"
          v-motion="`dot-${index}`"
          @mouseenter="handleDotHover(index)"
          @mouseleave="handleDotLeave(index)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useMotions } from '@vueuse/motion'

const motions = useMotions()

// 定义动画变体
const variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.5,
    backgroundColor: '#ffffff',
    transition: {
      duration: 250,
      ease: 'easeIn'
    }
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    backgroundColor: '#ffffff',
    transition: {
      duration: 350,
      delay: (i) => i * 80,
      ease: 'easeOut'
    }
  },
  hang: {
    opacity: 1,
    y: -10,
    scale: 1.1,
    backgroundColor: '#7474747d',
    transition: {
      duration: 200,
      ease: 'easeOut'
    }
  }
}

// 应用初始状态
onMounted(() => {
  dots.value.forEach((_, i) => {
    motions[`dot-${i}`].apply({
      ...variants.hidden,
      x: i * 0// 改为20px，与CSS的gap保持一致
    })
  })
})

// 显示圆点
const showDots = () => {
  dots.value.forEach((_, i) => {
    motions[`dot-${i}`].apply({
      ...variants.visible,
      transition: {
        ...variants.visible.transition,
        delay: i * 80
      }
    })
  })
}

// 隐藏圆点
const hideDots = () => {
  dots.value.forEach((_, i) => {
    motions[`dot-${i}`].apply(variants.hidden)
  })
}

// 处理圆点悬停
const handleDotHover = (index: number) => {
  motions[`dot-${index}`].apply(variants.hang)
  currentBg.value = dots.value[index].bg
}

// 处理圆点离开
const handleDotLeave = (index: number) => {
  motions[`dot-${index}`].apply({
    ...variants.visible,
    transition: {
      duration: 200,
      ease: 'easeIn'
    }
  })
}

const dots = ref([
  { bg: new URL('../assets/bg1.jpg', import.meta.url).href },
  { bg: new URL('../assets/bg2.jpg', import.meta.url).href },
  { bg: new URL('../assets/bg3.jpg', import.meta.url).href },
  { bg: new URL('../assets/bg4.jpg', import.meta.url).href },
  { bg: new URL('../assets/bg5.jpg', import.meta.url).href },
])

const defaultBg = new URL('../assets/bg4.jpg', import.meta.url).href
const currentBg = ref(defaultBg)

// 所有需要显示的背景图
const allBgs = ref([{ bg: defaultBg }, ...dots.value])

// 预加载所有图片
onMounted(() => {
  allBgs.value.forEach(dot => {
    const img = new Image()
    img.src = dot.bg
  })
})

const bgContainer = ref<HTMLElement | null>(null)
const backgroundX = ref(50)
const showLeftArrow = ref(false)
const showRightArrow = ref(false)

let speed = 0
let animationFrameId: number | null = null

function handleMouseMove(e: MouseEvent) {
  const el = bgContainer.value
  if (!el) return
  const { left, width } = el.getBoundingClientRect()
  const mouseX = e.clientX - left
  const ratio = mouseX / width

  if (ratio > 0.25 && ratio < 0.75) {
    speed = 0
    showLeftArrow.value = false
    showRightArrow.value = false
    return
  }

  const distanceFromCenter = ratio - 0.5
  const amplified = Math.sign(distanceFromCenter) * Math.pow(Math.abs(distanceFromCenter), 5)
  speed = amplified * 15

  showLeftArrow.value = ratio <= 0.25
  showRightArrow.value = ratio >= 0.75

  startMoving()
}

function stopMoving() {
  speed = 0
  showLeftArrow.value = false
  showRightArrow.value = false
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

function startMoving() {
  if (animationFrameId !== null) return

  const animate = () => {
    if (speed !== 0) {
      backgroundX.value += speed
      backgroundX.value = Math.max(0, Math.min(100, backgroundX.value))
      animationFrameId = requestAnimationFrame(animate)
    } else {
      animationFrameId = null
    }
  }

  animate()
}

onBeforeUnmount(() => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
})
</script>

<style scoped>
.background-container {
  width: 100%;
  height: calc(100vh - 64px);
  overflow: hidden;
  position: relative;
}

.bg-images {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 0;
}

.moving-bg {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% center;
  transition: opacity 0.6s ease, object-position 0.05s linear;
  will-change: opacity, object-position;
  pointer-events: none;
  top: 0;
  left: 0;
}

.arrow {
  filter: brightness(0) invert(1);
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 100px;
  opacity: 0.7;
  pointer-events: none;
  z-index: 2;
}

.left-arrow {
  left: 20px;
}
.right-arrow {
  right: 20px;
}

.trigger-area {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(90%, 500px);
  height: 175px;
  z-index: 1000;
}

.dots-container {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 60px;
}

.dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: white;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

</style>

<!-- CSS中间距是圆点中心到另一个中心的距离
vmotion中的距离设置的距离是在css基础上继续偏移 -->