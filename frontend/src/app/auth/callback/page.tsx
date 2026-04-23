"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"verifying" | "error">("verifying");

  useEffect(() => {
    /* Supabase JS automatically exchanges the token in the URL hash/params.
       We just wait for the SIGNED_IN event, then route accordingly. */
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session) {
          const onboarded = session.user.user_metadata?.onboarding_complete === true;
          router.replace(onboarded ? "/dashboard" : "/get-started");
        }
      }
    );

    /* Also try immediately in case session is already established */
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const onboarded = session.user.user_metadata?.onboarding_complete === true;
        router.replace(onboarded ? "/dashboard" : "/get-started");
      }
    });

    /* If nothing happens after 8s, something went wrong */
    const timeout = setTimeout(() => setStatus("error"), 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #edfefe 0%, #c7f0f0 40%, #edfefe 100%)" }}>
      <div className="bg-white rounded-3xl shadow-xl border border-teal-100 p-10 max-w-sm w-full text-center">
        {status === "verifying" ? (
          <>
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-teal-100 flex items-center justify-center">
              <svg className="animate-spin h-7 w-7 text-teal-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
            <h2 className="text-lg font-black text-slate-900 mb-1">Verifying your email…</h2>
            <p className="text-slate-500 text-sm">Hang on, setting things up for you.</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-red-100 flex items-center justify-center text-2xl">⚠️</div>
            <h2 className="text-lg font-black text-slate-900 mb-1">Link expired or invalid</h2>
            <p className="text-slate-500 text-sm mb-5">Try signing up again or log in if you already have an account.</p>
            <a href="/signup" className="btn-primary inline-block px-6 py-2.5 text-sm font-bold">Back to Sign Up</a>
          </>
        )}
      </div>
    </div>
  );
}
