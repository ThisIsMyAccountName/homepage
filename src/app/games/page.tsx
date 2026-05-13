import type { Metadata } from "next";
import { games } from "@/content/games";
import { Card } from "@/components/ui";
import { PageContainer } from "@/components/layout";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Games",
  description: "Mini games and interactive experiments.",
};

export default function GamesPage() {
  return (
    <PageContainer title="Games" description="Mini games and interactive experiments.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => (
          <Card
            key={game.slug}
            href={`/games/${game.slug}`}
            title={game.title}
            description={game.description}
          >
            <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-md border border-border bg-background">
              <Image
                src={game.thumbnail}
                alt={game.title}
                fill
                className="object-contain"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            </div>
          </Card>
        ))}
      </div>

      {games.length === 0 && (
        <p className="text-center text-muted py-12">
          No games yet. Add some in{" "}
          <code className="text-accent">src/content/games.ts</code>
        </p>
      )}
    </PageContainer>
  );
}
