# Contributing

TerraDiagnosis（地脉·镜）is an open-source 3D terrain sandbox for worldbuilding. Contributions welcome.

## Dev setup

```bash
git clone https://github.com/David-coder-hnu/hackerson.git
cd hackerson
npm install
npm run dev        # → http://localhost:5173
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript check + Vite production build |
| `npm test` | Run vitest test suite |
| `npm run lint` | ESLint check |
| `npm run preview` | Preview production build locally |

## Code structure

```
src/
├── components/     # React UI components
├── render/         # GLSL shaders (TerrainMaterial, WaterMaterial)
├── simulation/     # Web Worker simulation engine
│   ├── worker.ts   # Main worker: hydrology + climate + Köppen + Holdridge
│   ├── geo.ts      # Planetary coordinates + climate parameters
│   ├── koppen.ts   # Köppen-Geiger classification (30 subtypes)
│   ├── biome.ts    # Holdridge life zones + WRB soil inference + plant DB
│   └── knowledge.ts # Wildlife, minerals, city potential lookup
├── store/          # Zustand state management
├── presets/        # Procedural terrain generators (4 presets)
├── share/          # URL encode/decode for planet sharing
└── types/          # TypeScript type definitions
知识库/              # 14-module Chinese geography knowledge base
docs/               # Design docs, CEO plan, test plan
```

## Code style

- TypeScript strict mode (noUnusedLocals, noUnusedParameters)
- No comments by default — only add one when the WHY is non-obvious
- Single quotes, semicolons required
- One React component per file

## Tests

Tests use [Vitest](https://vitest.dev/). Core modules covered:

- `src/__tests__/brush.test.ts` — brush operations (raise/lower/flatten/smooth/glacier)
- `src/__tests__/d8.test.ts` — D8 hydrology (flow direction, accumulation, lakes)
- `src/__tests__/share.test.ts` — URL codec round-trip

```bash
npm test              # run all tests
npx vitest --watch    # watch mode
```

## PR checklist

- [ ] TypeScript compiles: `npx tsc -b --noEmit`
- [ ] Tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] No unrelated changes in diff
