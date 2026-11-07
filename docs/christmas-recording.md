# Minimal Christmas website

[fluri.xyz/christmas](https://fluri.xyz/christmas/) shows a blurred Christmas photograph, real Fluri snowfall, and exactly three lines of visible copy:

> My Website
> has now snow.
> fluri.xyz

The layout fills the browser and centers the message on desktop and mobile. There are no visible controls, automatic scrolling, forced recording frames, or additional sections. Snowfall starts automatically unless reduced motion is requested. **Space** explicitly starts or pauses the animation when focus is outside the link. Hidden tabs suspend the engine, and leaving the page releases it. The page adds no analytics reporting.

Record it with your normal screen recorder, then crop in your editor. The page does not record your screen or request camera/microphone permissions. Existing `?record=1` links display the same page.

## Customize

- Text: `apps/website/christmas/index.html`.
- Blur, overlay, layout, and type: `apps/website/src/christmas.css`.
- Actual package snowfall: `apps/website/src/christmas-experience.ts`.
- Background image: `apps/website/public/art/christmas-cabin.jpg`.

## Artwork

The existing original cabin image was generated with the built-in image-generation tool and encoded to JPEG. Prompt: “Premium editorial Christmas hero photograph; a tactile miniature alpine cabin, warm amber windows, snow-laden roof, an evergreen tree with warm fairy lights and restrained crimson and gold ornaments, wrapped gifts in uneven fresh snow, deep evergreen dusk, rich filmic realism. Portrait composition. No text, logo, watermark, UI, or cartoon characters.” Blur is applied with CSS at runtime.
