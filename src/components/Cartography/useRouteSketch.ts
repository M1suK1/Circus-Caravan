import { useCallback, useEffect, useRef, useState } from 'react';
import { evaluateRouteStroke, mergeRouteEvaluations } from '../../domain/routeDraw.ts';
import type { CircusState, MapZoomMode, RouteEvaluation } from '../../types.ts';
import { canvasPxToMap, type RegionCamera, type ViewportTransform } from './mapRenderer.ts';

export function useRouteSketch(
  state: CircusState,
  zoom: MapZoomMode,
  evadeWar: boolean,
  routeDraft: RouteEvaluation | null,
  onDraftChange: (draft: RouteEvaluation | null) => void,
  onPanCamera?: (updater: (prev: Required<RegionCamera>) => Required<RegionCamera>) => void,
) {
  const [drawing, setDrawing] = useState(false);
  const [panning, setPanning] = useState(false);
  const strokeRef = useRef<{ x: number; y: number }[]>([]);
  const baseDraftRef = useRef<RouteEvaluation | null>(null);
  const preStrokeDraftRef = useRef<RouteEvaluation | null>(null);
  const vpRef = useRef<ViewportTransform | null>(null);
  const panAnchorRef = useRef<{ clientX: number; clientY: number; vp: ViewportTransform } | null>(null);

  // 仅当外部明确将 routeDraft 置空（点击「擦除墨线」、启程或跨区）时才清空笔迹缓存
  useEffect(() => {
    if (!routeDraft) {
      strokeRef.current = [];
      baseDraftRef.current = null;
    }
  }, [routeDraft]);

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

  const emitMerged = useCallback(
    (newStroke: { x: number; y: number }[]): RouteEvaluation | null => {
      const map = state.world.regions[state.world.currentRegionId].map;
      if (!map) return null;
      if (newStroke.length < 2) {
        if (baseDraftRef.current) onDraftChange(baseDraftRef.current);
        return baseDraftRef.current;
      }
      const ext = evaluateRouteStroke(map, newStroke, state, evadeWar);
      const merged = baseDraftRef.current ? mergeRouteEvaluations(baseDraftRef.current, ext) : ext;
      onDraftChange(merged);
      return merged;
    },
    [state, evadeWar, onDraftChange],
  );

  const restorePreStrokeDraft = useCallback(() => {
    const prev = preStrokeDraftRef.current;
    baseDraftRef.current = null;
    strokeRef.current = [];
    onDraftChange(prev);
  }, [onDraftChange]);

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

    preStrokeDraftRef.current = routeDraft;
    if (routeDraft && routeDraft.validPoints.length >= 2) {
      // 冻结已有有效路线作为不可变前段，仅对本笔新轨迹增量拼接，杜绝第 3 笔及以上浮点漂移重置
      baseDraftRef.current = {
        ...routeDraft,
        blocked: false,
        blockReason: undefined,
        points: routeDraft.validPoints.map(p => ({ ...p })),
        validPoints: routeDraft.validPoints.map(p => ({ ...p })),
      };
      const tail = baseDraftRef.current.validPoints[baseDraftRef.current.validPoints.length - 1]!;
      strokeRef.current = Math.hypot(pt.x - tail.x, pt.y - tail.y) < 0.25 ? [tail] : [tail, pt];
    } else {
      baseDraftRef.current = null;
      const start = { x: state.world.pos.x, y: state.world.pos.y };
      strokeRef.current = Math.hypot(pt.x - start.x, pt.y - start.y) < 0.25 ? [start] : [start, pt];
    }

    emitMerged(strokeRef.current);
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
    emitMerged(strokeRef.current);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>): { committed: RouteEvaluation | null; previous: RouteEvaluation | null } | null => {
    if (panning) {
      setPanning(false);
      panAnchorRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      return null;
    }
    if (!drawing) return null;
    setDrawing(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const committed = emitMerged(strokeRef.current);
    const previous = preStrokeDraftRef.current;
    baseDraftRef.current = null;
    return { committed, previous };
  };

  return {
    drawing,
    panning,
    setViewport,
    toCanvasPx,
    toMapPoint,
    restorePreStrokeDraft,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
