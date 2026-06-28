# LabelPrint

![screenshot](./screenshot.png)

LabelPrint is a self-hosted web app for designing and printing parameterized
thermal labels.

Use it to create millimetre-precise label templates, define placeholders such as
`{{name}}`, fill those placeholders from a form or REST API, preview the rendered
label, and send the job to a configured printer target. It is built for trusted
local networks and does not include authentication by default.

## What It Does

- Visual label template editing with text, lines, boxes, barcodes, QR codes, and
  images.
- Print-time parameters with defaults, so one template can produce many labels.
- Server-rendered previews that match the print pipeline.
- Printer target management from the web UI.
- Print history with quick reprint.
- Built-in PDF download, browser print, and TSPL download targets.
- Server-side delivery through USB device paths, CUPS raw queues, or network
  sockets.

The bundled server-side hardware backend currently generates TSPL bitmap jobs.
The print pipeline is protocol-oriented, so other output backends can be added
without changing how users design templates.

## Quick Start

Requirements:

- Node.js 20 or newer
- npm

```bash
npm install
npm run build
npm start
```

Open:

```text
http://localhost:5179
```

## Basic Workflow

1. Create or open a template.
2. Set the label size and feed-positioning mode.
3. Add elements and placeholders.
4. Open the Print page and fill the generated form.
5. Select a target such as PDF download, browser print, TSPL download, CUPS, USB,
   or network socket.
6. Print. For server-side targets, open the `CLI` dialog to copy an equivalent
   `curl` command.

## Docker Development

Docker is useful when you want the same Linux font and rendering environment as
the production image:

```bash
docker compose up --build
```

Open:

```text
http://localhost:5173
```

The designer runs through Vite and proxies API calls to the server container. If
you change shared package code, restart the server container.

## Production Docker

The deployment compose file builds a single runtime image. The server serves the
web app and API from one port:

```bash
docker compose -f compose.deploy.yml up --build -d
```

Open:

```text
http://<host>:5179
```

Persist these directories:

- `./data:/data` for templates, print targets, and print history.

Create or edit print targets in the web UI. Browser-managed targets such as PDF
download, TSPL download, and browser print run on the user's device.
Server-side targets such as USB device path, CUPS raw queue, and network socket
run on the LabelPrint host.

## REST API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET / POST / PUT / DELETE` | `/api/templates[/:id]` | Manage templates. |
| `GET / POST / PUT / DELETE` | `/api/targets[/:id]` | Manage print targets. |
| `PUT` | `/api/targets/order` | Reorder print targets. |
| `POST` | `/api/templates/:templateId/preview` | Render a template PNG preview. |
| `POST` | `/api/targets/:targetId/templates/:templateId/preview` | Render a target-specific PNG preview. |
| `POST` | `/api/targets/:targetId/templates/:templateId/render-job?copies=1` | Generate a downloadable raw job. |
| `POST` | `/api/targets/:targetId/templates/:templateId/print?copies=1` | Print with a server-side target. |

The preview, render-job, and print endpoints accept template parameters directly
as either JSON or `application/x-www-form-urlencoded` fields.

JSON example:

```bash
curl -X POST 'http://localhost:5179/api/targets/target_cups/templates/t_supply_40x30/print?copies=1' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Milk",
    "qty": "3",
    "date": "2026-06-28",
    "location": "Shelf B2"
  }'
```

Form example:

```bash
curl -X POST 'http://localhost:5179/api/targets/target_cups/templates/t_supply_40x30/print?copies=1' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'name=Milk&qty=3&date=2026-06-28&location=Shelf+B2'
```

## Configuration

Common environment variables:

- `LABELPRINT_PORT`: server port, default `5179`.
- `LABELPRINT_HOST`: server bind host, default `0.0.0.0`.
- `LABELPRINT_DATA_DIR`: data directory, default `./data`.
- `LABELPRINT_DESIGNER_DIST`: built designer path served by the server.
- `LABELPRINT_DEFAULT_FONT`: preferred server-side font family.
- `LABELPRINT_FONT_DIRS`: extra font directories for server rendering.
- `LABELPRINT_API_PROXY`: Vite development proxy target.

## Development

For day-to-day development without Docker:

```bash
npm run build -w @labelprint/shared
npm run dev
npm run dev:designer
```

Run checks:

```bash
npm run build
npm test
```

Implementation notes for coding agents and maintainers live in
[AGENTS.md](AGENTS.md).

## License

MIT
