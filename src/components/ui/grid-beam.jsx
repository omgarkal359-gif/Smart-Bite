import React, { useEffect, useRef, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export const PALETTES = {
  colorful: ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'],
  ocean: ['#06b6d4', '#0284c7', '#3b82f6', '#6366f1'],
  sunset: ['#f97316', '#f43f5e', '#ef4444', '#f59e0b'],
  mono: ['#ffffff', '#e2e8f0', '#94a3b8', '#64748b'],
};

/**
 * Headless hook to render animated light beams traveling along grid paths / borders on a canvas.
 */
export function useGridBeam({
  rows = 1,
  cols = 1,
  colorVariant = 'colorful',
  theme = 'dark',
  active = true,
  breathe = true,
  duration = 3.4,
  strength = 1,
  borderRadius = 12,
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
    const numBeams = Math.max(4, (rows + cols) * 2);
    let beams = [];

    const resetBeams = (width, height) => {
      beams = [];
      const gridW = width / Math.max(1, cols);
      const gridH = height / Math.max(1, rows);

      for (let i = 0; i < numBeams; i++) {
        const isHorizontal = Math.random() > 0.5;
        const row = Math.floor(Math.random() * (rows + 1));
        const col = Math.floor(Math.random() * (cols + 1));

        const startX = isHorizontal ? 0 : col * gridW;
        const startY = isHorizontal ? row * gridH : 0;
        const endX = isHorizontal ? width : col * gridW;
        const endY = isHorizontal ? row * gridH : height;

        const color = palette[i % palette.length];
        const speed = (0.25 + Math.random() * 0.45) * (3.5 / Math.max(0.5, duration));
        const length = 70 + Math.random() * 90;

        beams.push({
          x: startX,
          y: startY,
          startX,
          startY,
          endX,
          endY,
          isHorizontal,
          progress: Math.random(),
          speed,
          length,
          color,
          width: 2.2 + Math.random() * 1.5,
        });
      }
    };

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      resetBeams(rect.width, rect.height);
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

      if (!active) {
        animId = requestAnimationFrame(render);
        return;
      }

      const breathOpacity = breathe
        ? 0.7 + Math.sin(elapsed * (2.5 / Math.max(0.5, duration))) * 0.3
        : 1;

      // Render traveling light beams
      beams.forEach((b) => {
        b.progress += (b.speed / 60);
        if (b.progress > 1) {
          b.progress = 0;
          b.color = palette[Math.floor(Math.random() * palette.length)];
        }

        const currX = b.startX + (b.endX - b.startX) * b.progress;
        const currY = b.startY + (b.endY - b.startY) * b.progress;

        const tailX = b.isHorizontal ? currX - b.length : currX;
        const tailY = b.isHorizontal ? currY : currY - b.length;

        const grad = ctx.createLinearGradient(tailX, tailY, currX, currY);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        grad.addColorStop(0.65, b.color);
        grad.addColorStop(1, '#ffffff');

        ctx.save();
        ctx.globalAlpha = breathOpacity * strength;
        ctx.shadowBlur = 14 * strength;
        ctx.shadowColor = b.color;
        ctx.strokeStyle = grad;
        ctx.lineWidth = b.width;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(currX, currY);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(currX, currY, b.width, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      // Perimeter glowing beam
      const borderProgress = (elapsed / Math.max(0.5, duration)) % 1;
      const totalPerimeter = (width + height) * 2;
      const dist = borderProgress * totalPerimeter;

      let bx = 0, by = 0;
      if (dist < width) {
        bx = dist; by = 0;
      } else if (dist < width + height) {
        bx = width; by = dist - width;
      } else if (dist < 2 * width + height) {
        bx = width - (dist - (width + height)); by = height;
      } else {
        bx = 0; by = height - (dist - (2 * width + height));
      }

      ctx.save();
      ctx.globalAlpha = breathOpacity * 0.95 * strength;
      ctx.shadowBlur = 18 * strength;
      ctx.shadowColor = palette[0];
      ctx.fillStyle = palette[0];
      ctx.beginPath();
      ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      resizeObserver.disconnect();
    };
  }, [rows, cols, colorVariant, theme, active, breathe, duration, strength, borderRadius]);

  return { canvasRef, rows, cols };
}

/**
 * GridBeamCanvas - Canvas element overlay
 */
export const GridBeamCanvas = forwardRef(function GridBeamCanvas(
  { className, style, borderRadius = 12, ...props },
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
 * GridBeamDividers - SVG grid line dividers
 */
export function GridBeamDividers({ cols = 1, rows = 1, className }) {
  return (
    <div className={cn("absolute inset-0 pointer-events-none z-0 overflow-hidden", className)}>
      <svg className="w-full h-full opacity-15 stroke-current text-white/40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="grid-beam-pattern"
            width={`${100 / Math.max(1, cols)}%`}
            height={`${100 / Math.max(1, rows)}%`}
            patternUnits="userSpaceOnUse"
          >
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-beam-pattern)" />
      </svg>
    </div>
  );
}

/**
 * GridBeamContent - Relative wrapper for card inner items
 */
export function GridBeamContent({ children, className, ...props }) {
  return (
    <div className={cn("relative z-10 h-full w-full", className)} {...props}>
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
  rows = 1,
  cols = 1,
  colorVariant = "colorful",
  theme = "dark",
  active = true,
  breathe = true,
  duration = 3.4,
  strength = 1,
  borderRadius = 16,
  style,
  ...props
}) {
  const { canvasRef } = useGridBeam({
    rows,
    cols,
    colorVariant,
    theme,
    active,
    breathe,
    duration,
    strength,
    borderRadius,
  });

  return (
    <div
      className={cn("relative overflow-hidden group", className)}
      style={{ borderRadius: `${borderRadius}px`, ...style }}
      {...props}
    >
      <GridBeamDividers cols={cols} rows={rows} />
      <GridBeamCanvas ref={canvasRef} borderRadius={borderRadius} />
      <GridBeamContent>{children}</GridBeamContent>
    </div>
  );
}

export default GridBeam;
