# Recording the Christmas story

The [Christmas website](https://fluri.xyz/christmas/) is a live website using `@fluritheme/fluri` and its Christmas plugin. The scene contains original illustrative Christmas artwork and an interactive letter and gift; it is a showcase rather than a shop or booking service.

## Record a reel

1. Open [the clean recording view](https://fluri.xyz/christmas/?record=1). It starts automatically and repeats a 32-second story.
2. For a vertical reel, use a 390 × 844 or 432 × 768 browser viewport, or use the Portrait control to preview the narrow layout. [Portrait clean view](https://fluri.xyz/christmas/?record=1&portrait=1) centers a narrow website on a desktop; crop the side margins when editing.
3. Start your screen recorder, move the pointer away, and press **R** to restart at the first chapter. Capture one complete loop and trim the start and end in your editor.
4. Press **H** or **Escape** to bring the controls back. The control panel, pointer, and focus outlines on buttons are absent from the clean view until you interact. Normal keyboard focus remains accessible.

**R** replays. **H** toggles the controls. **Space** pauses or continues when focus is outside a link or button. Fullscreen is available through the toolbar where the browser supports it. User scrolling pauses the automatic tour. Hidden tabs suspend playback; return to the tab to continue without skipping the story. The website does not request microphone or camera access, record your screen, or add audio. Add licensed music in your video editor if desired.

## The 32-second sequence

| Time          | Scene                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| 0–8 seconds   | A snowy cabin and Christmas invitation                                       |
| 8–15 seconds  | A Christmas letter opens at 10 seconds                                       |
| 15–26 seconds | A gift opens at 17.5 seconds; the real Fluri snowplough starts at 21 seconds |
| 26–32 seconds | Closing message and fluri.xyz                                                |

Animation follows active browser time, so severe frame delays can extend the recording slightly. Each loop resets the letter, gift, snow actors, and accumulated profiles. Snow and the plough use the actual package physics, rather than a prerecorded video or imitation effect. People requesting reduced motion get a static, interactive page; **Play story** explicitly starts animation.

## Customize

- Page content and structure: `apps/website/christmas/index.html`.
- Colors, layout, gift and letter appearance: `apps/website/src/christmas.css`.
- Fluri configuration, tour sequence, and controls: `apps/website/src/christmas-experience.ts`.
- Cabin image: `apps/website/public/art/christmas-cabin.jpg`.

The story is built and deployed with the existing website. Preview locally at `http://127.0.0.1:4173/christmas/` after `pnpm build` and `pnpm preview`.

## Artwork

The cabin hero is an original image generated with the built-in image-generation tool, then encoded to JPEG for the website. Prompt: “Premium editorial Christmas hero photograph; a tactile miniature alpine cabin, warm amber windows, snow-laden roof, an evergreen tree with warm fairy lights and restrained crimson and gold ornaments, wrapped gifts in uneven fresh snow, deep evergreen dusk, rich filmic realism. Portrait composition. No text, logo, watermark, UI, or cartoon characters.”
