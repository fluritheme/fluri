# Fluri integration examples

These runnable applications use the actual workspace packages and the same engine as the playground. Install workspace dependencies and build the packages first:

```sh
pnpm install --frozen-lockfile
pnpm --filter @fluritheme/fluri build
pnpm --filter @fluritheme/fluri-react build
```

| Example            | Development command                        | Local address           | Behavior                                                        |
| ------------------ | ------------------------------------------ | ----------------------- | --------------------------------------------------------------- |
| Vanilla TypeScript | `pnpm --filter @fluri/example-vanilla dev` | `http://127.0.0.1:5200` | Core initialization, live controls, and cleanup                 |
| React              | `pnpm --filter @fluri/example-react dev`   | `http://127.0.0.1:5201` | Hook lifecycle, state changes, and mount/unmount                |
| Next.js App Router | `pnpm --filter @fluri/example-next dev`    | `http://127.0.0.1:5202` | Server-rendered page, client hydration, navigation, and cleanup |
| Vue                | `pnpm --filter @fluri/example-vue dev`     | `http://127.0.0.1:5203` | Reactive configuration, mounted lifecycle, and unmount cleanup  |

Run `pnpm build:examples` to typecheck and build all four examples. `pnpm test:frameworks` verifies actual Next.js hydration/navigation and Vue reactive lifecycle across the configured Playwright engines. The regular browser suite includes the React Strict Mode fixture, core engine, playground, and raster/physics checks.

The examples require modern browsers. The Next.js production example is built using `next build`; start it with `pnpm --filter @fluri/example-next start`. The other examples produce static `dist/` directories. No remote fonts, API credentials, or fake service integrations are required.
