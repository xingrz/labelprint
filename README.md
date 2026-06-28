# LabelPrint

LabelPrint is a parameterized thermal label design and printing system.

It provides a millimetre-precise visual designer, a browser print workflow, and a
REST API for filling templates with values. The same JSON-to-SVG compiler is used
for both the live preview and the server-side print pipeline, so the generated
output matches the designer as closely as the selected protocol allows.

The project is intended for local networks and self-hosted deployments. It can run
as a local macOS/Linux application during design and as a headless Linux service
managed through the web UI.

## Features

- Visual template editor with millimetre coordinates.
- Text, lines, boxes, barcodes, QR codes, and image elements.
- Parameter placeholders such as `{{name}}` with defaults and print-time values.
- WYSIWYG rendering through a shared JSON-to-SVG compiler.
- Server-side raster preview and print history.
- Feed modes for continuous media, gap-positioned labels, and black-mark media.
- Transport adapters for file output, raw devices, CUPS raw queues, and port 9100.
- Protocol-oriented print pipeline. The current bundled protocol backend emits
  TSPL bitmap jobs; other protocols or PDF export can be added behind the same
  template and render pipeline.

## Architecture

```text
Template JSON + values
        |
        v
JSON-to-SVG compiler     packages/shared
        |
        v
Server rasterizer        packages/server/render
        |
        v
Protocol adapter         packages/server/protocol
        |
        v
Transport adapter        file | device | cups | network
```

The template model stores geometry in millimetres. Dots are introduced only at
rasterization time, based on the selected printer's DPI setting.

## Repository Layout

```text
packages/shared/     Isomorphic model, units, params, and JSON-to-SVG compiler
packages/server/     Fastify API, rasterization, protocol adapters, transports
packages/designer/   Vue 3 + Vite web designer
data/                Local JSON/JSONL store used in development
out/                 Virtual print artifacts
```

## Quick Start

```bash
npm install
npm run build
npm start
```

Then open:

```text
http://localhost:5179
```

## Development

Run the API and the designer separately:

```bash
npm run build -w @labelprint/shared
npm run dev
npm run dev:designer
```

The designer runs on `http://localhost:5173` and proxies `/api` to the server on
`http://localhost:5179`.

Run tests:

```bash
npm test
```

## Docker Development

Docker development is useful when you want the same Linux font and rasterization
environment as production:

```bash
docker compose up --build
```

Open:

```text
http://localhost:5173
```

After changing files in `packages/shared`, restart the server container so the
server process sees the rebuilt shared package.

## Production Docker

The deployment compose file builds one runtime image. The server serves the built
designer assets and exposes the API:

```bash
docker compose -f compose.deploy.yml up --build -d
```

Open:

```text
http://<host>:5179
```

## REST API

| Method | Path | Description |
| --- | --- | --- |
| `GET / POST / PUT / DELETE` | `/api/templates[/:id]` | Template CRUD. `PUT` upserts by id. |
| `GET / POST / PUT / DELETE` | `/api/printers[/:id]` | Printer configuration CRUD. |
| `POST` | `/api/preview` | Render a template or document to PNG. |
| `POST` | `/api/print` | Fill a template and send it to a printer transport. |

Example:

```bash
curl -X POST http://localhost:5179/api/print \
  -H 'Content-Type: application/json' \
  -d '{
    "templateId": "t_supply_40x30",
    "values": {
      "name": "Milk",
      "qty": "3",
      "date": "2026-06-28",
      "location": "Shelf B2"
    },
    "printerId": "p_virtual"
  }'
```

The virtual printer writes protocol output and preview PNG artifacts to `out/`,
which is useful for testing without hardware.

## Configuration

Environment variables:

- `LABELPRINT_PORT`: server port, default `5179`.
- `LABELPRINT_HOST`: server bind host, default `0.0.0.0`.
- `LABELPRINT_DATA_DIR`: JSON/JSONL store directory, default `./data`.
- `LABELPRINT_OUT_DIR`: virtual output directory, default `./out`.
- `LABELPRINT_DESIGNER_DIST`: built designer path served by the server.
- `LABELPRINT_DEFAULT_FONT`: preferred server-side font family.
- `LABELPRINT_FONT_DIRS`: extra font directories for server rasterization.
- `LABELPRINT_API_PROXY`: Vite development proxy target.

## Protocols And Transports

LabelPrint separates protocol generation from transport delivery.

Protocols decide how a rendered label becomes printable bytes or a downloadable
artifact. Transports decide where that artifact goes. The bundled implementation
uses a TSPL bitmap protocol adapter because it is fast and widely supported by
many thermal label printers. A future PDF adapter can reuse the same template,
parameter, and raster/preview pipeline.

Available transports:

- `file`: write artifacts to disk for offline testing.
- `device`: write raw bytes to a device path.
- `cups`: submit raw jobs to a CUPS queue.
- `network`: send raw bytes to a socket printer endpoint.

## License

MIT
