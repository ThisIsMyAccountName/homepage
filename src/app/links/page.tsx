import type { Metadata } from "next";
import { links } from "@/content/links";
import { PageContainer } from "@/components/layout";

export const metadata: Metadata = {
  title: "Links",
  description: "External links and profiles.",
};

export default function LinksPage() {
  return (
    <PageContainer title="Links" description="Find me elsewhere on the web.">
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-card-hover hover:border-accent/40"
          >
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">
                {link.title}
              </h3>
              <p className="mt-0.5 text-sm text-muted truncate">
                {link.description}
              </p>
            </div>

            {/* External link icon */}
            <div className="flex-shrink-0 text-muted group-hover:text-accent transition-colors">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </div>
          </a>
        ))}
      </div>

      {links.length === 0 && (
        <p className="text-center text-muted py-12">
          No links yet. Add some in{" "}
          <code className="text-accent">src/content/links.ts</code>
        </p>
      )}
    </PageContainer>
  );
}
