# Getting started

Install `@themes/fluri` and call `createWeather()` after the body exists. Fluri has no backend, user account, or required service credentials.

```ts
import { createWeather } from '@themes/fluri';
const weather = createWeather({ autoStart: true, preset: 'gentle-snow' });
// At teardown:
weather.destroy();
```

For best results, mark intentional surfaces with `data-weather-surface` and choose `dom.detection: 'explicit'`. Exclude sensitive areas with `data-weather-ignore`. Snowballs and decorative actors are opt-in.

## Scoped component

```ts
const container = document.querySelector<HTMLElement>('#winter-scene');
if (container) {
  const weather = createWeather({ container, dom: { detection: 'explicit' } });
  weather.start();
}
```

Canvas coordinates remain viewport-relative and rendering is clipped to the container. Fluri does not change the container's layout or positioning. Destroy and recreate the engine to change its container.

## Vanilla HTML

Bundle this entry with your normal browser build tool and include it using a module script:

```ts
import { createWeather } from '@themes/fluri';
const weather = createWeather();
weather.start();
window.addEventListener('pagehide', () => weather.destroy(), { once: true });
```

The npm output is ESM and imports its declared dependency. It is intended for a bundler or correctly configured import map; it is not an unbundled CDN script tag.

## React / Next.js

Install `@themes/fluri-react` with `react` and `@themes/fluri`. In Next.js, use a client component:

```tsx
'use client';
import { Fluri } from '@themes/fluri-react';
import { christmasPack } from '@themes/fluri/christmas';
export default function Winter() {
  return (
    <Fluri
      options={{ preset: 'christmas-night' }}
      onReady={(weather) => weather.use(christmasPack({ lights: true }))}
    />
  );
}
```

The adapter creates its instance in an effect and destroys it on cleanup. For imperative controls, `useFluri(options, onReady?)` returns a ref containing the controller after mount.

## Vue

No wrapper is required; pair core lifecycle with Vue lifecycle hooks:

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { createWeather, type WeatherController } from '@themes/fluri';
let weather: WeatherController | undefined;
onMounted(() => {
  weather = createWeather();
  weather.start();
});
onUnmounted(() => weather?.destroy());
</script>
<template><nav data-weather-surface>Winter navigation</nav></template>
```

## Svelte

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { createWeather } from '@themes/fluri';
  onMount(() => {
    const weather = createWeather();
    weather.start();
    return () => weather.destroy();
  });
</script>
<nav data-weather-surface>Winter navigation</nav>
```

These lifecycle patterns use the framework-neutral core. Dedicated Vue/Svelte packages are not required or shipped.

## Local workspace

Run `pnpm install`, then `pnpm dev`. The playground runs at port 5173; `pnpm dev:website` runs the website at port 5174. Build with `pnpm build`; `pnpm preview` serves the combined production website/playground on port 4173.

## Additional runnable examples

Workspace examples live in `examples/vanilla-ts`, `examples/react`, `examples/nextjs`, and `examples/vue`. The optional Next/Vue browser matrix is enabled with `FLURI_FRAMEWORK_TESTS=1 pnpm test:browser`. Those development dependencies must be fully installed first. Use `pnpm build:examples` and `pnpm test:frameworks` for the runnable integration applications. Core, React-adapter, and playground browser verification run without those servers by default.
