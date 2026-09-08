import React, { useEffect, useRef, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export const PALETTES = {
  orange: ['#FF5722', '#F97316', '#FF6D00', '#FF7043', '#FF8A65'],
  colorful: ['#FF5722', '#F97316', '#FF6D00', '#FF7043', '#FF8A65'],
  sunset: ['#FF5722', '#F97316', '#FF6D00', '#FF7043', '#FF8A65'],
  ocean: ['#FF5722', '#F97316', '#FF6D00', '#FF7043', '#FF8A65'],
  mono: ['#FF5722', '#F97316', '#FF6D00', '#FF7043', '#FF8A65'],
};

/**
 * Headless hook to render animated light beams strictly along the rounded border perimeter.
 */
export function useGridBeam({
  colorVariant = 'orange',
  theme = 'dark',
  active = true,
  breathe = true,
  duration = 4.0,
  strength = 1,
  borderRadius = 24,
  beamCount = 4,
} = {}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let startTime = null;

    const palette = PALETTES[colorVariant] || PALETTES.colorful;

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    const resizeObserver = new ResizeObserver(() => handleResize());
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    const render = (time) => {
      if (!startTime) startTime = time;
      const elapsed = (time - startTime) / 1000;

      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      if (!active || width === 0 || height === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      const breathOpacity = breathe
        ? 0.75 + Math.sin(elapsed * (2.5 / Math.max(0.5, duration))) * 0.25
        : 1;

      const r = Math.min(borderRadius, width / 2, height / 2);
      const perimeter = 2 * (width + height - 4 * r) + 2 * Math.PI * r;
      if (perimeter <= 0) return;

      // Construct rounded rectangle path along border
      const path = new Path2D();
      if (ctx.roundRect) {
        path.roundRect(1, 1, width - 2, height - 2, r);
      } else {
        path.moveTo(r + 1, 1);
        path.lineTo(width - r - 1, 1);
        path.arcTo(width - 1, 1, width - 1, r + 1, r);
        path.lineTo(width - 1, height - r - 1);
        path.arcTo(width - 1, height - 1, width - r - 1, height - 1, r);
        path.lineTo(r + 1, height - 1);
        path.arcTo(1, height - 1, 1, height - r - 1, r);
        path.lineTo(1, r + 1);
        path.arcTo(1, 1, r + 1, 1, r);
        path.closePath();
      }

      const beamLength = Math.max(50, perimeter * 0.18);
      const gapLength = perimeter - beamLength;

      // Draw subtle ambient border track
      ctx.save();
      ctx.globalAlpha = 0.15 * strength;
      ctx.strokeStyle = palette[0];
      ctx.lineWidth = 1.5;
      ctx.stroke(path);
      ctx.restore();

      // Render parallel traveling border beams
      for (let i = 0; i < beamCount; i++) {
        const speed = (perimeter / Math.max(1, duration)) * (i % 2 === 0 ? 1 : 0.85);
        const offset = (i / beamCount) * perimeter + (elapsed * speed);
        const color = palette[i % palette.length];

        // Pass 1: Outer glow
        ctx.save();
        ctx.globalAlpha = breathOpacity * 0.85 * strength;
        ctx.shadowBlur = 14 * strength;
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([beamLength, gapLength]);
        ctx.lineDashOffset = -offset;
        ctx.lineCap = 'round';
        ctx.stroke(path);
        ctx.restore();

        // Pass 2: Intense inner core beam
        ctx.save();
        ctx.globalAlpha = breathOpacity * 0.95 * strength;
        ctx.shadowBlur = 6 * strength;
        ctx.shadowColor = '#ffffff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([beamLength * 0.4, gapLength + beamLength * 0.6]);
        ctx.lineDashOffset = -offset - (beamLength * 0.3);
        ctx.lineCap = 'round';
        ctx.stroke(path);
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      resizeObserver.disconnect();
    };
  }, [colorVariant, theme, active, breathe, duration, strength, borderRadius, beamCount]);

  return { canvasRef };
}

/**
 * GridBeamCanvas - Canvas element overlay
 */
export const GridBeamCanvas = forwardRef(function GridBeamCanvas(
  { className, style, borderRadius = 24, ...props },
  ref
) {
  return (
    <canvas
      ref={ref}
      className={cn("absolute inset-0 pointer-events-none w-full h-full z-0", className)}
      style={{ borderRadius: `${borderRadius}px`, ...style }}
      {...props}
    />
  );
});

/**
 * GridBeamDividers - Optional subtle perimeter border outline
 */
export function GridBeamDividers({ borderRadius = 24, className }) {
  return (
    <div className={cn("absolute inset-0 pointer-events-none z-0 overflow-hidden", className)}>
      <div
        className="w-full h-full border border-white/10"
        style={{ borderRadius: `${borderRadius}px` }}
      />
    </div>
  );
}

/**
 * GridBeamContent - Relative wrapper for card inner items
 */
export function GridBeamContent({ children, className, style, ...props }) {
  return (
    <div
      className={cn("relative z-10 h-full w-full", className)}
      style={{
        display: 'inherit',
        flexDirection: 'inherit',
        alignItems: 'inherit',
        justifyContent: 'inherit',
        gap: 'inherit',
        padding: 'inherit',
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * GridBeam - Main compound component
 */
export function GridBeam({
  children,
  className,
  colorVariant = "orange",
  theme = "dark",
  active = true,
  breathe = true,
  duration = 4.0,
  strength = 1,
  borderRadius = 24,
  beamCount = 4,
  style,
  ...props
}) {
  const { canvasRef } = useGridBeam({
    colorVariant,
    theme,
    active,
    breathe,
    duration,
    strength,
    borderRadius,
    beamCount,
  });

  return (
    <div
      className={cn("relative overflow-hidden group", className)}
      style={{ borderRadius: `${borderRadius}px`, ...style }}
      {...props}
    >
      <GridBeamDividers borderRadius={borderRadius} />
      <GridBeamCanvas ref={canvasRef} borderRadius={borderRadius} />
      <GridBeamContent>{children}</GridBeamContent>
    </div>
  );
}

export default GridBeam;
