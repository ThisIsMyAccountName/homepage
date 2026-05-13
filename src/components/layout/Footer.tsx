export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <p className="text-center text-sm text-muted">
          &copy; {new Date().getFullYear()} &middot; Built with Next.js
        </p>
      </div>
    </footer>
  );
}
