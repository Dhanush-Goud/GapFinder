// Consistent, safe JSON responses for route handlers.
import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { AuthError } from "@/lib/auth/session";
import { AIError } from "@/lib/ai/provider";
import { ExtractionError } from "@/lib/rag/extract";
import { PlanError } from "@/lib/revision/planner";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export async function parseJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON.");
  }
  return schema.parse(body);
}

/** Maps known errors to status codes; unknown errors are logged and returned without internals. */
export function handleError(err: unknown) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request.", details: err.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 }
    );
  }
  if (err instanceof ExtractionError) return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
  if (err instanceof PlanError) return NextResponse.json({ error: err.message }, { status: 422 });
  if (err instanceof AIError) {
    console.error("[gapfinder] AI error:", err.message);
    return NextResponse.json({ error: `The AI provider could not complete this request (${err.kind}). Please try again.` }, { status: 502 });
  }
  console.error("[gapfinder] unexpected error:", err);
  return NextResponse.json({ error: "Something went wrong on the server. Please try again." }, { status: 500 });
}

export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      return handleError(err);
    }
  };
}
