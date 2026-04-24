import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Check, Shield, Zap, Clock, BarChart3, ArrowRight } from "lucide-react";
import { useGetGoogleAuthUrl } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";

const features = [
  {
    icon: <BarChart3 className="h-6 w-6 text-primary" />,
    title: "Deep Analytics",
    description: "Understand your email volume, peak hours, and response times at a glance."
  },
  {
    icon: <Clock className="h-6 w-6 text-primary" />,
    title: "Win Back Time",
    description: "Identify time-wasting patterns and optimize your communication schedule."
  },
  {
    icon: <Zap className="h-6 w-6 text-primary" />,
    title: "Actionable Insights",
    description: "See your top senders and slowest clients to prioritize your attention."
  },
  {
    icon: <Shield className="h-6 w-6 text-primary" />,
    title: "Privacy First",
    description: "We only read metadata. Your email bodies and attachments remain completely private."
  }
];

export default function Landing() {
  const [agreed, setAgreed] = useState(false);
  const [, setLocation] = useLocation();
  const { data: authUrlData, isLoading: isLoadingUrl } = useGetGoogleAuthUrl();

  const handleContinue = () => {
    if (!agreed) return;
    if (authUrlData?.url) {
      window.location.href = authUrlData.url;
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <header className="container mx-auto px-4 py-6 flex items-center justify-between border-b border-border/40">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-lg shadow-sm">
            <Zap className="h-5 w-5" />
          </div>
          Goldmailer
        </div>
        <nav className="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
          <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-24 md:py-32">
          {/* Subtle noise texture */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.015] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
          
          {/* Abstract glows */}
          <div className="pointer-events-none absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]"></div>
          <div className="pointer-events-none absolute top-[40%] -left-[10%] w-[40%] h-[40%] rounded-full bg-chart-4/10 blur-[120px]"></div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-8 border shadow-sm"
              >
                <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                The cockpit for your email
              </motion.div>
              
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-5xl md:text-7xl font-bold tracking-tight text-balance leading-tight mb-6"
              >
                Know your inbox. <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-chart-4">
                  Win back your time.
                </span>
              </motion.h1>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed"
              >
                Professional Gmail analytics for freelancers, consultants, and small agencies. Stop guessing and start measuring your email workflow.
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="max-w-md mx-auto p-6 md:p-8 rounded-2xl bg-card border shadow-xl flex flex-col gap-6"
              >
                <div className="flex items-start gap-3 text-left bg-muted/50 p-4 rounded-xl border">
                  <Checkbox 
                    id="terms" 
                    checked={agreed} 
                    onCheckedChange={(c) => setAgreed(c as boolean)} 
                    className="mt-1"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="terms"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      I agree to the terms
                    </label>
                    <p className="text-xs text-muted-foreground">
                      By checking this, you agree to our <Link href="/terms" className="underline hover:text-primary transition-colors">Terms of Service</Link> and <Link href="/privacy" className="underline hover:text-primary transition-colors">Privacy Policy</Link>.
                    </p>
                  </div>
                </div>

                <Button 
                  size="lg" 
                  className="w-full text-base h-14 hover-elevate shadow-md"
                  disabled={!agreed || isLoadingUrl}
                  onClick={handleContinue}
                >
                  {isLoadingUrl ? "Loading..." : "Continue with Google"}
                  {!isLoadingUrl && <ArrowRight className="ml-2 h-5 w-5" />}
                </Button>
                
                <p className="text-xs text-muted-foreground text-center">
                  Secure, read-only metadata access. We never read your emails.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-muted/30 border-y">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold tracking-tight mb-4">Precision tools for inbox clarity</h2>
              <p className="text-muted-foreground">Goldmailer processes your email metadata to deliver actionable intelligence without compromising your privacy.</p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              {features.map((feature, i) => (
                <div key={i} className="bg-card p-6 rounded-2xl border shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
                  <div className="bg-primary/10 p-3 rounded-xl w-fit">
                    {feature.icon}
                  </div>
                  <h3 className="font-bold text-lg">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="container mx-auto px-4 py-12 text-center md:text-left md:flex md:items-center md:justify-between border-t border-border/40 mt-auto">
        <div className="flex items-center justify-center md:justify-start gap-2 font-semibold tracking-tight mb-4 md:mb-0">
          <Zap className="h-4 w-4 text-primary" /> Goldmailer
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-sm text-muted-foreground">
          <span>Contact: <a href="mailto:1xemailsupportbox@gmail.com" className="hover:text-primary transition-colors">1xemailsupportbox@gmail.com</a></span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
