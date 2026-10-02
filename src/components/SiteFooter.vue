<template>
  <footer class="site-footer">
    <router-link to="/" class="footer-brand">ALBIREO<span>／</span></router-link
    ><span>记录世界，也记录自己。</span
    ><span class="copyright"
      >VISUAL ARCHIVE © {{ new Date().getFullYear() }}</span
    >
  </footer>
</template>
<style scoped>
.site-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 36px 8%;
  border-top: 1px solid var(--line);
  font-size: 12px;
  color: var(--muted);
}
.footer-brand {
  font-size: 24px;
  font-weight: 750;
  letter-spacing: 3px;
  color: var(--text);
}
.footer-brand span {
  color: var(--accent);
}
.copyright {
  font: 10px var(--mono);
  letter-spacing: 1px;
}
@media (max-width: 700px) {
  .site-footer {
    padding: 28px 24px;
    flex-wrap: wrap;
  }
  .copyright {
    width: 100%;
  }
}
</style>
