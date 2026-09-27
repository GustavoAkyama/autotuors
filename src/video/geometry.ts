export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Rect = Point & Size;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Video encoders want even dimensions. */
export const even = (value: number) => Math.round(value / 2) * 2;

export const scaleSize = (size: Size, factor: number): Size => ({
  width: Math.round(size.width * factor),
  height: Math.round(size.height * factor),
});
