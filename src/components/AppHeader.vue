<script setup lang="ts">
import { NDropdown } from 'naive-ui'
import { toRefs } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authSession, clearAuthSession, isAdminPreview } from '../utils/authSession'
const route = useRoute(),
  router = useRouter()
const { username, isLoggedIn } = toRefs(authSession)
const links = [
  { to: '/', label: '首页', en: 'INDEX' },
  { to: '/timeline', label: '时间线', en: 'TIMELINE' },
  { to: '/map', label: '地图', en: 'ATLAS' },
  { to: '/search', label: '搜索', en: 'SEARCH' }
]
const userMenu = [
  { label: '个人中心', key: 'profile' },
  { label: '切换账号', key: 'switch-account' },
  { label: '退出登录', key: 'logout' }
]
function selectUser(key: string) {
  if (key === 'profile') router.push('/profile')
  else if (key === 'switch-account') router.push({ name: 'Login', query: { switch: '1', redirect: route.fullPath } })
  else {
    clearAuthSession()
    router.push('/login')
  }
}
</script>
<template>
  <header class="site-header">
    <router-link class="brand" to="/" aria-label="ALBIREO 首页"
      ><span class="brand-mark" aria-hidden="true">A<span>／</span></span
      ><span>ALBIREO<small>PERSONAL VISUAL ARCHIVE</small></span></router-link
    >
    <nav aria-label="主导航">
      <router-link
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        :aria-current="route.path === link.to ? 'page' : undefined"
        ><span>{{ link.label }}</span
        ><small>{{ link.en }}</small></router-link
      >
    </nav>
    <div class="account">
      <span v-if="isAdminPreview" class="preview-label" title="管理员可预览私有作品">管理员预览</span>
      <n-dropdown
        v-if="isLoggedIn"
        :options="userMenu"
        trigger="click"
        @select="selectUser"
        ><button class="account-button" :aria-label="`${username}，账户菜单`">
          <span class="avatar">{{
            username.charAt(0).toUpperCase() || 'U'
          }}</span
          ><span class="username">{{ username }}</span
          ><span aria-hidden="true">⌄</span>
        </button></n-dropdown
      ><router-link
        v-else
        class="login-link"
        :to="{ name: 'Login', query: { redirect: route.fullPath } }"
        >登录 <span aria-hidden="true">↗</span></router-link
      >
    </div>
  </header>
</template>
<style scoped>
.site-header {
  height: var(--header-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 40px;
  padding: 0 4.5%;
  border-bottom: 1px solid var(--line);
  background: var(--bg);
  position: relative;
  z-index: 30;
}
.brand {
  display: flex;
  gap: 13px;
  align-items: center;
  font-size: 24px;
  font-weight: 750;
  letter-spacing: 3px;
  flex-shrink: 0;
}
.brand small {
  display: block;
  font: 8px/1.6 var(--mono);
  letter-spacing: 1.4px;
  color: var(--muted);
}
.brand-mark {
  color: var(--accent-warm);
  font: bold 43px/1 Arial;
  letter-spacing: -9px;
  transform: skewX(-7deg);
  margin-right: 6px;
}
.brand-mark span {
  color: var(--accent);
  font-weight: 400;
}
nav {
  display: flex;
  height: 100%;
  gap: 32px;
  margin-left: auto;
}
nav a {
  min-width: 58px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  font-size: 14px;
  position: relative;
}
nav small {
  font: 10px var(--mono);
  letter-spacing: 1px;
  color: var(--muted);
}
nav a[aria-current] {
  color: var(--accent-warm);
}
nav a[aria-current]:after {
  content: '';
  position: absolute;
  bottom: 0;
  width: 24px;
  height: 3px;
  background: linear-gradient(
    90deg,
    var(--accent-warm) 0 16px,
    transparent 16px 20px,
    var(--accent) 20px
  );
}
nav a:hover {
  color: var(--accent);
}
.login-link:hover,
.account-button:hover {
  color: var(--accent);
}
.account {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 25px;
  border-left: 1px solid var(--line);
}
.preview-label {
  font-size: 11px;
  color: var(--accent-warm);
  white-space: nowrap;
}
.login-link,
.account-button {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 44px;
  font-size: 13px;
  background: transparent;
  border: 0;
  color: var(--text);
}
.avatar {
  background: var(--surface-raised);
  color: var(--accent);
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
}
.username {
  max-width: 90px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
@media (max-width: 1000px) {
  .site-header {
    gap: 20px;
  }
  nav {
    gap: 20px;
  }
  .username {
    display: none;
  }
  .account {
    padding-left: 15px;
  }
}
@media (max-width: 700px) {
  .site-header {
    padding: 14px 24px 0;
    flex-wrap: wrap;
    gap: 8px;
    align-content: space-between;
  }
  .brand {
    font-size: 20px;
  }
  .brand-mark {
    font-size: 32px;
  }
  .brand small {
    font-size: 7px;
  }
  .account {
    margin-left: auto;
    padding-left: 0;
    border: 0;
    order: 1;
  }
  nav {
    order: 2;
    width: 100%;
    height: 48px;
    justify-content: space-between;
    gap: 12px;
    margin: 0;
  }
  nav a {
    min-width: 44px;
    font-size: 13px;
  }
  nav small {
    font-size: 9px;
  }
}
</style>
