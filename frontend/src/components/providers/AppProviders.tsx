"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { useAppStore } from "@/store/useAppStore";

function BootstrapGate({ children }: { children: React.ReactNode }) {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    void bootstrap(user?.id ?? null);
  }, [bootstrap, user?.id, loading]);

  return <>{children}</>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <BootstrapGate>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#fffdf9",
              color: "#1B4D3E",
              border: "1px solid rgba(27,77,62,0.1)",
              borderRadius: 16,
            },
          }}
        />
      </BootstrapGate>
    </AuthProvider>
  );
}
