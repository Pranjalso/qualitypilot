import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { HttpError } from './auth';

type Ctx = { params: Record<string, string> };

export function api(fn: (req: Request, ctx: Ctx) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      const out = await fn(req, ctx);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e: any) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError)
        return NextResponse.json({ error: e.issues.map(i => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ') }, { status: 400 });
      if (e?.code === '23505') return NextResponse.json({ error: 'Already exists: ' + (e.detail ?? '') }, { status: 409 });
      if (e?.code === '23514') return NextResponse.json({ error: e.message }, { status: 422 });
      if (e?.code === '23503') return NextResponse.json({ error: 'Linked record missing or still in use' }, { status: 422 });
      console.error(e);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
export const num = (v: string | null) => (v ? Number(v) : undefined);
