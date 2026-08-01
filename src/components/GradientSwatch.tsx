// components/GradientSwatch.tsx
//
// The gradient-stops SVG (parse stops -> linearGradient -> rect), extracted
// from the Color Picker dialog in tattingindex.tsx (see architecture.md).
// This exact pattern appeared 4 times — swatch grid item + preview, in both
// the Swatches tab and the Gradients tab — differing only in the SVG defs
// id (which must be unique per rendered instance) and the stops source.
import React from 'react';
import { parseGradientStops } from '../utils/color';

interface GradientSwatchProps {
  /** Must be unique among all GradientSwatch instances rendered at once (used as the SVG <linearGradient> id). */
  gradientId: string;
  stops: string | Array<{ offset: string; color: string }>;
}

export const GradientSwatch: React.FC<GradientSwatchProps> = ({ gradientId, stops }) => {
  const normalizedStops = parseGradientStops(stops);
  return (
    <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          {normalizedStops.map((stop, i) => (
            <stop key={i} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
    </svg>
  );
};
