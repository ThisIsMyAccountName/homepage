import Link from "next/link";

interface CardProps {
  href: string;
  title: string;
  description: string;
  tags?: string[];
  children?: React.ReactNode;
}

export function Card({ href, title, description, tags, children }: CardProps) {
  return (
    <Link
      href={href}
      className="group block rounded-lg border border-border bg-card p-5 transition-colors hover:bg-card-hover hover:border-accent/40"
    >
      {children}
      <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">
        {title}
      </h3>
      <p className="mt-1.5 text-sm text-muted line-clamp-2">{description}</p>
      {tags && tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs text-accent"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
