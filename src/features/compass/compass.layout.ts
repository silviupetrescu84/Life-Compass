export interface Point { readonly x: number; readonly y: number }
export interface CompassPosition {
  readonly angle: number;
  readonly point: Point;
  readonly labelWidth: number;
  readonly alignment: 'left' | 'center' | 'right';
}

export function pointOnCircle(center: Point, radius: number, angle: number): Point {
  const radians = angle * Math.PI / 180;
  return { x: center.x + radius * Math.cos(radians), y: center.y + radius * Math.sin(radians) };
}

// Coordinates are CSS pixels, so labels stay 16px at every viewport size.
// Labels are HTML buttons over a native SVG; they can wrap and grow naturally.
export function getCompassLayout(count: number, width: number) {
  if (!Number.isInteger(count) || count < 1 || count > 6) throw new RangeError('A compass needs 1–6 values.');
  if (!Number.isFinite(width) || width < 240) throw new RangeError('Compass width must be at least 240px.');
  const sideLabelWidth = width < 360 ? 104 : 140;
  const horizontalRoom = (width - sideLabelWidth) / 2 - 8;
  const radius = Math.max(176, Math.min(210, horizontalRoom));
  const height = Math.max(320, radius * 2 + 136);
  const center = { x: width / 2, y: height / 2 };
  const positions: CompassPosition[] = Array.from({ length: count }, (_, index) => {
    const angle = -90 + index * 360 / count;
    const direction = Math.cos(angle * Math.PI / 180);
    const axial = Math.abs(direction) < 0.01;
    // Keep equal angular spacing while allowing longer north/south spokes.
    // On narrow screens this makes room for wrapped labels without shrinking type.
    const labelRadius = axial ? radius : Math.min(radius, horizontalRoom / Math.abs(direction));
    return {
      angle,
      point: pointOnCircle(center, labelRadius, angle),
      labelWidth: axial ? Math.min(220, width - 32) : sideLabelWidth,
      alignment: axial ? 'center' : direction > 0 ? 'left' : 'right',
    };
  });
  return { width, height, center, radius, circleRadius: Math.min(radius, horizontalRoom) * 0.68, positions };
}
