# AGENTS.md - LabelPrint Maintainer Guide

This file records project conventions for future coding agents and maintainers.
Keep it hardware-neutral: public documentation should describe capabilities and
extension points, not private device notes.

## Project Goal

LabelPrint is a parameterized thermal-label design and printing system:

1. Design templates in a visual, millimetre-precise web editor.
2. Fill templates with values through the UI or REST API.
3. Preview and print through a server-side pipeline that can support multiple
   output protocols.
4. Run locally for design and as a headless web-managed service on Linux.

The project intentionally keeps authentication out of scope for now; it is meant
for trusted local-network deployments unless an application owner adds auth.

## Architecture

One model drives both preview and printing:

```text
Template JSON + values
        |
        v
JSON-to-SVG compiler       packages/shared/compiler.ts
        |
        v
Server rasterizer          packages/server/render
        |
        v
Protocol adapter           packages/server/protocol
        |
        v
Transport adapter          file | device | cups | network
```

The designer and server share the same JSON-to-SVG compiler. This is the main
WYSIWYG guarantee: avoid adding a separate preview path that can drift from print
output.

## Repository Layout

```text
packages/shared/     Isomorphic core model, unit helpers, params, SVG compiler
packages/server/     Fastify API, rasterization, protocol adapters, transports
packages/designer/   Vue 3 + Vite web app
data/                Development JSON store
out/                 Virtual print artifacts
```

## Protocol And Transport Boundaries

Protocols convert rendered label data into printable bytes or downloadable
artifacts. Transports deliver those bytes or artifacts.

The bundled protocol adapter emits TSPL bitmap jobs. Treat this as one adapter,
not the product identity. Future adapters such as PDF export or other printer
command languages should reuse the same template model and render pipeline.

Current transports:

- `file`: write generated artifacts under `out/`.
- `device`: write raw bytes to a local device path.
- `cups`: submit raw jobs to a CUPS queue.
- `network`: send raw bytes to a socket endpoint, typically port 9100.

## Media Model

Template geometry is always stored in millimetres. Dots only exist at
rasterization or protocol generation time.

Media feed modes are print-positioning concerns:

- `continuous`: no gap sensor positioning; protocol output uses continuous feed.
- `gap`: gap-positioned pre-cut labels; protocol output includes the gap size.
- `blackmark`: black-mark positioned media; protocol output uses the black mark
  distance.

In the designer, width and height affect layout. Feed mode affects printer
positioning and should be presented as such.

## UI Conventions

- The UI is a production tool, not a marketing site.
- Keep controls dense, predictable, and readable for repeated use.
- Paper and label previews must remain white, including in dark mode.
- Use `lucide-vue-next` icons for icon buttons and `reka-ui` only for unstyled
  accessible primitives such as tooltips and dialogs.
- Do not put literal `{{ }}` in Vue templates. Build placeholder examples in
  `<script setup>` constants.
- Use i18n keys for user-visible text. Avoid hard-coded Chinese or English in
  Vue templates once a translation key exists.

## Fonts

Server-side preview and printing depend on fonts available to the print host.
The `/api/fonts` endpoint enumerates host fonts so the designer can offer
families that the server can actually render. Keep template font stacks ending
in `sans-serif` so the server-side default mapping has a reliable fallback.

## Build And Test

```bash
npm install
npm run build
npm test
```

Development:

```bash
npm run build -w @labelprint/shared
npm run dev
npm run dev:designer
```

Docker development:

```bash
docker compose up --build
```

Production image:

```bash
docker compose -f compose.deploy.yml up --build -d
```

## Editing Rules

- Keep geometry in millimetres in shared data structures.
- Do not leak protocol-specific dot coordinates into template documents.
- Keep protocol code behind `packages/server/src/protocol`.
- Keep transport code behind `packages/server/src/transport`.
- Prefer small, coherent commits.
- Public docs and UI must avoid naming a specific printer model unless the user
  explicitly asks for a private hardware note.
