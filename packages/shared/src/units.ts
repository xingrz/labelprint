/**
 * Unit conversions. The whole system authors geometry in millimetres (mm).
 * Rasterisation to printer dots happens only at print time, driven by DPI.
 *
 * 203 dpi thermal printers use 8 dots/mm. Confirm the effective DPI on real hardware.
 */
export const DEFAULT_DPI = 203;
export const MM_PER_INCH = 25.4;
export const PT_PER_INCH = 72;

/**
 * Dots per millimetre at a given DPI.
 *
 * Thermal label printers are integer-dots/mm devices: "203 dpi" means exactly
 * 8 dots/mm, "300 dpi" means 12 dots/mm. We therefore round dpi/25.4 to the
 * nearest integer so our raster geometry matches the printer's own coordinate
 * system, and so BITMAP rows divide cleanly into bytes (640 dots = 80 bytes).
 */
export function dotsPerMm(dpi: number = DEFAULT_DPI): number {
  return Math.round(dpi / MM_PER_INCH);
}

export function mmToDot(mm: number, dpi: number = DEFAULT_DPI): number {
  return mm * dotsPerMm(dpi);
}

export function dotToMm(dot: number, dpi: number = DEFAULT_DPI): number {
  return dot / dotsPerMm(dpi);
}

/** Typographic points -> millimetres (1pt = 1/72 inch). */
export function ptToMm(pt: number): number {
  return (pt / PT_PER_INCH) * MM_PER_INCH;
}

export function mmToPt(mm: number): number {
  return (mm / MM_PER_INCH) * PT_PER_INCH;
}

export function ptToDot(pt: number, dpi: number = DEFAULT_DPI): number {
  return mmToDot(ptToMm(pt), dpi);
}

/** Pixel width (in dots) of a label of given mm width at the printer DPI. */
export function widthInDots(widthMm: number, dpi: number = DEFAULT_DPI): number {
  return Math.round(mmToDot(widthMm, dpi));
}
