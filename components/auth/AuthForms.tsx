"use client";
import { KeyRound, LogIn, UserPlus } from "lucide-react";
import { useActionState } from "react";
import { judgeLoginAction, loginAction, registerAction, type AuthFormState } from "@/app/auth-actions";
import { Alert, Button, Field, inputClass } from "@/components/ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="next" value={next ?? "/dashboard"} />
      <Field label="Email Address" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="Password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} className={inputClass} />
      </Field>
      <Button type="submit" loading={pending} icon={LogIn} className="w-full text-xs font-bold uppercase tracking-wider py-2.5">
        Sign In
      </Button>
    </form>
  );
}

export function JudgeLoginButton() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(async () => judgeLoginAction(), {});
  return (
    <form action={action} className="space-y-2">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" variant="secondary" loading={pending} icon={KeyRound} className="w-full text-xs font-semibold py-2">
        Access with Judge Demo Credentials
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(registerAction, {});
  if (state.message) return <Alert tone="success" title="Verification Pending">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Full Name" htmlFor="name">
        <input id="name" name="name" autoComplete="name" required maxLength={80} className={inputClass} />
      </Field>
      <Field label="Email Address" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="Password" htmlFor="password" hint="Minimum 8 characters.">
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
      </Field>
      <Button type="submit" loading={pending} icon={UserPlus} className="w-full text-xs font-bold uppercase tracking-wider py-2.5">
        Create Account
      </Button>
    </form>
  );
}
