# Accessibility

`accessibility.reducedMotion` defaults to `respect`. When the visitor prefers reduced motion, Fluri does not schedule animation frames. `reduce` permits a substantially lower particle budget; `ignore` is an explicit integrator override. Avoid overriding visitor preferences without an intentional user-facing choice.

All effect canvases are presentation-only, inert, aria-hidden, pointer-transparent, and excluded from keyboard focus. Fluri preserves ordinary scrolling, clicks, and text selection; it does not capture pointers, take focus, or play audio. Only an accepted Shift snowball gesture suppresses browser text selection and native dragging until the gesture ends. The demo's draggable card uses capture only inside its own intentional interactive component.

`accessibility.controls: true` adds a native button with `aria-pressed` to pause/resume. You can instead build controls using the public lifecycle and trigger APIs. Snowballs require Shift + a held pointer by default. Provide explicit snowball/snowman/plough buttons for keyboard and touch users.

Use shallow piles and explicit decorative surfaces around important text. Test visual contrast on your actual site; do not rely on decorative effects to convey essential information. The playground supports keyboard tabs, native inputs, live status announcements, visible focus, reduced-motion styles, and a narrow-screen control drawer.

Fluri suspends in hidden documents. A user pause remains in effect when visibility returns. Destroy the engine on component unmount. Native modal focus management belongs to the browser and is preserved.
