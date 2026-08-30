import React, { useEffect, useRef } from "react";

export interface ParticleBackgroundProps {
  mode?: "stadium" | "battle" | "celebration" | "ambient";
  className?: string;
  intensity?: "low" | "medium" | "high";
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  maxAlpha: number;
  decay: number;
  life: number;
  maxLife: number;
}

export const ParticleBackground: React.FC<ParticleBackgroundProps> = ({
  mode = "stadium",
  className = "",
  intensity = "medium",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    const countMap = { low: 25, medium: 50, high: 90 };
    const maxParticles = countMap[intensity];
    const particles: Particle[] = [];

    const getColors = () => {
      switch (mode) {
        case "battle":
          return ["#00f0ff", "#38bdf8", "#ff9900", "#ff5500", "#ffffff", "#fbbf24"];
        case "celebration":
          return ["#ffd700", "#fbbf24", "#00f0ff", "#f43f5e", "#ffffff", "#10b981"];
        case "ambient":
          return ["rgba(0, 240, 255, 0.4)", "rgba(255, 153, 0, 0.4)", "rgba(255, 255, 255, 0.3)"];
        case "stadium":
        default:
          return ["#00f0ff", "#00c4cc", "#ffaa00", "#ff6b00", "rgba(255, 255, 255, 0.6)"];
      }
    };

    const colors = getColors();

    const createParticle = (fresh = false): Particle => {
      const color = colors[Math.floor(Math.random() * colors.length)]!;
      const maxLife = Math.random() * 120 + 60;
      return {
        x: Math.random() * width,
        y: fresh ? Math.random() * height : height + 10,
        vx: (Math.random() - 0.5) * (mode === "battle" ? 1.5 : 0.8),
        vy: -(Math.random() * (mode === "battle" ? 2.2 : 1.2) + 0.4),
        radius: Math.random() * (mode === "celebration" ? 3.5 : 2.2) + 1,
        color,
        alpha: 0,
        maxAlpha: Math.random() * 0.7 + 0.3,
        decay: 1 / maxLife,
        life: 0,
        maxLife,
      };
    };

    for (let i = 0; i < maxParticles; i++) {
      particles.push(createParticle(true));
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        p.life += 1;
        p.x += p.vx;
        p.y += p.vy;

        // Fade in and out
        const halfLife = p.maxLife / 2;
        if (p.life < halfLife) {
          p.alpha = (p.life / halfLife) * p.maxAlpha;
        } else {
          p.alpha = Math.max(0, (1 - (p.life - halfLife) / halfLife) * p.maxAlpha);
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = mode === "battle" ? 8 : 4;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (p.life >= p.maxLife || p.y < -20 || p.x < -20 || p.x > width + 20) {
          particles[i] = createParticle(false);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
    };
  }, [mode, intensity]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none z-0 ${className}`}
    />
  );
};
