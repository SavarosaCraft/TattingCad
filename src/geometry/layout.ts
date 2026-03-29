// layout.ts — Pure layout geometry functions, no React dependencies
// Functions that were previously closures over component state
// now accept their dependencies as explicit parameters.

import { sampleBezierPath } from './bezier';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

// Compute the bounding box of a set of elements identified by ids.
// Accounts for circle radius, path sampling, and picot arm lengths.
export const getBoundingBox = (
  ids: (string | number)[],
  elements: any[],
  dsWidth: number
): BoundingBox | null => {
  const els = elements.filter(e => ids.includes(e.id));
  if (els.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const PICOT_SIZE = { small: 13, medium: 20, large: 26 };

  els.forEach(el => {
    if (el.isClosed && el.shapeStyle === 'circle') {
      const radius = (el.stitchCount * dsWidth) / (2 * Math.PI);
      let maxPicotLength = 0;
      if (el.picots?.length > 0) {
        el.picots.forEach(p => {
          maxPicotLength = Math.max(maxPicotLength, PICOT_SIZE[p.length] || 20);
        });
      }
      const effectiveRadius = radius + maxPicotLength;
      minX = Math.min(minX, el.center.x - effectiveRadius);
      minY = Math.min(minY, el.center.y - effectiveRadius);
      maxX = Math.max(maxX, el.center.x + effectiveRadius);
      maxY = Math.max(maxY, el.center.y + effectiveRadius);
    } else {
      let elMinX = Infinity, elMinY = Infinity, elMaxX = -Infinity, elMaxY = -Infinity;
      (el.paths || []).forEach(path => {
        sampleBezierPath(path, 20).forEach(pt => {
          elMinX = Math.min(elMinX, pt.x); elMinY = Math.min(elMinY, pt.y);
          elMaxX = Math.max(elMaxX, pt.x); elMaxY = Math.max(elMaxY, pt.y);
        });
      });
      if (el.picots?.length > 0) {
        let maxPicotLength = 0;
        el.picots.forEach(p => {
          maxPicotLength = Math.max(maxPicotLength, PICOT_SIZE[p.length] || 20);
        });
        elMinX -= maxPicotLength; elMinY -= maxPicotLength;
        elMaxX += maxPicotLength; elMaxY += maxPicotLength;
      }
      minX = Math.min(minX, elMinX); minY = Math.min(minY, elMinY);
      maxX = Math.max(maxX, elMaxX); maxY = Math.max(maxY, elMaxY);
    }
  });

  return {
    x: minX, y: minY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
};
