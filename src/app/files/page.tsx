import type { Metadata } from "next";
import { files } from "@/content/files";
import { FileCard } from "@/components/ui";
import { PageContainer } from "@/components/layout";

export const metadata: Metadata = {
  title: "Files",
  description: "Downloadable files and documents.",
};

export default function FilesPage() {
  return (
    <PageContainer title="Files" description="Documents and downloads.">
      <div className="grid gap-3 sm:grid-cols-2">
        {files.map((file) => (
          <FileCard key={file.slug} file={file} />
        ))}
      </div>

      {files.length === 0 && (
        <p className="text-center text-muted py-12">
          No files yet. Add some in{" "}
          <code className="text-accent">src/content/files.ts</code> and drop
          files into <code className="text-accent">public/files/</code>
        </p>
      )}
    </PageContainer>
  );
}
