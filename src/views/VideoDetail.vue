<template>
<div class="max-w-5xl mx-auto p-6 bg-white text-gray-800">
    <VideoPlayer />

    <VideoInfo />

    <div class="mt-4">
      <h3 class="text-lg font-semibold text-blue-700">简介</h3>
      <Motion
        :initial="{ opacity: 0, y: 20 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{ duration: 0.4 }"
      >
        <p class="text-gray-600 mt-2">
          {{ showMore ? longText : shortText }}
        </p>
        <button
          class="text-yellow-600 mt-2 hover:underline"
          @click="showMore = !showMore"
        >
          {{ showMore ? "收起" : "展开更多" }}
        </button>
      </Motion>
    </div>

    <CommentSection />
  </div>
</template>

<script>
import { Motion } from "motion-v";
import { ref } from "vue";


const showMore = ref(false);

</script>











<style scoped>
body {
  background: #fafafa;
}
</style>