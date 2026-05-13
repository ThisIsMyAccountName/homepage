interface PageContainerProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function PageContainer({
  children,
  title,
  description,
}: PageContainerProps) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      {title && (
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-muted text-sm sm:text-base">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </main>
  );
}
