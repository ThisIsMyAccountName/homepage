// === Project Types ===
export interface Project {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  images: string[];
  /** URL to embed as an iframe on the detail page (replaces image gallery) */
  embed?: string;
  /** URL linking to a playable version (shows a "Play Now" button) */
  playUrl?: string;
  links: {
    github?: string;
    live?: string;
    [key: string]: string | undefined;
  };
}

// === Game Types ===
export interface GameMeta {
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  controls: string;
}

export interface GameState {
  [key: string]: unknown;
}

export interface InputState {
  keys: Set<string>;
  justPressed: Set<string>;
  pointer: { x: number; y: number; down: boolean };
}

export interface GameDefinition<S extends GameState = GameState> {
  init: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => S;
  update: (state: S, input: InputState, dt: number) => S;
  render: (ctx: CanvasRenderingContext2D, state: S) => void;
  cleanup?: (state: S) => void;
}

// === File Types ===
export interface HostedFile {
  slug: string;
  title: string;
  description: string;
  filename: string;
  path: string;
  size: string;
  type: "pdf" | "image" | "document" | "archive" | "other";
}

// === Link Types ===
export interface ExternalLink {
  title: string;
  url: string;
  description: string;
  icon?: string;
}

// === Navigation ===
export interface NavItem {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
}
