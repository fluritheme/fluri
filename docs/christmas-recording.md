# Recording the Christmas workshop

Open [the Christmas workshop](https://fluri.xyz/christmas/), a fixed 9:16 scene using `@fluritheme/fluri` and its Christmas plugin. The entire workshop remains visible: snowfall, cabin, letter, gift, snowplough lane, and a dedicated snowman garden. No action scrolls or navigates the page.

## Record on your PC, then crop to a reel

1. Open [clean recording view](https://fluri.xyz/christmas/?record=1) on your PC. A centered 9:16 frame fits the browser height. The controls and surrounding instructions are hidden.
2. Use fullscreen if desired. Start your screen recorder and press **R** to restart the effects.
3. Record one 36-second loop. In your editor, crop to the center Christmas panel and export at 1080 × 1920. On a landscape PC viewport, clean view fills the viewport height; the crop width is the recorded viewport height × 9 ÷ 16.
4. Add licensed music and trim as desired. The website itself has no audio and does not request camera, microphone, or recording permissions.

The same scene fits small browsers automatically. You do not need device emulation or the old portrait toggle. Existing `?portrait=1` links still open the fixed scene. **H** toggles the controls. **Escape** shows them. **R** restarts. **Space** pauses or continues when focus is outside a button or link. Show the controls before entering fullscreen where supported, then hide them before recording. Fullscreen or resizing can resize the scene; restart your take after choosing your final recording dimensions.

## The automatic 36-second loop

| Time               | Action                                                                  |
| ------------------ | ----------------------------------------------------------------------- |
| 0 seconds          | Snow is already settled; live flakes and Christmas lights run.          |
| 2.5 seconds        | A small wind gust passes.                                               |
| 5 seconds          | The letter opens.                                                       |
| 9 seconds          | The gift opens with real Fluri sparkles.                                |
| 13 seconds         | The snowplough clears real accumulated snow from its lane.              |
| 18, 20, 22 seconds | Three real snowballs appear in the garden.                              |
| 25 seconds         | The garden resets its loose balls and builds a real three-ball snowman. |
| 30 seconds         | A last sparkle of Christmas.                                            |
| 36 seconds         | The letter, gift, actors, and snow reset for the next take.             |

Snow, snowballs, snowman assembly, gusts, sparkles, and the plough use the actual package. Letter and gift openings are ordinary website transitions. Severe frame delays can extend playback slightly. Hidden tabs suspend the sequence without jumping ahead. Reduced-motion visitors get a static workshop until they explicitly choose **Play effects**.

## Play manually

Click the letter seal, unwrap the gift, or send the plough. **Roll a snowball**, **Build a snowman**, and **Fresh snow** operate the garden. Pointer brushing and the package’s Shift-drag snowball gesture work on actual accumulated snow. Manual actions pause the automatic sequence so it does not override your interaction; press **Play effects** to continue. The scene stays in place throughout.

## Customize

- Structure and copy: `apps/website/christmas/index.html`.
- Colors and fixed-frame layout: `apps/website/src/christmas.css`.
- Fluri configuration, automatic actions, and controls: `apps/website/src/christmas-experience.ts`.
- Original cabin image: `apps/website/public/art/christmas-cabin.jpg`.

The page builds and deploys with the existing website. Preview at `http://127.0.0.1:4173/christmas/` after building and starting `pnpm preview`.

## Artwork

The original cabin image was generated with the built-in image-generation tool and encoded to JPEG. Prompt: “Premium editorial Christmas hero photograph; a tactile miniature alpine cabin, warm amber windows, snow-laden roof, an evergreen tree with warm fairy lights and restrained crimson and gold ornaments, wrapped gifts in uneven fresh snow, deep evergreen dusk, rich filmic realism. Portrait composition. No text, logo, watermark, UI, or cartoon characters.”
