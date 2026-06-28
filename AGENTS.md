# AGENTS.md - LabelPrint Maintainer Notes

This file is for coding agents and future maintainers. Keep README focused on
what the product does, how to use it, and how to deploy it. Put implementation
guidance here only when it is stable enough to be useful, and prefer pointing at
the source file that owns the behavior.

Avoid hardware-specific claims in public docs unless the user explicitly asks for
a private hardware note.

## Product Boundary

LabelPrint is a parameterized thermal-label design and printing system:

- Users design templates in a millimetre-precise web editor.
- Users fill templates from the UI or REST API.
- The server renders previews and server-side print jobs; browser-managed targets
  can reuse the rendered preview.
- Deployments are assumed to be trusted local-network services unless auth is
  added by the application owner.

Do not brand the product around a printer protocol. Protocols are output adapters,
not the product identity.

## Code Map

- `packages/shared/src/types.ts`: shared data model.
- `packages/shared/src/compiler.ts`: template JSON to SVG; this is the main
  preview/print source of truth.
- `packages/shared/src/params.ts`: placeholder extraction and substitution.
- `packages/shared/src/units.ts`: millimetre, dot, and point helpers.
- `packages/server/src/api/routes.ts`: REST API.
- `packages/server/src/pipeline.ts`: template + values + printer -> rendered job
  -> transport.
- `packages/server/src/render/`: server-side SVG rasterization and asset helpers.
- `packages/server/src/protocol/`: output protocol adapters.
- `packages/server/src/transport/`: delivery adapters.
- `packages/server/src/store/`: file-backed repositories and seed data.
- `packages/designer/src/lib/store.ts`: main client-side reactive state.
- `packages/designer/src/lib/i18n.ts`: English/Chinese UI strings.
- `packages/designer/src/lib/pdf.ts`: small browser-side raster PDF writer.
- `packages/designer/src/lib/theme.ts`: light/dark preference handling.
- `packages/designer/src/views/`: top-level UI workflows.
- `packages/designer/src/components/`: reusable editor and dialog components.

When behavior changes, update the nearby code comment, test, or component first;
use this file as an index and policy record rather than a duplicate spec.

## Core Invariants

- Template geometry is in millimetres. Dots should appear at rasterization or
  protocol-generation boundaries, not in template documents.
- The designer preview and server print path should keep using the shared compiler
  unless there is an explicit compatibility reason to split them.
- Template documents own label geometry and feed-positioning mode. Printer records
  own output settings such as protocol, transport, DPI, density, speed, and
  direction. Some targets are browser-managed; check `types.ts`, `PrintView.vue`,
  `pipeline.ts`, printer UI, and README together when changing this split.
- Paper canvases and label previews should remain white in dark mode.
- User-visible UI strings should go through `i18n.ts`.

## Protocols And Printing

The current bundled protocol is `tspl-bitmap`; see
`packages/server/src/protocol/`. Treat it as one adapter behind the print
pipeline. New protocol work usually needs changes in:

- `packages/shared/src/types.ts` for `PrintProtocol`.
- `packages/server/src/protocol/` for adapter implementation and registration.
- `packages/server/src/pipeline.ts` if the adapter needs different input or
  artifact handling.
- `packages/designer/src/components/PrinterSettingsDialog.vue` if users can
  select or configure it.

Browser print and PDF download are currently browser-managed printer targets.
`pdf-download` uses `packages/designer/src/lib/pdf.ts`; `browser-print` creates a
print-formatted iframe in `PrintView.vue` and calls `window.print()`. Normal web
pages cannot reliably choose a printer or silently print, so keep that UX
explicit.

Server-side transports are delivery mechanisms. Keep raw device, CUPS, network
socket, and file behavior under `packages/server/src/transport/`. The REST print
pipeline should reject browser-managed targets instead of pretending the server
can perform those user-agent actions.

## Runtime Data

Current stores are file-backed and live behind repository interfaces in
`packages/server/src/store/`:

- Templates: JSON files under `data/templates/`.
- Printers: `data/printers.json`, managed through UI and API.
- History: append-oriented `data/history.jsonl`.

There is no active persisted media catalog. If an old `data/media.json` exists in
a checkout, current code should ignore it. If runtime data grows beyond the file
store, keep the repository surface stable while moving the implementation, for
example to SQLite.

## UI Guidance

- This is a production tool, not a landing page. Favor dense, predictable controls
  over marketing layout.
- Use the existing icon and dialog patterns unless there is a clear reason to
  introduce a new UI dependency.
- Print-page mobile layout should prioritize preview first, form second.
- Keep canvas, board, toolbar, and dialog dimensions stable so selection handles
  and controls do not shift unexpectedly.
- Do not put literal `{{ }}` in Vue templates; build placeholder examples in
  `<script setup>` constants.

## Verification

Default checks:

```bash
npm run build
npm test
```

For UI changes, run the app and verify with browser automation or screenshots at
desktop and mobile widths. For Docker-specific work, use the compose file that
matches the target path:

```bash
docker compose up --build
docker compose -f compose.deploy.yml up --build -d
```

## Documentation Policy

- README: product purpose, basic workflow, deployment, API summary, configuration.
- AGENTS.md: maintainer guidance, architecture pointers, invariants, gotchas.
- Avoid duplicating implementation details in both files.
- Avoid absolute statements about hardware, printer behavior, or future protocol
  support unless they are encoded in tests or the user asks for a private note.
- When behavior changes, update docs in the same coherent commit.

## Commit Policy

Use small, coherent commits. If an AI assistant creates commits, include a
co-author trailer naming the actual assistant/model used for the work.
