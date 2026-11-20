"use client";

import { useEffect, useRef } from "react";

const BANNER_TEXT = "BUILD IT · FLY IT";

// biplane.png is 1537×1085. The tow hook sits at the tip of the tail fin,
// about 9% in from the left and 69% down the image.
const PLANE_W = 180;
const PLANE_H = (PLANE_W * 1085) / 1537;
const HOOK_X = -PLANE_W / 2 + 0.09 * PLANE_W;
const HOOK_Y = -PLANE_H / 2 + 0.69 * PLANE_H;

/**
 * Red biplane towing a banner across the sky on a swooping sine path.
 * The banner follows the plane's trail, so it bends with every curve.
 */
export default function SkyPlane() {
  const svgRef = useRef<SVGSVGElement>(null);
  const planeRef = useRef<SVGGElement>(null);
  const bannerRef = useRef<SVGPathElement>(null);
  const centerRef = useRef<SVGPathElement>(null);
  const ropeRef = useRef<SVGPathElement>(null);
  const poleRef = useRef<SVGLineElement>(null);
  const textRef = useRef<SVGTextElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let x = Number.NaN;

    const tick = (now: number) => {
      const W = svg.clientWidth;
      const H = svg.clientHeight;
      const small = W < 640;
      const scale = small ? 0.6 : 0.95;
      const A = small ? 26 : 46; // swoop height
      const lambda = Math.max(small ? 360 : 560, W * 0.6); // swoop length
      const baseY = H * (small ? 0.13 : 0.15);
      const tail = -HOOK_X * scale;
      const drop = HOOK_Y * scale; // banner hangs level with the tail, not the plane's centre
      const rope = 60 * scale;
      const bannerLen = small ? 170 : 270;
      const bannerH = small ? 30 : 44;
      const tow = tail + rope + bannerLen;
      const X0 = -140;
      const X1 = W + 140 + tow;
      const speed = Math.max(90, W / 11);

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      if (Number.isNaN(x)) x = reduce ? W * 0.62 : X0 + (X1 - X0) * 0.35;
      if (!reduce) {
        x += speed * dt;
        if (x > X1) x = X0;
      }

      const k = (2 * Math.PI) / lambda;
      const yAt = (px: number) => baseY + A * Math.sin(k * px);
      const ang = Math.atan(A * k * Math.cos(k * x));
      const py = yAt(x);

      planeRef.current?.setAttribute(
        "transform",
        `translate(${x} ${py}) rotate(${(ang * 180) / Math.PI}) scale(${scale})`,
      );

      // Tail hook in world space (local hook point rotated with the plane)
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const hx = x + (HOOK_X * cos - HOOK_Y * sin) * scale;
      const hy = py + (HOOK_X * sin + HOOK_Y * cos) * scale;

      // Banner centreline, front (near plane) → back
      const N = 20;
      const front = x - tail - rope;
      const pts: [number, number][] = [];
      for (let i = 0; i <= N; i++) {
        const bx = front - (bannerLen * i) / N;
        const flutter = reduce ? 0 : Math.sin(i * 0.7 - t * 9) * 3 * (i / N);
        pts.push([bx, yAt(bx) + drop + flutter]);
      }
      const top: [number, number][] = [];
      const bot: [number, number][] = [];
      pts.forEach((p, i) => {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(N, i + 1)];
        const tx = b[0] - a[0];
        const ty = b[1] - a[1];
        const len = Math.hypot(tx, ty) || 1;
        const nx = -ty / len;
        const ny = tx / len;
        const h = bannerH / 2;
        top.push([p[0] + nx * h, p[1] + ny * h]);
        bot.push([p[0] - nx * h, p[1] - ny * h]);
      });

      const f = (p: [number, number]) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
      bannerRef.current?.setAttribute(
        "d",
        `M${top.map(f).join(" L")} L${[...bot].reverse().map(f).join(" L")} Z`,
      );
      centerRef.current?.setAttribute("d", `M${[...pts].reverse().map(f).join(" L")}`);
      ropeRef.current?.setAttribute("d", `M${hx} ${hy} L${f(top[0])} M${hx} ${hy} L${f(bot[0])}`);
      const pole = poleRef.current;
      if (pole) {
        pole.setAttribute("x1", String(top[0][0]));
        pole.setAttribute("y1", String(top[0][1]));
        pole.setAttribute("x2", String(bot[0][0]));
        pole.setAttribute("y2", String(bot[0][1]));
      }
      textRef.current?.setAttribute("font-size", String(bannerH * 0.5));

      if (!reduce) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="banner-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e4f2fb" />
        </linearGradient>
      </defs>

      {/* tow ropes + banner */}
      <path ref={ropeRef} stroke="#ffffff" strokeWidth="1.5" opacity="0.9" fill="none" />
      <path ref={bannerRef} fill="url(#banner-shade)" stroke="#338eda" strokeWidth="2" strokeLinejoin="round" />
      <line ref={poleRef} stroke="#8492a6" strokeWidth="3" strokeLinecap="round" />
      <path ref={centerRef} id="throttle-banner-path" fill="none" />
      <text
        ref={textRef}
        fill="#ec3750"
        dominantBaseline="central"
        fontWeight="bold"
        style={{ fontFamily: "'Phantom Sans', sans-serif" }}
      >
        <textPath href="#throttle-banner-path" startOffset="50%" textAnchor="middle">
          {BANNER_TEXT}
        </textPath>
      </text>

      {/* biplane art (public/art/biplane.png), facing right, centred on the origin */}
      <g ref={planeRef} transform="translate(-400 -400)">
        <image href="/art/biplane.png" x={-PLANE_W / 2} y={-PLANE_H / 2} width={PLANE_W} height={PLANE_H} />
      </g>
    </svg>
  );
}
