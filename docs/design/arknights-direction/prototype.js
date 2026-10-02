const photos = [
  { id: 4, title: '海湾的夜色', description: '城市的灯光，在水面上延续。', keywords: '海边 夜景 夜色 城市 桥 海湾', alt: '夜色中的海湾与灯火通明的桥梁' },
  { id: 2, title: '雪线之上', description: '在山的轮廓里，看到冬天的呼吸。', keywords: '雪山 山 冬天 白色 蓝天', alt: '蓝色天空下覆盖白雪的山峰' },
  { id: 5, title: '星野记录', description: '在地平线的另一端，与星光相遇。', keywords: '星空 星空摄影 夜色 星野 银河', alt: '夜空中的银河与地平线上的灯光' },
  { id: 1, title: '冬日河岸', description: '水流继续向前，冬天停留在岸边。', keywords: '冬天 雪 河流 水 河岸', alt: '被积雪覆盖的河岸与水中的石阶' },
  { id: 3, title: '山野的长夜', description: '山的剪影之上，是漫长而安静的夜。', keywords: '夜色 星空 黑夜 山野 银河', alt: '山峦剪影上方的星空' }
];
const byId = id => document.getElementById(id);
const imagePath = p => `./assets/photo-${p.id}.webp`;
const number = index => String(index + 1).padStart(3, '0');
const detail = byId('detail');
let currentPhoto = 0;
let mapPhoto = 0;
let returnFocus = null;
let slideRequest = 0;
let activeSlide = 0;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const hoverPointer = window.matchMedia('(any-hover: hover)');
const imageCache = new Map();
function readyPhoto(index) {
  if (!imageCache.has(index)) {
    const image = new Image();
    image.src = imagePath(photos[index]);
    imageCache.set(index, image.decode().catch(() => { imageCache.delete(index); throw new Error('image unavailable'); }));
  }
  return imageCache.get(index);
}

function card(index) {
  const p = photos[index];
  const button = document.createElement('button');
  button.className = 'media-card';
  button.setAttribute('aria-label', `查看作品：${p.title}`);
  button.innerHTML = `<div class="photo"><img src="${imagePath(p)}" alt="${p.alt}" loading="lazy" width="640" height="480"></div><div class="media-caption"><strong>${p.title}</strong><span>PHOTOGRAPH / ${number(index)}</span></div>`;
  button.addEventListener('click', () => openDetail(index));
  return button;
}
function populate(id, indices) { byId(id).replaceChildren(...indices.map(card)); }
populate('home-gallery', [0, 1, 2]);
populate('night-gallery', [0, 2, 4]);
populate('winter-gallery', [1, 3]);
populate('search-gallery', [0, 1, 2, 3, 4]);

function renderDetail() {
  const p = photos[currentPhoto];
  byId('detail-image').src = imagePath(p);
  byId('detail-image').alt = p.alt;
  byId('detail-title').textContent = p.title;
  byId('detail-description').textContent = p.description;
  byId('detail-index').textContent = number(currentPhoto);
  byId('previous-image').disabled = currentPhoto === 0;
  byId('next-image').disabled = currentPhoto === photos.length - 1;
  byId('detail-image').parentElement.classList.remove('is-expanded');
  byId('expand-image').setAttribute('aria-pressed', 'false');
  byId('expand-image').textContent = '放大画面 ＋';
}
function openDetail(index) {
  returnFocus = document.activeElement;
  currentPhoto = index;
  renderDetail();
  detail.showModal();
  document.body.style.overflow = 'hidden';
  byId('close-detail').focus();
}
byId('close-detail').addEventListener('click', () => detail.close());
detail.addEventListener('close', () => {
  document.body.style.overflow = '';
  returnFocus?.focus();
});
byId('previous-image').addEventListener('click', () => { if (currentPhoto > 0) { currentPhoto--; renderDetail(); } });
byId('next-image').addEventListener('click', () => { if (currentPhoto < photos.length - 1) { currentPhoto++; renderDetail(); } });
detail.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' && currentPhoto > 0) { currentPhoto--; renderDetail(); }
  if (event.key === 'ArrowRight' && currentPhoto < photos.length - 1) { currentPhoto++; renderDetail(); }
});
byId('expand-image').addEventListener('click', event => {
  const expanded = byId('detail-image').parentElement.classList.toggle('is-expanded');
  event.currentTarget.setAttribute('aria-pressed', String(expanded));
  event.currentTarget.textContent = expanded ? '还原画面 −' : '放大画面 ＋';
});
async function selectSlide(index) {
  const request = ++slideRequest;
  if (index === activeSlide) return;
  try { await readyPhoto(index); } catch { return; }
  if (request !== slideRequest) return;
  const p = photos[index];
  const front = byId('hero-image');
  front.getAnimations().forEach(animation => animation.cancel());
  byId('hero-back').src = front.src;
  byId('hero-image').src = imagePath(p);
  byId('hero-image').alt = p.alt;
  activeSlide = index;
  if (!reducedMotion.matches) front.animate([{opacity:0},{opacity:1}],{duration:280,easing:'ease-out'});
  byId('hero-name').textContent = p.title;
  byId('hero-index').textContent = number(index);
  byId('slide-number').textContent = String(index + 1).padStart(2, '0');
  document.querySelector('.frame-count').setAttribute('aria-label', `当前第 ${index + 1} 张，共 ${photos.length} 张`);
  document.querySelectorAll('[data-slide]').forEach(item => item.setAttribute('aria-pressed', String(Number(item.dataset.slide) === index)));
}
document.querySelectorAll('[data-slide]').forEach(button => {
  const select = () => selectSlide(Number(button.dataset.slide));
  button.addEventListener('pointerenter', event => { if (hoverPointer.matches && event.pointerType !== 'touch') select(); });
  button.addEventListener('focus', select);
  button.addEventListener('click', select);
});
document.querySelector('.selector-dock').addEventListener('pointerenter', () => {
  // Warm only the next likely image; the actual hovered frame always takes priority.
  readyPhoto((activeSlide + 1) % photos.length).catch(() => {});
});

