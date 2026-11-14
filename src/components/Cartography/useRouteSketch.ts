import { useCallback, useRef, useState } from 'react';
import { evaluateRouteStroke } from '../../domain/routeDraw.ts';
import type { CircusState, MapZoomMode, RouteEvaluation } from '../../types.ts';
import { canvasPxToMap, type RegionCamera, type ViewportTransform } from './mapRenderer.ts';

export function useRouteSketch(
  state: CircusState,
  zoom: MapZoomMode,
  evadeWar: boolean,
  onDraftChange: (draft: RouteEvaluation | null) => void,
  onPanCamera?: (updater: (prev: Required<RegionCamera>) => Required<RegionCamera>) => void,
) {
  const [drawing, setDrawing] = useState(false);
  const [panning, setPanning] = useState(false);
  const strokeRef = useRef<{ x: number; y: number }[]>([]);
  const vpRef = useRef<ViewportTransform | null>(null);
  const panAnchorRef = useRef<{ clientX: number; clientY: number; vp: ViewportTransform } | null>(null);

  const setViewport = useCallback((vp: ViewportTransform) => {
    vpRef.current = vp;
  }, []);

  const toCanvasPx = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      px: (clientX - rect.left) * scaleX,
      py: (clientY - rect.top) * scaleY,
    };
  };

  const toMapPoint = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
    if (!vpRef.current) return null;
    const { px, py } = toCanvasPx(clientX, clientY, canvas);
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

    // 右键拖拽、中键拖拽或按住 Alt 左键拖拽：自由平移缩放后的疆域相机视野
    if ((e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) && vpRef.current && onPanCamera) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setPanning(true);
      panAnchorRef.current = { clientX: e.clientX, clientY: e.clientY, vp: vpRef.current };
      return;
    }

    if (e.button !== 0) return;
    const pt = toMapPoint(e.clientX, e.clientY, e.currentTarget);
    if (!pt) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawing(true);
    strokeRef.current = [{ x: state.world.pos.x, y: state.world.pos.y }, pt];
    onDraftChange(evaluate(strokeRef.current));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (panning && panAnchorRef.current && onPanCamera) {
      const anchor = panAnchorRef.current;
      const startMap = canvasPxToMap(
        toCanvasPx(anchor.clientX, anchor.clientY, e.currentTarget).px,
        toCanvasPx(anchor.clientX, anchor.clientY, e.currentTarget).py,
        anchor.vp,
      );
      const curMap = canvasPxToMap(
        toCanvasPx(e.clientX, e.clientY, e.currentTarget).px,
        toCanvasPx(e.clientX, e.clientY, e.currentTarget).py,
        anchor.vp,
      );
      const dx = startMap.x - curMap.x;
      const dy = startMap.y - curMap.y;
      const baseCx = anchor.vp.viewX + anchor.vp.viewW / 2;
      const baseCy = anchor.vp.viewY + anchor.vp.viewH / 2;
      onPanCamera(prev => ({
        zoomScale: prev.zoomScale,
        centerX: baseCx + dx,
        centerY: baseCy + dy,
      }));
      return;
    }

    if (!drawing || zoom === 'world') return;
    const pt = toMapPoint(e.clientX, e.clientY, e.currentTarget);
    if (!pt) return;
    const prev = strokeRef.current[strokeRef.current.length - 1];
    if (prev && Math.hypot(pt.x - prev.x, pt.y - prev.y) < 0.45) return;
    strokeRef.current = [...strokeRef.current, pt];
    onDraftChange(evaluate(strokeRef.current));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (panning) {
      setPanning(false);
      panAnchorRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      return;
    }
    if (!drawing) return;
    setDrawing(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onDraftChange(evaluate(strokeRef.current));
  };

  return { drawing, panning, setViewport, toCanvasPx, toMapPoint, onPointerDown, onPointerMove, onPointerUp };
}
