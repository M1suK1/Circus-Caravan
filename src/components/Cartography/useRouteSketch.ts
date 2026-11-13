import { useCallback, useRef, useState } from 'react';
import { evaluateRouteStroke } from '../../domain/routeDraw.ts';
import type { CircusState, MapZoomMode, RouteEvaluation } from '../../types.ts';
import { canvasPxToMap, type ViewportTransform } from './mapRenderer.ts';

export function useRouteSketch(
  state: CircusState,
  zoom: MapZoomMode,
  evadeWar: boolean,
  onDraftChange: (draft: RouteEvaluation | null) => void,
) {
  const [drawing, setDrawing] = useState(false);
  const strokeRef = useRef<{ x: number; y: number }[]>([]);
  const vpRef = useRef<ViewportTransform | null>(null);

  const setViewport = useCallback((vp: ViewportTransform) => {
    vpRef.current = vp;
  }, []);

  const toMapPoint = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    const px = (clientX - rect.left) * scaleX;
    const py = (clientY - rect.top) * scaleY;
    if (!vpRef.current) return null;
    return canvasPxToMap(px, py, vpRef.current);
  };

  const evaluate = useCallback(
    (points: { x: number; y: number }[]) => {
      const map = state.world.regions[state.world.currentRegionId].map;
      if (!map || points.length < 2) return null;
      return evaluateRouteStroke(map, points, state, evadeWar);
    },
    [state, evadeWar],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (zoom === 'world') return;
    const pt = toMapPoint(e.clientX, e.clientY, e.currentTarget);
    if (!pt) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawing(true);
    // 总是以马车当前连续位置作为墨线起点
    strokeRef.current = [{ x: state.world.pos.x, y: state.world.pos.y }, pt];
    onDraftChange(evaluate(strokeRef.current));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing || zoom === 'world') return;
    const pt = toMapPoint(e.clientX, e.clientY, e.currentTarget);
    if (!pt) return;
    const prev = strokeRef.current[strokeRef.current.length - 1];
    if (prev && Math.hypot(pt.x - prev.x, pt.y - prev.y) < 0.7) return;
    strokeRef.current = [...strokeRef.current, pt];
    onDraftChange(evaluate(strokeRef.current));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    setDrawing(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onDraftChange(evaluate(strokeRef.current));
  };

  return { drawing, setViewport, toMapPoint, onPointerDown, onPointerMove, onPointerUp };
}
