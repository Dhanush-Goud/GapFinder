import { Compass } from "lucide-react";
import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#080908] px-4 text-center text-[#F4F5F0]">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#2A2D26] bg-[#171915] text-[#D5FF32]">
        <Compass className="h-6 w-6" aria-hidden />
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-[#D5FF32]">Error 404</p>
      <h1 className="text-2xl font-bold tracking-tight text-[#F4F5F0]">Telemetry Route Not Found</h1>
      <p className="max-w-md text-xs text-[#A0A39A]">
        The requested endpoint or resource does not exist in the knowledge workspace.
      </p>
      <LinkButton href="/dashboard" className="mt-2 text-xs font-bold uppercase tracking-wider">
        Return to Intelligence Dashboard
      </LinkButton>
    </div>
  );
}
