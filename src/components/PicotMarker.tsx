// components/PicotMarker.tsx
//
// The marker drawn for a joinable picot in Picot Edit mode (renderOnePicot in
// tattingindex.tsx). The SHAPE says the kind, the fill colour (passed in)
// says the state — unconnected / connected / selected — as before:
//
//   p, sp, lp   circle (sizes differ: see picotMarkerRadius in domain/picotKind.ts)
//   gp          double circle
//   jpg         diamond
//   cj          square
//   cjp         triangle (point up)
//
// `r` is the circle's radius in SVG units; the other shapes are sized to
// look about as heavy as that circle. Any other / unknown kind → circle.
import React from 'react';
import type { PicotKindToken } from '../domain/picotKind';

interface PicotMarkerProps {
  kind: PicotKindToken | null;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity?: number;
}

export const PicotMarker: React.FC<PicotMarkerProps> = ({ kind, cx, cy, r, fill, stroke, strokeWidth, opacity }) => {
  const common = { fill, stroke, strokeWidth, opacity, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'gp':
      return (
        <>
          <circle cx={cx} cy={cy} r={r} {...common} />
          <circle cx={cx} cy={cy} r={r * 0.5} fill="none" stroke={stroke} strokeWidth={strokeWidth * 0.75} opacity={opacity} />
        </>
      );
    case 'jpg': {
      const R = r * 1.25;
      return <polygon points={`${cx},${cy - R} ${cx + R},${cy} ${cx},${cy + R} ${cx - R},${cy}`} {...common} />;
    }
    case 'cj': {
      const h = r * 0.88;
      return <rect x={cx - h} y={cy - h} width={h * 2} height={h * 2} {...common} />;
    }
    case 'cjp': {
      const R = r * 1.25;
      const dx = R * 0.866, dy = R * 0.5;
      return <polygon points={`${cx},${cy - R} ${cx + dx},${cy + dy} ${cx - dx},${cy + dy}`} {...common} />;
    }
    default:
      return <circle cx={cx} cy={cy} r={r} {...common} />;
  }
};
