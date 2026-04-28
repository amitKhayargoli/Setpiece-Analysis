"use client";

import { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { SetPiece, fetchSetPieceById } from "@/lib/api";

interface PitchVisualizationProps {
  selectedSetPieceId?: string;
}

// SVG viewBox: 0 0 1050 680
// Pitch boundary from SVG: x=105, y=68, width=840, height=544
const SVG_WIDTH = 1050;
const SVG_HEIGHT = 680;
const PITCH_LEFT = 105;
const PITCH_TOP = 68;
const PITCH_WIDTH = 840;
const PITCH_HEIGHT = 544;

// Adjusted mapping for penalty spots and shots
const mapX = (x: number) =>
  PITCH_LEFT + Math.max(0, Math.min(1, x / 100)) * PITCH_WIDTH;
const mapY = (y: number) =>
  PITCH_TOP + Math.max(0, Math.min(1, y / 100)) * PITCH_HEIGHT;

const snapToNearestPenaltySpot = (x: number) => {
  // SVG CX for spots are 193 and 857.
  return {
    x: x >= 50 ? 89.52 : 10.47,
    y: 50,
  };
};

export function PitchVisualization({
  selectedSetPieceId,
}: PitchVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Track PIXI readiness with a ref (not state) — never triggers a re-render
  const appRef = useRef<PIXI.Application | null>(null);
  const graphicsRef = useRef<PIXI.Graphics | null>(null);
  const ballTextureRef = useRef<PIXI.Texture | null>(null);
  const pixiReadyRef = useRef(false);

  const [setPiece, setSetPiece] = useState<SetPiece | null>(null);
  const [loading, setLoading] = useState(false);

  // ── 1. Init PIXI exactly once, never re-run ──────────────────────────────
  useEffect(() => {
    if (pixiReadyRef.current) return;
    if (!canvasRef.current) return;

    let isCancelled = false;
    const app = new PIXI.Application();

    (async () => {
      await app.init({
        canvas: canvasRef.current!,
        width: SVG_WIDTH,
        height: SVG_HEIGHT,
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: true,
      });

      if (isCancelled) {
        app.destroy(true, { children: true, texture: true });
        return;
      }

      appRef.current = app;
      pixiReadyRef.current = true;

      // Load ball texture
      try {
        const texture = await PIXI.Assets.load("/Soccerball.svg");
        ballTextureRef.current = texture;
      } catch (err) {
        console.error("Failed to load ball texture:", err);
      }

      const graphics = new PIXI.Graphics();
      app.stage.addChild(graphics);
      graphicsRef.current = graphics;
    })();

    return () => {
      isCancelled = true;
      // Only destroy on true unmount
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
        pixiReadyRef.current = false;
      }
    };
  }, []); // Empty deps — runs once on mount, cleans up on unmount only

  // ── 2. Fetch set-piece data when ID changes ───────────────────────────────
  useEffect(() => {
    if (!selectedSetPieceId) {
      setSetPiece(null);
      return;
    }

    let active = true;
    setLoading(true);

    fetchSetPieceById(selectedSetPieceId)
      .then((data) => {
        if (active) {
          setSetPiece(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedSetPieceId]);

  // ── 3. Redraw when setPiece changes ──────────────────────────────────────
  useEffect(() => {
    const draw = () => {
      if (!pixiReadyRef.current || !graphicsRef.current || !appRef.current)
        return;

      const app = appRef.current;
      const graphics = graphicsRef.current;

      graphics.clear();

      // Remove previous ball sprites
      app.stage.children
        .filter((c) => c instanceof PIXI.Sprite)
        .forEach((c) => c.destroy());

      if (setPiece) {
        drawSetPiece(graphics, setPiece, ballTextureRef.current, app.stage);
      }
    };

    if (pixiReadyRef.current) {
      draw();
    } else {
      // Rare race: data resolved before PIXI async init finished — retry
      const t = setTimeout(draw, 100);
      return () => clearTimeout(t);
    }
  }, [setPiece]);

  return (
    <div className="flex flex-col items-center gap-4 w-full h-full justify-center">
      <div className="w-full max-w-[1700px] aspect-[105/68] overflow-hidden relative border-4 border-white/20">
        <img
          src="/pitch.svg"
          alt="Football Pitch"
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ objectFit: "fill" }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full z-10"
          style={{ objectFit: "fill" }}
        />
        {/* Canvas is ALWAYS in the DOM — never conditionally rendered */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full z-10"
          style={{ objectFit: "fill" }}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/10">
            <span className="text-white text-sm">Loading...</span>
          </div>
        )}
      </div>

      {setPiece && (
        <div className="bg-card p-4 rounded-lg shadow border w-full max-w-5xl shrink-0">
          <h3 className="text-lg font-bold">Event Details</h3>
          <div className="grid grid-cols-4 gap-4 mt-2 text-sm">
            <div>
              <span className="text-muted-foreground block">Player</span>
              <span className="font-medium">
                {setPiece.player?.shortName || "Unknown"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Time</span>
              <span className="font-medium">
                {Math.floor(setPiece.eventSec / 60)}&apos; (
                {setPiece.matchPeriod})
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Outcome</span>
              <span className="font-medium capitalize">
                {setPiece.outcomeType || "Unknown"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Goal</span>
              <span
                className={`font-medium ${setPiece.isGoal ? "text-green-600" : ""}`}
              >
                {setPiece.isGoal ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function drawSetPiece(
  g: PIXI.Graphics,
  sp: SetPiece,
  ballTexture: PIXI.Texture | null,
  stage: PIXI.Container,
) {
  const isCorner = sp.type.toLowerCase() === "corner";
  const isPenalty =
    sp.type.toLowerCase() === "penalty" ||
    sp.subType.toLowerCase() === "penalty";

  const snapToNearestCorner = (x: number, y: number) => ({
    x: x >= 50 ? 100 : 0,
    y: y >= 50 ? 100 : 0,
  });

  const startPoint = isCorner
    ? snapToNearestCorner(sp.startX, sp.startY)
    : isPenalty
      ? snapToNearestPenaltySpot(sp.startX)
      : { x: sp.startX, y: sp.startY };

  const startX = mapX(startPoint.x);
  const startY = mapY(startPoint.y);

  // Use Soccerball sprite if available, otherwise fallback to circle
  if (ballTexture) {
    const ball = new PIXI.Sprite(ballTexture);
    ball.anchor.set(0.5);
    ball.position.set(startX, startY);
    const ballSize = isCorner || isPenalty ? 12 : 16;
    ball.width = ballSize;
    ball.height = ballSize;
    stage.addChild(ball);
  } else {
    // Start marker (yellow) fallback
    g.circle(startX, startY, isCorner || isPenalty ? 4 : 6);
    g.fill({ color: 0xffff00 });
  }

  if (sp.endX !== null && sp.endY !== null) {
    let finalEndX = sp.endX;
    let finalEndY = sp.endY;

    // ── Fix penalty vertical bug (keep your logic) ──
    if (
      isPenalty &&
      Math.abs(sp.endX - startPoint.x) < 2 &&
      Math.abs(sp.endY - startPoint.y) > 5
    ) {
      finalEndX = startPoint.x >= 50 ? 100 : 0;
      finalEndY = sp.endY;
    }

    const endPX = mapX(finalEndX);
    const endPY = mapY(finalEndY);

    // ── 🎯 BEZIER CONTROL POINT (the magic) ──

    const dx = endPX - startX;
    const dy = endPY - startY;

    // Midpoint
    let cx = (startX + endPX) / 2;
    let cy = (startY + endPY) / 2;

    // Perpendicular offset (creates curve)
    const length = Math.sqrt(dx * dx + dy * dy) || 1;

    // Normal vector (perpendicular direction)
    const nx = -dy / length;
    const ny = dx / length;

    // Curve strength (tune this)
    const curveStrength = Math.min(20, length * 0.25);

    // Randomize direction slightly for realism
    const direction = Math.random() > 0.5 ? 1 : -1;

    cx += nx * curveStrength * direction;
    cy += ny * curveStrength * direction;

    // ── Draw curve ──
    g.setStrokeStyle({
      width: 3,
      color: sp.isGoal
        ? 0x00ff00
        : sp.outcomeType === "successful"
          ? 0x00aaff
          : 0xffffff,
      alpha: 0.85,
    });

    g.moveTo(startX, startY);
    g.quadraticCurveTo(cx, cy, endPX, endPY);
    g.stroke();

    // ── End marker ──
    g.circle(endPX, endPY, 5);
    g.fill({ color: sp.isGoal ? 0x00ff00 : 0xff0000 });
  }

  // Additional path positions
  if (sp.sourceEvent?.positions && sp.sourceEvent.positions.length > 2) {
    g.setStrokeStyle({ width: 2, color: 0xffa500, alpha: 0.5 });
    g.moveTo(startX, startY);
    for (let i = 1; i < sp.sourceEvent.positions.length; i++) {
      const pos = sp.sourceEvent.positions[i];
      g.lineTo(mapX(pos.x), mapY(pos.y));
    }
    g.stroke();
  }
}
