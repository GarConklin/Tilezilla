/** Startup carousel — below Load-Screen.png art (3 slides + demo video). */

const SLIDES = [
  {
    src: '/img/below start screen 1-3.png',
    alt: 'Welcome to Tilezilla',
  },
  {
    src: '/img/below start screen 2-3.png',
    alt: 'How to play',
  },
  {
    src: '/img/below start screen 3-3.png',
    alt: 'Watch and learn',
    showPlay: true,
  },
];

const DEMO_VIDEO_SRC = '/img/Demo Play.mp4';

function encodeAssetPath(path) {
  return String(path || '')
    .split('/')
    .map((part, i) => (part === '' && i === 0 ? '' : encodeURIComponent(part)))
    .join('/');
}

export function initLoadScreenCarousel(root = document.getElementById('loadScreen')) {
  const viewport = root?.querySelector('[data-load-carousel-viewport]');
  const img = root?.querySelector('[data-load-carousel-slide]');
  const prevBtn = root?.querySelector('[data-load-carousel-prev]');
  const nextBtn = root?.querySelector('[data-load-carousel-next]');
  const playBtn = root?.querySelector('[data-load-carousel-play]');
  const videoLayer = document.getElementById('loadVideoLayer');
  const video = document.getElementById('loadDemoVideo');
  const videoClose = document.getElementById('loadVideoClose');

  if (!viewport || !img || !prevBtn || !nextBtn) return;

  let index = 0;

  function render() {
    const slide = SLIDES[index];
    img.src = encodeAssetPath(slide.src);
    img.alt = slide.alt || '';
    prevBtn.disabled = index <= 0;
    nextBtn.disabled = index >= SLIDES.length - 1;
    if (playBtn) {
      playBtn.hidden = !slide.showPlay;
    }
  }

  function go(delta) {
    const next = Math.max(0, Math.min(SLIDES.length - 1, index + delta));
    if (next === index) return;
    index = next;
    render();
  }

  function openVideo() {
    if (!videoLayer || !video) return;
    video.src = encodeAssetPath(DEMO_VIDEO_SRC);
    videoLayer.hidden = false;
    video.currentTime = 0;
    const playPromise = video.play();
    if (playPromise?.catch) playPromise.catch(() => {});
  }

  function closeVideo() {
    if (!videoLayer || !video) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
    videoLayer.hidden = true;
  }

  prevBtn.addEventListener('click', () => go(-1));
  nextBtn.addEventListener('click', () => go(1));
  playBtn?.addEventListener('click', openVideo);
  videoClose?.addEventListener('click', closeVideo);
  videoLayer?.addEventListener('click', (event) => {
    if (event.target === videoLayer) closeVideo();
  });

  document.addEventListener('keydown', (event) => {
    if (videoLayer && !videoLayer.hidden) {
      if (event.key === 'Escape') closeVideo();
      return;
    }
    if (event.key === 'ArrowLeft') go(-1);
    if (event.key === 'ArrowRight') go(1);
  });

  render();
}
