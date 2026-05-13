import { HostedFile } from "@/lib/types";

const typeIcons: Record<HostedFile["type"], string> = {
  pdf: "PDF",
  image: "IMG",
  document: "DOC",
  archive: "ZIP",
  other: "FILE",
};

interface FileCardProps {
  file: HostedFile;
}

export function FileCard({ file }: FileCardProps) {
  return (
    <a
      href={file.path}
      download={file.filename}
      className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-card-hover hover:border-accent/40"
    >
      {/* File type badge */}
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-accent/10 font-mono text-xs font-bold text-accent">
        {typeIcons[file.type]}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors truncate">
          {file.title}
        </h3>
        <p className="mt-0.5 text-sm text-muted truncate">{file.description}</p>
        <p className="mt-1 text-xs text-muted">
          {file.filename} &middot; {file.size}
        </p>
      </div>

      {/* Download arrow */}
      <div className="flex-shrink-0 text-muted group-hover:text-accent transition-colors">
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
      </div>
    </a>
  );
}
