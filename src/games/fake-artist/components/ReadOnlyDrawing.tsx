import type { CanvasPath } from 'react-sketch-canvas';

interface ReadOnlyDrawingProps {
  paths: CanvasPath[];
}

const LOGICAL_WIDTH = 600;
const LOGICAL_HEIGHT = 800;
const SMOOTHING = 0.2;

type CanvasPoint = CanvasPath['paths'][number];

function getControlPoint(
  current: CanvasPoint,
  previous: CanvasPoint | undefined,
  next: CanvasPoint | undefined,
  reverse = false
) {
  const previousPoint = previous ?? current;
  const nextPoint = next ?? current;
  const deltaX = nextPoint.x - previousPoint.x;
  const deltaY = nextPoint.y - previousPoint.y;
  const length = Math.sqrt(deltaX ** 2 + deltaY ** 2);
  const angle = Math.atan2(deltaY, deltaX) + (reverse ? Math.PI : 0);

  return {
    x: current.x + Math.cos(angle) * SMOOTHING * length,
    y: current.y + Math.sin(angle) * SMOOTHING * length,
  };
}

export function buildSvgPathData(points: readonly CanvasPoint[]) {
  return points.reduce((pathData, point, index) => {
    if (index === 0) return `M ${point.x},${point.y}`;

    const startControlPoint = getControlPoint(
      points[index - 1],
      points[index - 2],
      point
    );
    const endControlPoint = getControlPoint(
      point,
      points[index - 1],
      points[index + 1],
      true
    );

    return `${pathData} C ${startControlPoint.x},${startControlPoint.y} ${endControlPoint.x},${endControlPoint.y} ${point.x},${point.y}`;
  }, '');
}

/**
 * Render persisted paths declaratively for voting/guessing/result screens.
 * This does not depend on the imperative ReactSketchCanvas ref being mounted.
 */
export function ReadOnlyDrawing({ paths }: ReadOnlyDrawingProps) {
  return (
    <svg
      aria-label="完成した絵"
      className="h-full w-full"
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {paths.map((path, pathIndex) => {
        if (!Array.isArray(path.paths) || path.paths.length === 0) return null;

        // ReactSketchCanvas represents erasing as drawMode=false. The game
        // canvas is white, so drawing those paths in white preserves the final
        // appearance without relying on the library's internal SVG masks.
        const strokeColor = path.drawMode === false ? '#ffffff' : path.strokeColor;
        const firstPoint = path.paths[0];

        if (path.paths.length === 1) {
          return (
            <circle
              key={pathIndex}
              cx={firstPoint.x}
              cy={firstPoint.y}
              fill={strokeColor}
              r={path.strokeWidth / 2}
            />
          );
        }

        return (
          <path
            key={pathIndex}
            d={buildSvgPathData(path.paths)}
            fill="none"
            stroke={strokeColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={path.strokeWidth}
          />
        );
      })}
    </svg>
  );
}
