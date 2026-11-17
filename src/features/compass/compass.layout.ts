export interface Point {
  readonly x: number;
  readonly y: number;
}
interface CompassPosition {
  /** The value's axis; its rating is drawn along this angle. */
  readonly angle: number;
  /** Where the value's label attaches, just beyond the end of its axis. */
  readonly point: Point;
  /** Which way the label extends from that point, always away from the circle. */
  readonly placement: 'above' | 'below' | 'left' | 'right';
  readonly labelWidth: number;
}

/** Every value name fits on one line at this width; the label is this tall. */
export const LABEL_HEIGHT = 44;
const SIDE_LABEL_WIDTH = 140;
const END_LABEL_WIDTH = 180;
/** Rating badges are centred on the axes, so a badge at the top rating reaches this far past the ring. */
export const BADGE_RADIUS = 11;
// Space between the outer ring and the labels: a top-rated badge, its focus outline, and breathing room.
const LABEL_GAP = 28;
const EDGE_MARGIN = 8;
const MAX_CIRCLE_RADIUS = 160;
// Narrow screens are not supported; the circle stops shrinking here and labels may crowd.
const MIN_CIRCLE_RADIUS = 60;

export function pointOnCircle(center: Point, radius: number, angle: number): Point {
  const radians = (angle * Math.PI) / 180;
  return { x: center.x + radius * Math.cos(radians), y: center.y + radius * Math.sin(radians) };
}

// Axes are evenly spaced around the circle so the rating shape stays true. Each label sits just
// beyond the end of its axis and extends outwards, so labels never cover the ratings.
// The circle is as large as the widest side labels allow. Coordinates are CSS pixels.
export function getCompassLayout(count: number, width: number) {
  const angles = Array.from({ length: count }, (_, index) => -90 + (index * 360) / count);
  const widestReach = Math.max(...angles.map((angle) => Math.abs(Math.cos((angle * Math.PI) / 180))));
  const roomForCircle = (width / 2 - SIDE_LABEL_WIDTH - EDGE_MARGIN) / widestReach - LABEL_GAP;
  const circleRadius = Math.max(MIN_CIRCLE_RADIUS, Math.min(MAX_CIRCLE_RADIUS, roomForCircle));
  const labelDistance = circleRadius + LABEL_GAP;
  const height = 2 * (labelDistance + LABEL_HEIGHT + EDGE_MARGIN);
  const center = { x: width / 2, y: height / 2 };
  const positions: CompassPosition[] = angles.map((angle) => {
    const radians = (angle * Math.PI) / 180;
    const axial = Math.abs(Math.cos(radians)) < 0.01;
    return {
      angle,
      point: pointOnCircle(center, labelDistance, angle),
      placement: axial ? (Math.sin(radians) < 0 ? 'above' : 'below') : Math.cos(radians) > 0 ? 'right' : 'left',
      labelWidth: axial ? END_LABEL_WIDTH : SIDE_LABEL_WIDTH,
    };
  });
  return { height, center, circleRadius, positions };
}

/**
 * The rating picked by pointing at the compass: the axis closest in direction to the point, and
 * the level nearest to how far the point lies along that axis. Points on the centre hub (which
 * belong to no axis) or beyond the outer ring pick nothing.
 */
export function ratingAtPoint(
  { center, circleRadius, positions }: ReturnType<typeof getCompassLayout>,
  point: Point,
  maxRating: number,
): { index: number; rating: number } | null {
  const step = circleRadius / maxRating;
  const distance = Math.hypot(point.x - center.x, point.y - center.y);
  if (distance < step / 2 || distance > circleRadius + step / 2) return null;
  const angle = (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
  const offsets = positions.map((position) => Math.abs(((((angle - position.angle) % 360) + 540) % 360) - 180));
  const index = offsets.indexOf(Math.min(...offsets));
  const along = distance * Math.cos((offsets[index]! * Math.PI) / 180);
  return { index, rating: Math.min(maxRating, Math.max(1, Math.round(along / step))) };
}
