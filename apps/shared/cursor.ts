import './cursor.css';
// A precise desktop cursor, with native input and touch behavior kept available.
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const pointer = document.createElement('div');
pointer.className = 'custom-pointer';
pointer.setAttribute('aria-hidden', 'true');
pointer.hidden = true;
const pointerArrow = document.createElement('span');
pointerArrow.textContent = '↗';
pointer.append(pointerArrow);
document.body.append(pointer);
let pointerFrame: number | undefined,
  pointX = 0,
  pointY = 0;
function hidePointer(): void {
  pointer.hidden = true;
  document.documentElement.classList.remove('custom-cursor');
  if (pointerFrame !== undefined) {
    cancelAnimationFrame(pointerFrame);
    pointerFrame = undefined;
  }
}
document.addEventListener(
  'pointermove',
  (event) => {
    if (!finePointer.matches || event.pointerType === 'touch') {
      hidePointer();
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input,textarea,select,[contenteditable=true]')) {
      hidePointer();
      return;
    }
    pointX = event.clientX;
    pointY = event.clientY;
    pointer.dataset.interactive = String(
      !!target?.closest('a,button:not(:disabled),[role=button]'),
    );
    pointer.hidden = false;
    document.documentElement.classList.add('custom-cursor');
    if (pointerFrame === undefined)
      pointerFrame = requestAnimationFrame(() => {
        pointer.style.transform = `translate3d(${pointX - 21}px,${pointY - 21}px,0)`;
        pointerFrame = undefined;
      });
  },
  { passive: true },
);
document.addEventListener('pointerleave', hidePointer);
window.addEventListener('blur', hidePointer);
finePointer.addEventListener('change', hidePointer);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Tab') hidePointer();
});

export {};
