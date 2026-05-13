import type { GameDefinition, GameState, InputState } from "@/lib/types";

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface BouncingBallState extends GameState {
  balls: Ball[];
  width: number;
  height: number;
}

function randomColor(): string {
  const colors = ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#059669"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function createBall(x: number, y: number): Ball {
  return {
    x,
    y,
    vx: (Math.random() - 0.5) * 300,
    vy: (Math.random() - 0.5) * 300,
    radius: 8 + Math.random() * 16,
    color: randomColor(),
  };
}

const exampleGame: GameDefinition<BouncingBallState> = {
  init(_ctx, canvas) {
    const balls: Ball[] = [];
    // Start with 3 balls
    for (let i = 0; i < 3; i++) {
      balls.push(
        createBall(
          Math.random() * canvas.width,
          Math.random() * canvas.height
        )
      );
    }
    return {
      balls,
      width: canvas.width,
      height: canvas.height,
    };
  },

  update(state: BouncingBallState, input: InputState, dt: number) {
    // Update canvas size reference
    const canvas = document.querySelector("canvas");
    if (canvas) {
      state.width = canvas.width;
      state.height = canvas.height;
    }

    // Add ball on click/tap
    if (input.pointer.down && input.justPressed.size === 0) {
      // Only add on fresh pointer press (not held)
      // We detect fresh press by checking if pointer just became down
    }

    // Simple check: add ball if pointer is newly pressed
    if (input.pointer.down) {
      const lastBall = state.balls[state.balls.length - 1];
      const dist = lastBall
        ? Math.hypot(
            input.pointer.x - lastBall.x,
            input.pointer.y - lastBall.y
          )
        : Infinity;
      // Throttle: only add if far from last ball or first press
      if (dist > 30 || state.balls.length === 0) {
        // Limit total balls
        if (state.balls.length < 50) {
          state.balls.push(createBall(input.pointer.x, input.pointer.y));
        }
      }
    }

    // Physics
    for (const ball of state.balls) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Bounce off walls
      if (ball.x - ball.radius < 0) {
        ball.x = ball.radius;
        ball.vx = Math.abs(ball.vx);
      }
      if (ball.x + ball.radius > state.width) {
        ball.x = state.width - ball.radius;
        ball.vx = -Math.abs(ball.vx);
      }
      if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
        ball.vy = Math.abs(ball.vy);
      }
      if (ball.y + ball.radius > state.height) {
        ball.y = state.height - ball.radius;
        ball.vy = -Math.abs(ball.vy);
      }
    }

    return state;
  },

  render(ctx: CanvasRenderingContext2D, state: BouncingBallState) {
    // Clear
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, state.width, state.height);

    // Draw balls
    for (const ball of state.balls) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = ball.color;
      ctx.fill();

      // Subtle glow
      ctx.shadowColor = ball.color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Ball count
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "12px monospace";
    ctx.fillText(`Balls: ${state.balls.length}`, 8, 16);
  },
};

export default exampleGame;
