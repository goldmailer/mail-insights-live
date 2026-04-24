import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="container mx-auto px-4 py-6 border-b">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl prose prose-slate dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: Today</p>

        <p>
          Goldmailer accesses your Gmail using the <code>https://www.googleapis.com/auth/gmail.readonly</code> scope. We take your privacy seriously and have designed our system to collect the absolute minimum data required to provide our service.
        </p>

        <h2>What We Collect</h2>
        <p>
          We collect only the metadata necessary to compute aggregate statistics:
        </p>
        <ul>
          <li>Sender email addresses</li>
          <li>Dates and timestamps of messages</li>
          <li>Thread IDs</li>
        </ul>

        <h2>What We Don't Collect</h2>
        <p>
          <strong>Email subject lines, message bodies, and attachments are processed in transient memory and are not logged, cached, stored, or shared.</strong>
        </p>
        <p>
          All data processing occurs solely to generate your dashboard analytics.
        </p>

        <h2>Data Sharing & Advertising</h2>
        <ul>
          <li>We do not sell data.</li>
          <li>We do not use your email content for advertising.</li>
          <li>We do not share your information with third parties.</li>
        </ul>

        <h2>Revoking Access</h2>
        <p>
          You can revoke Goldmailer's access at any time from your Google Account Security settings. When you revoke access, we lose the ability to read your inbox metadata.
        </p>

        <h2>Contact</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us at: <a href="mailto:1xemailsupportbox@gmail.com">1xemailsupportbox@gmail.com</a>
        </p>
      </main>
    </div>
  );
}
