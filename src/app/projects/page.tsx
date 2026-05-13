import type { Metadata } from "next";
import { projects } from "@/content/projects";
import { Card } from "@/components/ui";
import { PageContainer } from "@/components/layout";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Projects",
  description: "A collection of my projects and work.",
};

export default function ProjectsPage() {
  return (
    <PageContainer title="Projects" description="Things I've built and worked on.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card
            key={project.slug}
            href={`/projects/${project.slug}`}
            title={project.title}
            description={project.description}
            tags={project.tags}
          >
            {project.images[0] && (
              <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-md border border-border bg-background">
                <Image
                  src={project.images[0]}
                  alt={project.title}
                  fill
                  className="object-contain"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
            )}
          </Card>
        ))}
      </div>

      {projects.length === 0 && (
        <p className="text-center text-muted py-12">
          No projects yet. Add some in <code className="text-accent">src/content/projects.ts</code>
        </p>
      )}
    </PageContainer>
  );
}
