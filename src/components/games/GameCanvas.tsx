"use client";

import { useEffect, useRef, useCallback } from "react";
import type { GameDefinition, GameState, InputState } from "@/lib/types";

interface GameCanvasProps {
  game: GameDefinition;
}

export function GameCanvas({ game }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const inputRef = useRef<InputState>({
    keys: new Set(),
    justPressed: new Set(),
    pointer: { x: 0, y: 0, down: false },
  });
  const rafRef = useRef<number>(0);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.width = parent.clientWidth;
    canvas.height = Math.min(parent.clientWidth * 0.6, 500);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Size canvas to container
    handleResize();
    window.addEventListener("resize", handleResize);

    // Initialize game state
    stateRef.current = game.init(ctx, canvas);

    // Input handlers
    const keys = inputRef.current.keys;
    const justPressed = inputRef.current.justPressed;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!keys.has(e.key)) justPressed.add(e.key);
      keys.add(e.key);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key);
    };

    const getPointerPos = (e: MouseEvent | Touch) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const onMouseDown = (e: MouseEvent) => {
      const pos = getPointerPos(e);
      inputRef.current.pointer = { ...pos, down: true };
    };
    const onMouseUp = () => {
      inputRef.current.pointer.down = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      const pos = getPointerPos(e);
      inputRef.current.pointer.x = pos.x;
      inputRef.current.pointer.y = pos.y;
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const pos = getPointerPos(e.touches[0]);
      inputRef.current.pointer = { ...pos, down: true };
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      inputRef.current.pointer.down = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      const pos = getPointerPos(e.touches[0]);
      inputRef.current.pointer.x = pos.x;
      inputRef.current.pointer.y = pos.y;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });

    // Game loop
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1); // Cap delta at 100ms
      lastTime = time;

      if (stateRef.current) {
        stateRef.current = game.update(stateRef.current, inputRef.current, dt);
        game.render(ctx, stateRef.current);
      }

      // Clear justPressed after update
      justPressed.clear();

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchmove", onTouchMove);

      if (stateRef.current && game.cleanup) {
        game.cleanup(stateRef.current);
      }
    };
  }, [game, handleResize]);

  return (
    <canvas
      ref={canvasRef}
      className="block w-full"
      tabIndex={0}
      aria-label="Game canvas"
    />
  );
}
