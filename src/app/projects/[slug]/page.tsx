import { notFound } from "next/navigation";
import { projects } from "@/content/projects";
import { PageContainer } from "@/components/layout";
import { ImageGallery } from "@/components/ui/ImageGallery";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

interface ProjectPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);
  if (!project) return { title: "Not Found" };
  return {
    title: project.title,
    description: project.description,
  };
}

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);

  if (!project) {
    notFound();
  }

  return (
    <PageContainer>
      <article className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {project.title}
          </h1>
          <p className="mt-2 text-muted">{project.description}</p>

          {/* Tags */}
          {project.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs text-accent"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Embed iframe (replaces image gallery when present) */}
        {project.embed ? (
          <div className="rounded-lg border border-border overflow-hidden">
            <iframe
              src={project.embed}
              title={`${project.title} - Live Preview`}
              className="w-full h-[500px] sm:h-[600px] lg:h-[700px] bg-background"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        ) : project.images.length > 0 ? (
          <ImageGallery images={project.images} alt={project.title} />
        ) : null}

        {/* Links */}
        <div className="flex flex-wrap gap-3">
          {project.playUrl && (
            <Link
              href={project.playUrl}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-accent-hover"
            >
              <span>&#9654;</span>
              Play Now
            </Link>
          )}
          {project.links.github && (
            <Button href={project.links.github} variant="secondary" external>
              GitHub
            </Button>
          )}
          {project.links.live && (
            <Button href={project.links.live} variant="primary" external>
              Live Site
            </Button>
          )}
          {Object.entries(project.links)
            .filter(([key]) => key !== "github" && key !== "live")
            .map(([key, url]) =>
              url ? (
                <Button key={key} href={url} variant="ghost" external>
                  {key}
                </Button>
              ) : null
            )}
        </div>
      </article>
    </PageContainer>
  );
}
