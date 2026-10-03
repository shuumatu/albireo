import bay960 from '../assets/hero/panorama-1-960h.webp?url'
import bay1440 from '../assets/hero/panorama-1-1440h.webp?url'
import bay1920 from '../assets/hero/panorama-1-1920h.webp?url'
import mountain960 from '../assets/hero/panorama-2-960h.webp?url'
import mountain1440 from '../assets/hero/panorama-2-1440h.webp?url'
import mountain1920 from '../assets/hero/panorama-2-1920h.webp?url'
import stars960 from '../assets/hero/panorama-3-960h.webp?url'
import stars1440 from '../assets/hero/panorama-3-1440h.webp?url'
import stars1920 from '../assets/hero/panorama-3-1920h.webp?url'
import river960 from '../assets/hero/panorama-4-960h.webp?url'
import river1440 from '../assets/hero/panorama-4-1440h.webp?url'
import river1920 from '../assets/hero/panorama-4-1920h.webp?url'
import night960 from '../assets/hero/panorama-5-960h.webp?url'
import night1440 from '../assets/hero/panorama-5-1440h.webp?url'
import night1920 from '../assets/hero/panorama-5-1920h.webp?url'

import type { BackgroundSlide } from '../types/background'

// Keep every panorama's full horizontal field of view. Heights correspond to
// the generated image's pixel height, not a width-based srcset descriptor.
export const heroSlides: BackgroundSlide[] = [
  {
    id: 'bay',
    src: bay1920,
    title: '海湾的夜色',
    type: '摄影作品',
    width: 8731,
    height: 2160,
    sources: [
      { height: 960, src: bay960 },
      { height: 1440, src: bay1440 },
      { height: 1920, src: bay1920 }
    ]
  },
  {
    id: 'mountain',
    src: mountain1920,
    title: '雪线之上',
    type: '摄影作品',
    width: 8624,
    height: 2160,
    sources: [
      { height: 960, src: mountain960 },
      { height: 1440, src: mountain1440 },
      { height: 1920, src: mountain1920 }
    ]
  },
  {
    id: 'stars',
    src: stars1920,
    title: '星野记录',
    type: '摄影作品',
    width: 8879,
    height: 2160,
    sources: [
      { height: 960, src: stars960 },
      { height: 1440, src: stars1440 },
      { height: 1920, src: stars1920 }
    ]
  },
  {
    id: 'river',
    src: river1920,
    title: '冬日河岸',
    type: '摄影作品',
    width: 12963,
    height: 2160,
    sources: [
      { height: 960, src: river960 },
      { height: 1440, src: river1440 },
      { height: 1920, src: river1920 }
    ]
  },
  {
    id: 'night',
    src: night1920,
    title: '山野的长夜',
    type: '摄影作品',
    width: 5092,
    height: 2160,
    sources: [
      { height: 960, src: night960 },
      { height: 1440, src: night1440 },
      { height: 1920, src: night1920 }
    ]
  }
]
