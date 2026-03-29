// bezier.ts — Pure bezier geometry functions, no React dependencies

export interface BezierPath {
  type: 'cubic' | 'quadratic';
  x: number; y: number;
  control1X?: number; control1Y?: number;
  control2X?: number; control2Y?: number;
  controlX?: number; controlY?: number;
  endX: number; endY: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface PointWithAngle extends Point {
  angle: number;
}

// Sample a bezier path into an array of points
export const sampleBezierPath = (path: BezierPath, samples = 20): Point[] => {
  const points: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    let x: number, y: number;
    if (path.type === 'cubic') {
      x = (1-t)*(1-t)*(1-t)*path.x +
          3*(1-t)*(1-t)*t*path.control1X! +
          3*(1-t)*t*t*path.control2X! +
          t*t*t*path.endX;
      y = (1-t)*(1-t)*(1-t)*path.y +
          3*(1-t)*(1-t)*t*path.control1Y! +
          3*(1-t)*t*t*path.control2Y! +
          t*t*t*path.endY;
    } else {
      x = (1-t)*(1-t)*path.x + 2*(1-t)*t*path.controlX! + t*t*path.endX;
      y = (1-t)*(1-t)*path.y + 2*(1-t)*t*path.controlY! + t*t*path.endY;
    }
    points.push({ x, y });
  }
  return points;
};

// Calculate total length of a sampled path
export const calculatePathLength = (points: Point[]): number => {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
  }
  return length;
};

// Fast point+angle lookup using pre-sampled data
export const getPointAndAngleAtDistanceFast = (
  allSamples: Point[][],
  pathLengths: number[],
  targetDistance: number
): PointWithAngle => {
  let accumulatedDistance = 0;
  for (let pi = 0; pi < allSamples.length; pi++) {
    const samples = allSamples[pi];
    const pathLength = pathLengths[pi];
    if (accumulatedDistance + pathLength >= targetDistance) {
      const localDistance = targetDistance - accumulatedDistance;
      let currentDist = 0;
      for (let i = 1; i < samples.length; i++) {
        const dx = samples[i].x - samples[i-1].x;
        const dy = samples[i].y - samples[i-1].y;
        const segmentDist = Math.sqrt(dx*dx + dy*dy);
        if (currentDist + segmentDist >= localDistance) {
          const t = segmentDist > 0 ? (localDistance - currentDist) / segmentDist : 0;
          return { x: samples[i-1].x + dx*t, y: samples[i-1].y + dy*t, angle: Math.atan2(dy, dx) };
        }
        currentDist += segmentDist;
      }
    }
    accumulatedDistance += pathLength;
  }
  const last = allSamples[allSamples.length - 1];
  const a = last[last.length - 1], b = last[last.length - 2];
  return { x: a.x, y: a.y, angle: Math.atan2(a.y - b.y, a.x - b.x) };
};

// Legacy wrapper for callers that pass raw paths
export const getPointAndAngleAtDistance = (
  paths: BezierPath[],
  targetDistance: number
): PointWithAngle => {
  const allSamples = paths.map(p => sampleBezierPath(p, 50));
  const pathLengths = allSamples.map(s => calculatePathLength(s));
  return getPointAndAngleAtDistanceFast(allSamples, pathLengths, targetDistance);
};

// Interpolate between two hex colors
export const interpolateColor = (color1: string, color2: string, t: number): string => {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);
  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};
