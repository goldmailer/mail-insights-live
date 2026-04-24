import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("success");
    const error = urlParams.get("error");

    if (success === "true") {
      setLocation("/dashboard");
    } else {
      toast({
        title: "Authentication Failed",
        description: error === "auth_failed"
          ? "Google sign-in failed. Please try again."
          : "An unexpected error occurred during sign-in.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [setLocation, toast]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 bg-card rounded-2xl border shadow-sm">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Authenticating...</h2>
        <p className="text-sm text-muted-foreground">Securing your connection to Goldmailer.</p>
      </div>
    </div>
  );
}
