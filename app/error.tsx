"use client";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#080908] px-4 text-center text-[#F4F5F0]">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#2A2D26] bg-[#171915] text-[#EF4444]">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-[#F4F5F0]">Telemetry Exception Occurred</h1>
      <p className="max-w-md text-xs leading-relaxed text-[#A0A39A]">
        {error.digest ? `Reference identifier: ${error.digest}` : error.message || "An unexpected subsystem error was encountered."}
      </p>
      <Button onClick={reset} icon={RotateCcw} className="mt-2 text-xs font-bold uppercase tracking-wider">
        Reinitialize View
      </Button>
    </div>
  );
}
