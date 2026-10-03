# 可复用背景展示与管理端接入

## 分层

- `src/types/background.ts`：不依赖 Vue 或内置素材的配置类型，可用作未来接口响应、管理端表单和预览数据的约定。
- `src/utils/backgroundImages.ts`：校验基本配置、去重、分档排序、按容器尺寸和 DPR 选图。
- `src/composables/useBackgroundSlideshow.ts`：解码、请求竞态、缓存、预加载、过渡和动态配置更新。每个实例拥有独立状态。
- `src/components/BackgroundSlideshow.vue`：通用画面容器，全景平移与生命周期管理；不包含首页标题、编号、选择器、推荐区跳转或静态图片导入。
- `src/components/FeaturedHero.vue`：首页外观，通过通用组件的作用域插槽呈现标题、选择器和编号。
- `src/utils/heroSources.ts`：现有五张背景的默认配置；仅首页 `mainPage.vue` 导入并传给 `FeaturedHero`。

管理端页面、上传接口和持久化尚未实现。本次完成展示能力复用和配置契约。两个前端是独立项目，尚未发布共享 npm 包；未来管理端预览可将上述通用文件提取到共享包，或以同一套配置预览访客端。

## 配置契约

最低配置只有稳定 `id` 和 `src`，支持相对 URL、HTTPS CDN URL 或上传预览用的 blob URL：

```ts
import type { BackgroundSlide } from '@/types/background'

const backgrounds: BackgroundSlide[] = [
  {
    id: 'photo-uuid',
    src: 'https://cdn.example.com/backgrounds/photo-v2.webp',
    title: '自定义背景',
    alt: '远处山脉与星空',
    type: '摄影作品',
    width: 8731,
    height: 2160,
    sources: [
      { height: 960, src: 'https://cdn.example.com/backgrounds/photo-v2-960.webp' },
      { height: 1440, src: 'https://cdn.example.com/backgrounds/photo-v2-1440.webp' },
      { height: 1920, src: 'https://cdn.example.com/backgrounds/photo-v2-1920.webp' }
    ]
  }
]
```

这里的 `@/` 仅表示项目源码目录；本仓库现有代码使用相对导入。图片分档必须是相同视野和比例的完整图片，`height` 为实际像素高度，可以乱序传入。缺少尺寸或分档时使用 `src`，不要求后台一开始就生成所有分档。组件不修改传入数据。

列表顺序即展示顺序，启用/禁用、权限、获取失败后的默认值策略由调用方决定。空列表明确表示不展示图片，不自动恢复内置素材。无效 ID、空 URL 和重复 ID 会被过滤；重复 ID 保留第一项。传入组件前仍应由 API 层完成完整的数据类型校验。

替换图片时保留 `id`，但应更新 URL 或版本查询参数以刷新浏览器缓存；只覆盖服务器同一路径内容不会通知组件刷新。blob URL 由创建它的调用方管理，结束预览或不再使用后再 revoke。

## 首页接入

```vue
<script setup lang="ts">
import { ref } from 'vue'
import FeaturedHero from './components/FeaturedHero.vue'
import { heroSlides } from './utils/heroSources'
import type { BackgroundSlide } from './types/background'

const backgrounds = ref<BackgroundSlide[]>(heroSlides)
// 将来真实接口成功后：backgrounds.value = response.backgrounds
</script>

<template>
  <FeaturedHero :slides="backgrounds" explore-target="selected" />
</template>
```

接口尚未定义，因此没有添加假接口、环境变量或固定的后端地址。

## 通用展示与管理预览

通用容器高度由调用方 CSS 决定。具名插槽支持 `empty` 和 `error`；默认作用域插槽可按自己的界面渲染选择器：

```vue
<BackgroundSlideshow
  :slides="backgrounds"
  :pan-enabled="false"
  :playback="{ preloadNext: false, transitionMs: 180 }"
  style="height: 360px"
  @change="onBackgroundChange"
  @error="onBackgroundError"
>
  <template #default="{ slides, current, active, busy, select }">
    <p>{{ current?.title }}</p>
    <button
      v-for="(slide, index) in slides"
      :key="slide.id"
      :aria-pressed="active === index"
      @click="select(index)"
    >{{ slide.title || slide.id }}</button>
    <span v-if="busy">载入中</span>
  </template>
  <template #empty>请添加背景图片</template>
  <template #error="{ retry }">
    图片无法加载 <button @click="retry">重试</button>
  </template>
</BackgroundSlideshow>
```

默认插槽还提供 `failure`、`hover(event, index)`、`cancelHover()`、`retry()`。组件 `ref` 暴露 `select(id)` 与 `retry()`；注意公开方法按稳定 ID 选择，插槽方法按当前列表索引选择。

`change` 在图片正式展示或当前图片元数据更新时发出，参数为当前配置；清空后为 `null`。`error` 只针对用户选择失败的图片，参数为该图片配置，邻图预加载失败不会触发用户错误。

播放配置及默认值：

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| transitionMs | 240 | 淡入时间；0 关闭过渡，系统减少动态效果也会关闭 |
| hoverDelayMs | 90 | 鼠标悬停确认时间 |
| preloadNext | true | 当前画面稳定后预加载一张邻图 |
| preloadDelayMs | 1200 | 邻图预加载延迟 |
| decodeTimeoutMs | 20000 | 加载与解码等待超时 |
| maxPixelRatio | 2 | 分档选择的 DPR 上限 |

缓存上限固定为三张，每次再次显示仍重新确认解码完成。所有时间单位均为毫秒。播放配置可响应式更新。

## 动态更新规则

- 配置异步到达后加载第一张；只有一张时不请求邻图。
- 重新排序根据 ID 保留当前或待选中的图片。
- 同 ID 更新 URL 时，保留旧画面和旧文案直到新图解码完成。
- 不同 ID 使用同一 URL 时复用已显示节点，同时更新 ID、文案和选择状态。
- 删除待选图片时优先保留仍存在的当前图片；删除当前图片后使用第一张。替换失败时保留旧画面，提供重试。
- 清空列表会立即取消过渡与请求、清空画面和错误状态；随后可再次传入配置。
- 多个组件并存时，选择、预加载、缓存和错误互相独立；没有全局图片 DOM ID。

## 验证

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:backgrounds
npm run build
```

浏览器测试使用 `tests/fixtures/background-slideshow.html` 的双实例预览页和拦截的外部图片响应，验证真实组件的异步配置、排序、URL 替换、待选项删除、清空后复用和多实例隔离；同时运行原首页加载回归。测试页不会进入生产首页或路由。

本轮结果：9 项单元测试通过；桌面、Pixel 7、减少动态效果三组浏览器回归共 46 项通过、2 项按设备条件跳过；Vue 类型检查与 Vite 生产构建通过。地图、视频既有大 chunk 提示仍存在。真实图片的首页桌面和手机截图已复核。
