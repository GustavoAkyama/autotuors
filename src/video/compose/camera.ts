import { clamp, type Rect, type Size } from "../geometry.ts";

/** Something worth looking at, at `time` seconds into the video; `null` shows the whole page. */
export type Focus = { time: number; rect: Rect | null };

type Shot = { zoom: number; x: number; y: number };
type Move = { start: number; end: number; from: Shot; to: Shot };

const transition = 0.8;
const padding = 56;
const minZoom = 1.15;

/** Decides when the camera moves and where to, from what each moment focuses on. */
export function planCamera(focuses: Focus[], viewport: Size, maxZoom: number) {
  const overview: Shot = {
    zoom: 1,
    x: viewport.width / 2,
    y: viewport.height / 2,
  };

  const shotFor = (rect: Rect): Shot => {
    const zoom = Math.min(
      maxZoom,
      viewport.width / (rect.width + padding * 2),
      viewport.height / (rect.height + padding * 2),
    );

    if (zoom < minZoom) return overview;

    const halfWidth = viewport.width / zoom / 2;
    const halfHeight = viewport.height / zoom / 2;

    return {
      zoom,
      x: clamp(rect.x + rect.width / 2, halfWidth, viewport.width - halfWidth),
      y: clamp(
        rect.y + rect.height / 2,
        halfHeight,
        viewport.height - halfHeight,
      ),
    };
  };

  // Stay put while the next target is already comfortably in view, so the camera
  // doesn't twitch between neighbouring controls.
  const covers = (shot: Shot, rect: Rect) => {
    if (shot.zoom === 1) return false;

    const halfWidth = viewport.width / shot.zoom / 2 - 16;
    const halfHeight = viewport.height / shot.zoom / 2 - 16;

    return (
      rect.x >= shot.x - halfWidth &&
      rect.x + rect.width <= shot.x + halfWidth &&
      rect.y >= shot.y - halfHeight &&
      rect.y + rect.height <= shot.y + halfHeight
    );
  };

  const moves: Move[] = [];
  let current = overview;
  let free = 0;

  for (const focus of focuses) {
    if (focus.rect && covers(current, focus.rect)) continue;

    const next = focus.rect ? shotFor(focus.rect) : overview;

    if (
      next.zoom === current.zoom &&
      next.x === current.x &&
      next.y === current.y
    )
      continue;

    const start = Math.max(focus.time, free);

    moves.push({ start, end: start + transition, from: current, to: next });
    current = next;
    free = start + transition;
  }

  return moves;
}

/** An ffmpeg zoompan filter that follows `moves`, easing between shots. */
export function cameraFilter(
  moves: Move[],
  viewport: Size,
  output: Size,
  fps: number,
) {
  const time = `(in/${fps})`;

  const eased = ({ start, end }: Move) => {
    const p = `clip((${time}-${start.toFixed(3)})/${(end - start).toFixed(3)},0,1)`;
    return `if(lt(${p},0.5),4*pow(${p},3),1-pow(2-2*${p},3)/2)`;
  };

  const track = (key: keyof Shot, initial: number) =>
    [
      initial.toFixed(4),
      ...moves
        .filter((move) => move.to[key] !== move.from[key])
        .map(
          (move) =>
            `(${(move.to[key] - move.from[key]).toFixed(4)})*${eased(move)}`,
        ),
    ].join("+");

  const zoom = track("zoom", 1);
  const x = `clip((${track("x", viewport.width / 2)})*iw/${viewport.width}-iw/zoom/2,0,iw-iw/zoom)`;
  const y = `clip((${track("y", viewport.height / 2)})*ih/${viewport.height}-ih/zoom/2,0,ih-ih/zoom)`;

  return `zoompan=z='${zoom}':x='${x}':y='${y}':d=1:s=${output.width}x${output.height}:fps=${fps}`;
}