function selectMap(index) {
  mapPhoto = index;
  byId('map-photo').src = imagePath(photos[index]);
  byId('map-photo').alt = photos[index].alt;
  byId('map-title').textContent = photos[index].title;
  document.querySelectorAll('[data-map]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.map) === index)));
}
photos.slice(0, 3).forEach((p, index) => {
  const button = document.createElement('button');
  button.className = 'map-list-item';
  button.dataset.map = String(index);
  button.setAttribute('aria-pressed', String(index === 0));
  button.innerHTML = `<img src="${imagePath(p)}" alt=""><span>${p.title}<small>GROUP / ${number(index)}</small></span>`;
  byId('map-list').append(button);
});
document.querySelectorAll('[data-map]').forEach(button => button.addEventListener('click', () => selectMap(Number(button.dataset.map))));
byId('map-detail').addEventListener('click', () => openDetail(mapPhoto));

byId('search-form').addEventListener('submit', event => {
  event.preventDefault();
  const query = byId('search-input').value.trim();
  const indices = photos.map((p, i) => ({p, i})).filter(({p}) => !query || `${p.title} ${p.keywords}`.includes(query)).map(({i}) => i);
  populate('search-gallery', indices);
  byId('search-status').textContent = query ? `「${query}」 / ${indices.length} 个示例结果${indices.length ? '' : ' · 试试夜色、雪山或星空'}` : '全部示例 / 05';
});
byId('mobile-toggle').addEventListener('click', event => {
  const mobile = byId('site').classList.toggle('is-mobile');
  document.body.classList.toggle('preview-mobile', mobile);
  event.currentTarget.setAttribute('aria-pressed', String(mobile));
  event.currentTarget.textContent = mobile ? '桌面预览' : '手机预览';
});
byId('annotation-toggle').addEventListener('click', event => {
  const visible = document.body.classList.toggle('show-annotations');
  event.currentTarget.setAttribute('aria-pressed', String(visible));
  event.currentTarget.textContent = visible ? '隐藏装饰位置' : '查看装饰位置';
});
function navigate() {
  const hash = location.hash.slice(1) || 'home';
  const view = ['home', 'timeline', 'map', 'search'].includes(hash) ? hash : hash.startsWith('group-') ? 'timeline' : 'home';
  document.querySelectorAll('.view').forEach(section => section.hidden = section.id !== view);
  document.querySelectorAll('[data-route]').forEach(link => {
    if (link.dataset.route === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (hash === 'selected' || hash.startsWith('group-')) byId(hash)?.scrollIntoView({behavior:'auto'});
  else { window.scrollTo({top:0}); byId('main').focus({preventScroll:true}); }
}
document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  const href = link.getAttribute('href');
  if (href === '#main') { byId('main').focus(); return; }
  if (location.hash !== href) history.pushState(null, '', href);
  navigate();
}));
window.addEventListener('popstate', navigate);
window.addEventListener('hashchange', navigate);
navigate();
