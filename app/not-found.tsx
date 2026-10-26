import { LinkButton } from "@/components/ui";
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-brand-600">404</p>
      <h1 className="text-2xl font-semibold text-slate-900">Page not found</h1>
      <LinkButton href="/">Back to GapFinder AI</LinkButton>
    </div>
  );
}
