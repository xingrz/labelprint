/**
 * Core data model. All geometry is in millimetres (mm), origin = top-left of the label.
 * Rotation is in degrees; the UI currently constrains labels to 0/90/180/270.
 */

export type Rotation = 0 | 90 | 180 | 270;
export type ElementType = 'text' | 'line' | 'box' | 'barcode' | 'qrcode' | 'image';

export interface BaseElement {
  id: string;
  type: ElementType;
  name?: string;
  /** Top-left X in mm (for line: the start point X). */
  x: number;
  /** Top-left Y in mm (for line: the start point Y). */
  y: number;
  rotation?: Rotation;
  locked?: boolean;
}

export interface TextElement extends BaseElement {
  type: 'text';
  w: number;
  h: number;
  /** May contain {{param}} placeholders. Use \n for explicit line breaks. */
  text: string;
  fontFamily: string;
  /** Font size in typographic points. */
  fontSizePt: number;
  fontWeight: 'normal' | 'bold';
  italic?: boolean;
  align: 'left' | 'center' | 'right';
  valign: 'top' | 'middle' | 'bottom';
  /** Line height multiplier (default 1.2). */
  lineHeight?: number;
  /** Letter spacing in mm. */
  letterSpacing?: number;
  color?: string;
}

export interface LineElement extends BaseElement {
  type: 'line';
  /** End point in mm (start is x,y). */
  x2: number;
  y2: number;
  strokeMm: number;
  color?: string;
  /** Dash pattern in mm, e.g. [1, 0.5]. */
  dash?: number[];
}

export interface BoxElement extends BaseElement {
  type: 'box';
  w: number;
  h: number;
  strokeMm: number;
  radiusMm?: number;
  color?: string;
  /** Fill colour; omit/"none" for transparent. */
  fill?: string;
}

export interface BarcodeElement extends BaseElement {
  type: 'barcode';
  w: number;
  h: number;
  /** bwip-js symbology id, e.g. 'code128', 'ean13', 'code39'. */
  symbology: string;
  /** May contain {{param}} placeholders. */
  value: string;
  showText?: boolean;
}

export interface QrcodeElement extends BaseElement {
  type: 'qrcode';
  /** Square module box size in mm. */
  size: number;
  value: string;
  ecc?: 'L' | 'M' | 'Q' | 'H';
}

export interface ImageElement extends BaseElement {
  type: 'image';
  w: number;
  h: number;
  /** Data URL, asset path, or a {{param}} that resolves to one. */
  src: string;
  fit?: 'contain' | 'cover' | 'fill';
}

export type LabelElement =
  | TextElement
  | LineElement
  | BoxElement
  | BarcodeElement
  | QrcodeElement
  | ImageElement;

export type MediaType = 'continuous' | 'gap' | 'blackmark';
export type PrintProtocol = 'tspl-bitmap';
export type PrintJobFormat = 'pdf' | 'browser-print-page' | PrintProtocol;
export type PrintDelivery =
  | 'download'
  | 'browser-dialog'
  | 'web-bluetooth'
  | 'web-usb'
  | 'cups'
  | 'usb'
  | 'network';

/** Snapshot of media geometry embedded in a template (so a template is self-contained). */
export interface MediaRef {
  widthMm: number;
  /** Fixed label length for gap/blackmark; for continuous this is the design length. */
  heightMm: number;
  type: MediaType;
  /** Gap or black-mark positioning distance in mm when relevant. */
  gapMm?: number;
}

export interface ParamDef {
  key: string;
  label?: string;
  type?: 'text' | 'number' | 'date';
  default?: string;
  /** Optional format hint, e.g. "¥0.00" or "YYYY-MM-DD". v1 stores it; formatting is best-effort. */
  format?: string;
  /** Render a multi-line textarea when filling this param; the value's \n become text lines. */
  multiline?: boolean;
}

export interface TemplateDoc {
  id: string;
  name: string;
  version: 1;
  media: MediaRef;
  /** Background colour of the label, default white. */
  background?: string;
  elements: LabelElement[];
  params: ParamDef[];
  /** Default parameter values used when none supplied. */
  defaults?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

/** Effective media/output settings used while creating templates or print jobs. */
export interface MediaProfile {
  id: string;
  name: string;
  widthMm: number;
  type: MediaType;
  /** Required for gap/blackmark; ignored for continuous. */
  heightMm?: number;
  /** Gap or black-mark positioning distance in mm; default 2. */
  gapMm?: number;
  dpi: number;
  marginsMm?: { top: number; right: number; bottom: number; left: number };
  /** Thermal darkness hint. The bundled TSPL adapter maps this to DENSITY. */
  density: number;
  /** Thermal speed hint. The bundled TSPL adapter maps this to SPEED. */
  speed: number;
  /** Feed direction hint for protocols that expose one. */
  direction: 0 | 1;
  /** Optional raster correction in device dots before protocol packing. */
  offsetXDots?: number;
  offsetYDots?: number;
  /** Higher values turn more antialiased grey pixels into ink. */
  monoThreshold?: number;
}

export interface PrintTargetConfig {
  id: string;
  name: string;
  /** Output format generated for this target. */
  format: PrintJobFormat;
  /** Where that output goes. */
  delivery: PrintDelivery;
  /** Rasterization DPI; defaults to 203. */
  dpi?: number;
  /** Thermal darkness hint. The bundled TSPL adapter maps this to DENSITY. */
  density?: number;
  /** Thermal speed hint. The bundled TSPL adapter maps this to SPEED. */
  speed?: number;
  /** Feed direction hint for protocols that expose one. */
  direction?: 0 | 1;
  /** Optional raster correction in device dots before protocol packing. */
  offsetXDots?: number;
  offsetYDots?: number;
  /** Higher values turn more antialiased grey pixels into ink. */
  monoThreshold?: number;
  /** usb: raw USB device path, e.g. /dev/usb/lp0 on Linux. */
  device?: string;
  /** cups: raw queue name (e.g. tspl_raw); optional remote server "host:631". */
  cupsQueue?: string;
  cupsServer?: string;
  /** network: raw socket target (JetDirect 9100). */
  host?: string;
  port?: number;
  /** web-bluetooth: optional chooser filter and writable GATT endpoint. */
  bleNamePrefix?: string;
  bleServiceUuid?: string;
  bleCharacteristicUuid?: string;
  bleChunkSize?: number;
  bleChunkDelayMs?: number;
  bleWriteMode?: 'with-response' | 'without-response';
  /** web-usb: optional chooser filter and writable OUT endpoint override. */
  webUsbVendorId?: number;
  webUsbProductId?: number;
  webUsbSerialNumber?: string;
  webUsbClassCode?: number;
  webUsbInterfaceNumber?: number;
  webUsbAlternateSetting?: number;
  webUsbEndpointNumber?: number;
  webUsbChunkSize?: number;
}

/** Request body for printing: which template, parameter values, copies, optional overrides. */
export interface PrintRequest {
  templateId: string;
  values?: Record<string, string>;
  copies?: number;
  targetId?: string;
}

/** One entry in the print history log. */
export interface PrintRecord {
  id: string;
  /** ISO timestamp. */
  ts: string;
  templateId: string;
  templateName: string;
  values: Record<string, string>;
  copies: number;
  target: string;
  targetId?: string;
  format: PrintJobFormat;
  delivery: PrintDelivery;
  ok: boolean;
  detail: string;
  widthDots: number;
  heightDots: number;
}
