# Christmas website

[fluri.xyz/christmas](https://fluri.xyz/christmas/) is a full-width, responsive Christmas website. The page has a hero, a letter, a gift, a snowman garden, and a snowplough lane. There is no portrait frame, production copy, numbered exhibit labels, or automatic scrolling.

The actual `@fluritheme/fluri` package provides snowfall, accumulation, Christmas lights, gusts, sparkles, snowballs, snowman assembly, and snowplough physics. The website supplies the letter and gift transitions. These effects repeat in a 36-second sequence while the page is visible. A hidden tab suspends playback, and reduced-motion visitors can explicitly start it with **Let it snow** in the header.

## Interactions

Open the letter seal or gift, choose **Snowball**, **Snowman**, or **Reset** in the garden, or send the plough with **Clear the snow**. These actions pause the sequence so it does not interrupt the interaction. Resume with the header snow button. Manual page scrolling works normally; the automatic sequence never moves the page.

## Recording

Record the website in a normal PC browser, then choose the crop in your editor. There is no forced aspect ratio. **R** restarts effects. **Space** pauses or resumes when focus is outside a link or button. **Escape** reveals the optional restart/fullscreen controls and **H** hides or shows them. The extra controls are hidden initially, including on older `?record=1` or `?portrait=1` links. The regular navigation and interaction buttons remain visible. The website does not record your screen or request camera or microphone access; add licensed music separately if desired.

## Customize

- Content: `apps/website/christmas/index.html`.
- Layout and colors: `apps/website/src/christmas.css`.
- Package configuration and sequence: `apps/website/src/christmas-experience.ts`.
- Cabin image: `apps/website/public/art/christmas-cabin.jpg`.

Preview at `http://127.0.0.1:4173/christmas/` after building the website and starting `pnpm preview`.

## Artwork

The original cabin image was generated with the built-in image-generation tool and encoded to JPEG. Prompt: “Premium editorial Christmas hero photograph; a tactile miniature alpine cabin, warm amber windows, snow-laden roof, an evergreen tree with warm fairy lights and restrained crimson and gold ornaments, wrapped gifts in uneven fresh snow, deep evergreen dusk, rich filmic realism. Portrait composition. No text, logo, watermark, UI, or cartoon characters.”
