import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="container mx-auto px-4 py-6 border-b">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl prose prose-slate dark:prose-invert">
        <h1>Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: Today</p>

        <ol className="space-y-6">
          <li>
            <strong>Service:</strong> Goldmailer provides analytics based on your Gmail data. The service is provided "as is" without warranties of any kind.
          </li>
          
          <li>
            <strong>User Responsibility:</strong> You are responsible for maintaining the security of your Google Account. You must not use Goldmailer for any unlawful purpose or in any way that violates Google's terms of service.
          </li>
          
          <li>
            <strong>Access:</strong> We reserve the right to suspend accounts that abuse the service. You may terminate your account at any time by revoking access via your Google Account Security settings.
          </li>
          
          <li>
            <strong>Limitation of Liability:</strong> Goldmailer is not liable for any indirect, incidental, special, consequential or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the service.
          </li>
          
          <li>
            <strong>Changes:</strong> We may update these terms from time to time. Continued use of the service after any changes means you accept the new terms.
          </li>
        </ol>

        <h2>Contact</h2>
        <p>
          If you have any questions about these Terms, please contact us at: <a href="mailto:1xemailsupportbox@gmail.com">1xemailsupportbox@gmail.com</a>
        </p>
      </main>
    </div>
  );
}
