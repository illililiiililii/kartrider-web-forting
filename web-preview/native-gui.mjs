// The frame pixels and UVs come from rhoOut/gui/frame/ui_01.png and frame.xml.
// Canvas only stretches source pixels; it paints no replacement shapes or colors.
const atlas = new Image();
atlas.src = './assets/ui/gui/frame/ui_01.png';

function paint(canvas) {
  const host = canvas.parentElement;
  const w = Math.round(host.clientWidth), h = Math.round(host.clientHeight);
  if (!w || !h || !atlas.complete || !atlas.naturalWidth) return;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const draw = (sx, sy, sw, sh, x, y, dw, dh) => {
    if (dw > 0 && dh > 0) ctx.drawImage(atlas, sx, sy, sw, sh, x, y, dw, dh);
  };
  if (canvas.dataset.frame === 'button') {
    // DefaultStaticButton.Normal: caption, sides, bottom, client.
    draw(74, 14, 1, 1, 3, 3, w - 6, h - 6);
    draw(71, 12, 3, 3, 0, 0, 3, 3);
    draw(74, 12, 3, 3, 3, 0, w - 6, 3);
    draw(77, 12, 3, 3, w - 3, 0, 3, 3);
    draw(71, 16, 3, 3, 0, 3, 3, h - 6);
    draw(77, 16, 3, 3, w - 3, 3, 3, h - 6);
    draw(71, 20, 3, 3, 0, h - 3, 3, 3);
    draw(74, 20, 3, 3, 3, h - 3, w - 6, 3);
    draw(77, 20, 3, 3, w - 3, h - 3, 3, 3);
    return;
  }
  // DefaultCaptionWindow.Activated: captionUV, leftUV, rightUV,
  // bottomUV and clientUV from the original XML.
  draw(57, 6, 4, 2, 5, 33, w - 10, h - 57);
  draw(0, 0, 7, 33, 0, 0, 7, 33);
  draw(7, 0, 20, 33, 7, 0, w - 14, 33);
  draw(27, 0, 7, 33, w - 7, 0, 7, 33);
  draw(51, 0, 5, 5, 0, 33, 5, h - 57);
  draw(56, 0, 5, 5, w - 5, 33, 5, h - 57);
  draw(35, 0, 5, 24, 0, h - 24, 5, 24);
  draw(40, 0, 5, 24, 5, h - 24, w - 10, 24);
  draw(45, 0, 5, 24, w - 5, h - 24, 5, 24);
}

const observer = new ResizeObserver(entries => entries.forEach(entry => paint(entry.target.querySelector(':scope > .native-frame-canvas'))));
function mount() {
  document.querySelectorAll('[data-native-frame]').forEach(host => {
    if (host.querySelector(':scope > .native-frame-canvas')) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'native-frame-canvas';
    canvas.dataset.frame = host.dataset.nativeFrame;
    canvas.setAttribute('aria-hidden', 'true');
    host.prepend(canvas);
    observer.observe(host);
    paint(canvas);
  });
}
atlas.addEventListener('load', mount);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
else mount();
