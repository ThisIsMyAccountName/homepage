import { Suspense } from "react";
import { notFound } from "next/navigation";
import { games } from "@/content/games";
import { PageContainer } from "@/components/layout";
import { GameLoader } from "@/components/games/GameLoader";

interface GamePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return games.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: GamePageProps) {
  const { slug } = await params;
  const game = games.find((g) => g.slug === slug);
  if (!game) return { title: "Not Found" };
  return {
    title: game.title,
    description: game.description,
  };
}

export default async function GameDetailPage({ params }: GamePageProps) {
  const { slug } = await params;
  const game = games.find((g) => g.slug === slug);

  if (!game) {
    notFound();
  }

  return (
    <PageContainer>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {game.title}
          </h1>
          <p className="mt-1 text-muted">{game.description}</p>
          <p className="mt-2 text-xs text-muted font-mono">
            Controls: {game.controls}
          </p>
        </div>

        {/* Game container */}
        <div className="rounded-lg border border-border overflow-hidden bg-black">
          <Suspense
            fallback={
              <div className="flex items-center justify-center p-12 text-sm text-muted">
                Loading game...
              </div>
            }
          >
            <GameLoader slug={slug} />
          </Suspense>
        </div>
      </div>
    </PageContainer>
  );
}
