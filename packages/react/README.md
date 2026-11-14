<div align="center">

<a href="https://winter.fluri.xyz/">
  <img src="https://winter.fluri.xyz/readme/banner.png" alt="Fluri — A little winter for the web." width="100%" />
</a>

# Fluri for React ❄️

**A React component and hook for interactive snowfall.**

DOM-aware snow accumulation. Playful interactions.<br />
A lifecycle that fits React and Next.js.

<a href="https://www.npmjs.com/package/@fluritheme/fluri-react"><img src="https://winter.fluri.xyz/readme/npm-downloads-react.svg" alt="npm downloads for @fluritheme/fluri-react over the last 30 days" height="24" /></a>

[Live playground](https://winter.fluri.xyz/playground/) · [Documentation](https://winter.fluri.xyz/docs/#frameworks) · [Preset showcase](https://winter.fluri.xyz/showcase/) · [GitHub](https://github.com/fluritheme/fluri/tree/main/packages/react)

</div>

---

`@fluritheme/fluri-react` connects the **Fluri snow animation engine** to your React lifecycle. It starts after mount, applies validated option updates, and destroys the instance during cleanup. React Strict Mode setup replay is supported.

The core stays framework independent. This adapter brings its snowfall, surface accumulation, snowballs, and optional Christmas decorations to React projects without managing the engine lifecycle yourself.

<img src="https://winter.fluri.xyz/readme/features.png" alt="Snow follows interface edges, responds to brushing, and supports adjustable snowfall and wind." width="100%" />

## Install

```sh
npm install @fluritheme/fluri @fluritheme/fluri-react
```

Peer dependencies: **React 18 or 19** and **`@fluritheme/fluri` ^0.2.0**. React DOM is not a dependency of the adapter. Package archives are also available in the [documentation](https://winter.fluri.xyz/docs/#quick-start).

## One component. A little winter.

```tsx
'use client';

import { Fluri } from '@fluritheme/fluri-react';

export function WinterAtmosphere() {
  return <Fluri options={{ preset: 'gentle-snow' }} />;
}
```

`<Fluri />` renders no React DOM. It starts the browser engine after mount and cleans up on unmount. For predictable accumulation, choose explicit detection and mark the surfaces you want to collect snow.

## Your own controls

```tsx
'use client';

import { useFluri } from '@fluritheme/fluri-react';

export function WinterCard() {
  const weather = useFluri({
    preset: 'gentle-snow',
    dom: { detection: 'explicit' },
  });

  return (
    <article data-weather-surface>
      <h1>A little winter.</h1>
      <button onClick={() => weather.current?.pause()}>Pause snow</button>
      <button onClick={() => weather.current?.resume()}>Resume snow</button>
    </article>
  );
}
```

The returned ref’s `current` is `null` until the mount effect runs. Access it inside event handlers or use `onReady` when the controller first becomes available.

## Optional Christmas effects ✨

```tsx
'use client';

import { Fluri } from '@fluritheme/fluri-react';
import { christmasPack } from '@fluritheme/fluri/christmas';

export function SeasonalPage() {
  return (
    <>
      <Fluri
        options={{ preset: 'christmas-night', dom: { detection: 'explicit' } }}
        onReady={(weather) => {
          weather.use(christmasPack({ lights: { warmth: 0.9 }, garlands: true }));
        }}
      />
      <nav data-weather-surface data-holiday-lights data-holiday-garland>
        A warmer welcome.
      </nav>
    </>
  );
}
```

The engine releases registered plugins when the instance is destroyed. `onReady` is available on both `<Fluri options={...} onReady={...} />` and `useFluri(options, onReady)`.

## Integration notes

- **Next.js:** use a client component. Imports and idle core controllers are safe during server rendering; the adapter starts after mount.
- **One owner per instance:** use one adapter for each intended effect scope rather than mounting duplicate full-page effects.
- **Stable containers:** keep the `container` element stable for an instance; remount the adapter to change it.
- **Runtime changes:** the adapter applies option patches after renders. Use the controller for imperative actions such as `trigger()`, `pause()`, and `clearAccumulation()`.
- **Considerate motion:** the core respects reduced-motion preferences by default, suspends in hidden tabs, and offers adaptive performance budgets. Test your own layout and target devices.

[Complete configuration](https://winter.fluri.xyz/docs/) · [API reference](https://winter.fluri.xyz/reference/api-reference.md) · [Browser limits](https://winter.fluri.xyz/reference/limitations.md)

## License

[Fluri Themes Commercial License 1.0](https://fluri.xyz/license/). Built by [Frantisek Gejdos](https://fluri.xyz/#founder).

## A little yeti (0.2.0)

```tsx
<Fluri
  options={{
    interactions: {
      snowballs: { enabled: true },
      snowman: { enabled: true },
      yeti: { enabled: true, size: 1, cooldown: 16 },
    },
  }}
/>
```

Mark a horizontal shelf with `data-weather-surface data-weather-yeti`. The optional visitor gathers real deposited snow, packs a ball, and tries to knock down a snowman on the same shelf. It respects reduced motion and pause. See the [yeti guide and preview](https://winter.fluri.xyz/reference/api-reference.md#yeti-visitor-020) and try [Yeti vs snowman](https://winter.fluri.xyz/playground/).

Production use requires the EUR 19 lifetime Fluri licence, covering unlimited personal and client websites and all current and future themes. Private non-production evaluation is permitted. Versions through 0.2.1 remain MIT.
