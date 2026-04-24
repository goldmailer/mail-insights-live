import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";
import { format, parseISO } from "date-fns";
import { 
  Mail, 
  Inbox, 
  Clock, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  LogOut,
  Trash2,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { 
  useGetMe, 
  useLogout, 
  useGetDashboardSummary, 
  useGetResponseTimes, 
  useGetTopSenders, 
  useGetInboxHealth, 
  useGetWeeklyReport,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type EmailRow = {
  id: string;
  from: string;
  to?: string;
  subject: string;
  date: string;
  snippet: string;
  isUnread?: boolean;
};

type EmailDetail = {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  html: string | null;
  text: string | null;
};

function safeFormatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return format(d, 'MMM d, yyyy h:mm a');
  } catch {
    return dateStr;
  }
}

function EmailViewer({
  emailDetail,
  isLoading,
  onClose,
  onTrash,
  onDelete,
}: {
  emailDetail: EmailDetail | null;
  isLoading: boolean;
  onClose: () => void;
  onTrash?: () => void;
  onDelete?: () => void;
}) {
  const isOpen = isLoading || !!emailDetail;

  const htmlWithBase = emailDetail?.html
    ? `<base target="_blank"><style>body{font-family:sans-serif;font-size:14px;line-height:1.6;color:#111;padding:12px;margin:0;word-break:break-word;}a{color:#0ea5e9;}img{max-width:100%;}</style>${emailDetail.html}`
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ) : (
            <div className="space-y-1 pr-8">
              <DialogTitle className="text-base font-semibold leading-tight">{emailDetail?.subject}</DialogTitle>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div><span className="font-medium text-foreground">From:</span> {emailDetail?.from}</div>
                <div><span className="font-medium text-foreground">To:</span> {emailDetail?.to}</div>
                <div><span className="font-medium text-foreground">Date:</span> {safeFormatDate(emailDetail?.date ?? '')}</div>
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/6" />
            </div>
          ) : htmlWithBase ? (
            <iframe
              srcDoc={htmlWithBase}
              className="w-full h-full border-0"
              sandbox="allow-same-origin allow-popups"
              title="Email content"
            />
          ) : (
            <ScrollArea className="h-full">
              <div className="p-6 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {emailDetail?.text || emailDetail?.snippet || '(No content)'}
              </div>
            </ScrollArea>
          )}
        </div>

        {!isLoading && (onTrash || onDelete) && (
          <div className="px-6 py-3 border-t flex justify-end gap-2 shrink-0">
            {onTrash && (
              <Button variant="outline" size="sm" onClick={() => { onTrash(); onClose(); }}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Move to Trash
              </Button>
            )}
            {onDelete && (
              <Button variant="destructive" size="sm" onClick={() => { onDelete(); onClose(); }}>
                <AlertCircle className="h-3.5 w-3.5 mr-1.5" /> Permanently Delete
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EmailTable({
  emails,
  isLoading,
  onOpen,
  onTrash,
  onDelete,
  trashingId,
  deletingId,
  emptyLabel,
  showActions,
}: {
  emails: EmailRow[];
  isLoading: boolean;
  onOpen: (id: string) => void;
  onTrash?: (id: string) => void;
  onDelete?: (id: string) => void;
  trashingId?: string | null;
  deletingId?: string | null;
  emptyLabel: string;
  showActions: boolean;
}) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[180px]">From</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead className="w-[120px]">Date</TableHead>
          {showActions && <TableHead className="w-[90px] text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {emails.length === 0 && (
          <TableRow>
            <TableCell colSpan={showActions ? 4 : 3} className="text-center h-24 text-muted-foreground">
              {emptyLabel}
            </TableCell>
          </TableRow>
        )}
        {emails.map(email => (
          <TableRow
            key={email.id}
            className={`cursor-pointer hover:bg-muted/50 ${email.isUnread ? 'font-semibold' : ''}`}
            onClick={() => onOpen(email.id)}
          >
            <TableCell className="truncate max-w-[180px] text-sm" title={email.from}>
              {email.from.replace(/<.*?>/, '').trim() || email.from}
            </TableCell>
            <TableCell className="text-sm">
              <div className="truncate max-w-[280px]" title={email.subject}>{email.subject}</div>
              {email.snippet && (
                <div className="text-xs text-muted-foreground truncate max-w-[280px] font-normal">{email.snippet}</div>
              )}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
              {safeFormatDate(email.date)}
            </TableCell>
            {showActions && (
              <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                <div className="flex justify-end gap-1">
                  {onTrash && (
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 px-2 text-muted-foreground hover:text-yellow-600"
                      onClick={() => onTrash(email.id)}
                      disabled={trashingId === email.id || deletingId === email.id}
                      title="Move to trash"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 px-2 text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(email.id)}
                      disabled={trashingId === email.id || deletingId === email.id}
                      title="Permanently delete"
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AdminPanel({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inbox' | 'trash'>('inbox');
  const [inboxEmails, setInboxEmails] = useState<EmailRow[]>([]);
  const [isLoadingInbox, setIsLoadingInbox] = useState(false);
  const [trashingId, setTrashingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingEmail, setViewingEmail] = useState<EmailDetail | null>(null);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [accounts, setAccounts] = useState<Array<{ id: string; email: string; name: string; picture?: string }>>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [trashEmails, setTrashEmails] = useState<EmailRow[]>([]);
  const [isLoadingTrash, setIsLoadingTrash] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const { toast } = useToast();

  const adminFetch = (path: string, opts?: RequestInit) =>
    fetch(`/api/admin${path}`, { credentials: 'include', ...opts });

  const loadAccounts = async () => {
    setIsLoadingAccounts(true);
    try {
      const res = await adminFetch('/accounts');
      if (res.ok) { const d = await res.json(); setAccounts(d.accounts ?? []); }
    } catch { /* ignore */ }
    setIsLoadingAccounts(false);
  };

  const fetchInbox = async (accountId: string) => {
    setIsLoadingInbox(true);
    try {
      const res = await adminFetch(`/accounts/${accountId}/inbox?maxResults=50`);
      if (res.ok) { const d = await res.json(); setInboxEmails(d.emails ?? []); }
    } catch { /* ignore */ }
    setIsLoadingInbox(false);
  };

  const fetchTrash = async (accountId: string) => {
    setIsLoadingTrash(true);
    try {
      const res = await adminFetch(`/accounts/${accountId}/trash`);
      if (res.ok) { const d = await res.json(); setTrashEmails(d.emails ?? []); }
    } catch { /* ignore */ }
    setIsLoadingTrash(false);
  };

  const openEmail = async (emailId: string) => {
    if (!selectedAccountId) return;
    setViewingEmail(null);
    setIsLoadingEmail(true);
    try {
      const res = await adminFetch(`/accounts/${selectedAccountId}/emails/${emailId}`);
      if (res.ok) { setViewingEmail(await res.json()); }
      else { toast({ title: "Could not load email", variant: "destructive" }); }
    } catch { toast({ title: "Could not load email", variant: "destructive" }); }
    setIsLoadingEmail(false);
  };

  const handleSelectAccount = (id: string) => {
    setSelectedAccountId(id);
    setActiveTab('inbox');
    setInboxEmails([]);
    setTrashEmails([]);
    fetchInbox(id);
  };

  const handleTrash = async (emailId: string) => {
    if (!selectedAccountId) return;
    setTrashingId(emailId);
    try {
      const res = await adminFetch(`/accounts/${selectedAccountId}/emails/${emailId}/trash`, { method: 'POST' });
      if (res.ok) { setInboxEmails(prev => prev.filter(e => e.id !== emailId)); toast({ title: "Moved to trash" }); }
      else { toast({ title: "Failed to move to trash", variant: "destructive" }); }
    } catch { toast({ title: "Failed to move to trash", variant: "destructive" }); }
    setTrashingId(null);
  };

  const handleDelete = async (emailId: string) => {
    if (!selectedAccountId) return;
    setDeletingId(emailId);
    try {
      const res = await adminFetch(`/accounts/${selectedAccountId}/emails/${emailId}`, { method: 'DELETE' });
      if (res.ok) { setInboxEmails(prev => prev.filter(e => e.id !== emailId)); toast({ title: "Email permanently deleted" }); }
      else { toast({ title: "Failed to delete email", variant: "destructive" }); }
    } catch { toast({ title: "Failed to delete email", variant: "destructive" }); }
    setDeletingId(null);
  };

  const handleDeleteFromTrash = async (emailId: string) => {
    if (!selectedAccountId) return;
    setDeletingId(emailId);
    try {
      const res = await adminFetch(`/accounts/${selectedAccountId}/emails/${emailId}`, { method: 'DELETE' });
      if (res.ok) { setTrashEmails(prev => prev.filter(e => e.id !== emailId)); toast({ title: "Email permanently deleted" }); }
      else { toast({ title: "Failed to delete email", variant: "destructive" }); }
    } catch { toast({ title: "Failed to delete email", variant: "destructive" }); }
    setDeletingId(null);
  };

  const handleSync = async () => {
    if (!selectedAccountId) return;
    setIsSyncing(true);
    await adminFetch(`/accounts/${selectedAccountId}/sync`, { method: 'POST' });
    setIsSyncing(false);
    toast({ title: "Synced" });
  };

  const handleRemoveAccount = async () => {
    if (!selectedAccountId) return;
    setIsRemoving(true);
    const res = await adminFetch(`/accounts/${selectedAccountId}`, { method: 'DELETE' });
    setIsRemoving(false);
    if (res.ok) {
      setAccounts(prev => prev.filter(a => a.id !== selectedAccountId));
      setSelectedAccountId(null);
      setInboxEmails([]);
      setTrashEmails([]);
      toast({ title: "Account removed" });
    }
  };

  useEffect(() => {
    if (isOpen) loadAccounts();
  }, [isOpen]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <div className="bg-primary/10 p-1.5 rounded-md">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            Admin Panel
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-56 border-r flex flex-col p-4 gap-3 overflow-y-auto shrink-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Accounts</p>
            {isLoadingAccounts ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : (
              <>
                {accounts.map(acc => (
                  <button
                    key={acc.id}
                    onClick={() => handleSelectAccount(acc.id)}
                    className={`w-full text-left rounded-lg p-3 border transition-colors ${
                      selectedAccountId === acc.id
                        ? 'bg-primary/5 border-primary ring-1 ring-primary'
                        : 'hover:bg-muted/50 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="overflow-hidden">
                        <div className="text-sm font-medium truncate">{acc.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{acc.email}</div>
                      </div>
                    </div>
                  </button>
                ))}
                {accounts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No accounts connected</p>
                )}
              </>
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedAccountId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Select an account to manage emails
              </div>
            ) : (
              <>
                {/* Account header */}
                <div className="px-5 py-3 border-b flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{selectedAccount?.name}</div>
                    <div className="text-xs text-muted-foreground">{selectedAccount?.email}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline" size="sm"
                      onClick={handleSync}
                      disabled={isSyncing}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      Sync
                    </Button>
                    <Button
                      variant="destructive" size="sm"
                      onClick={handleRemoveAccount}
                      disabled={isRemoving}
                    >
                      Remove Account
                    </Button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b px-5">
                  {(['inbox', 'trash'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab);
                        if (tab === 'inbox') fetchInbox(selectedAccountId);
                        if (tab === 'trash') fetchTrash(selectedAccountId);
                      }}
                      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                        activeTab === tab
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab === 'inbox' ? <><Inbox className="inline h-3.5 w-3.5 mr-1.5" />Inbox</> : <><Trash2 className="inline h-3.5 w-3.5 mr-1.5" />Trash</>}
                    </button>
                  ))}
                  {activeTab === 'inbox' && (
                    <button
                      className="ml-auto py-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      onClick={() => fetchInbox(selectedAccountId)}
                    >
                      <RefreshCw className="h-3 w-3" /> Refresh
                    </button>
                  )}
                </div>

                {/* Email table */}
                <ScrollArea className="flex-1">
                  {activeTab === 'inbox' ? (
                    <EmailTable
                      emails={inboxEmails}
                      isLoading={isLoadingInbox}
                      onOpen={openEmail}
                      onTrash={handleTrash}
                      onDelete={handleDelete}
                      trashingId={trashingId}
                      deletingId={deletingId}
                      emptyLabel="No inbox emails found"
                      showActions={true}
                    />
                  ) : (
                    <EmailTable
                      emails={trashEmails}
                      isLoading={isLoadingTrash}
                      onOpen={openEmail}
                      onDelete={handleDeleteFromTrash}
                      deletingId={deletingId}
                      emptyLabel="Trash is empty"
                      showActions={true}
                    />
                  )}
                </ScrollArea>
              </>
            )}
          </div>
        </div>
      </DialogContent>

      <EmailViewer
        emailDetail={viewingEmail}
        isLoading={isLoadingEmail}
        onClose={() => { setViewingEmail(null); setIsLoadingEmail(false); }}
        onTrash={viewingEmail ? () => handleTrash(viewingEmail.id) : undefined}
        onDelete={viewingEmail ? () => handleDelete(viewingEmail.id) : undefined}
      />
    </Dialog>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [responseDays, setResponseDays] = useState<7 | 14 | 30>(7);
  const [adminClicks, setAdminClicks] = useState(0);
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const { data: user, isLoading: isLoadingUser } = useGetMe();
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: responseTimes, isLoading: isLoadingResponse } = useGetResponseTimes({ days: responseDays });
  const { data: topSenders, isLoading: isLoadingTop } = useGetTopSenders({ limit: 5 });
  const { data: health, isLoading: isLoadingHealth } = useGetInboxHealth();
  const { data: weekly, isLoading: isLoadingWeekly } = useGetWeeklyReport();

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/");
      }
    }
  });

  const handleAdminClick = () => {
    const newCount = adminClicks + 1;
    setAdminClicks(newCount);
    if (newCount === 10) {
      setShowAdminPin(true);
      setAdminClicks(0);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin === "2006") {
      setIsAdminOpen(true);
      setShowAdminPin(false);
      setAdminPin("");
    } else {
      setShowAdminPin(false);
      setAdminPin("");
    }
  };

  if (isLoadingUser) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Activity className="h-8 w-8 text-primary animate-pulse" />
      </div>
    );
  }

  if (!user?.isAuthenticated) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-[100dvh] bg-muted/20 flex flex-col">
      {/* Top Nav */}
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold tracking-tight">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
              <Activity className="h-4 w-4" />
            </div>
            Goldmailer
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium hidden sm:block">{user.email}</div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-muted-foreground hover:text-foreground"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Total Processed</p>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-baseline gap-2">
                {isLoadingSummary ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{summary?.totalEmails.toLocaleString()}</div>
                    <div className={`text-xs flex items-center ${(summary?.weeklyChange || 0) > 0 ? 'text-chart-2' : 'text-primary'}`}>
                      {(summary?.weeklyChange || 0) > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                      {Math.abs(summary?.weeklyChange || 0)}% vs last week
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-baseline gap-2">
                {isLoadingSummary ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{Math.round((summary?.avgResponseMinutes || 0) / 60)}h</div>
                    <div className="text-xs text-muted-foreground">{(summary?.avgResponseMinutes || 0) % 60}m</div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Inbox Health Score</p>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-baseline gap-2">
                {isLoadingSummary ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <>
                    <div className="text-2xl font-bold text-primary">{summary?.inboxScore}/100</div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <p className="text-sm font-medium text-muted-foreground">Unread Items</p>
                <Inbox className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-baseline gap-2">
                {isLoadingSummary ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">{summary?.unreadCount.toLocaleString()}</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Chart Area */}
          <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">Response Time Trend</CardTitle>
                  <CardDescription>Average minutes to reply over time</CardDescription>
                </div>
                <ToggleGroup 
                  type="single" 
                  value={responseDays.toString()} 
                  onValueChange={(v) => v && setResponseDays(Number(v) as 7|14|30)}
                  size="sm"
                >
                  <ToggleGroupItem value="7">7D</ToggleGroupItem>
                  <ToggleGroupItem value="14">14D</ToggleGroupItem>
                  <ToggleGroupItem value="30">30D</ToggleGroupItem>
                </ToggleGroup>
              </CardHeader>
              <CardContent>
                {isLoadingResponse ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <div className="h-[300px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={responseTimes?.trend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(v) => format(parseISO(v), 'MMM d')} 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          dx={-10}
                        />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))' }}
                          labelFormatter={(v) => format(parseISO(v as string), 'MMM d, yyyy')}
                          formatter={(val: number) => [`${Math.round(val/60)}h ${val%60}m`, 'Avg Response']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="avgResponseMinutes" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={3}
                          dot={false}
                          activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Weekly Volume</CardTitle>
                <CardDescription>Emails sent vs received</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingWeekly ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <div className="h-[300px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weekly?.dailyVolume}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="day" 
                          tickFormatter={(v) => String(v).slice(0, 3)}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          dx={-10}
                        />
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))' }}
                          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                        />
                        <Bar dataKey="received" name="Received" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="sent" name="Sent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  Top Senders
                </CardTitle>
                <CardDescription>Who you interact with most</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTop ? (
                  <div className="space-y-4">
                    {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topSenders?.senders.map((sender, i) => (
                      <div key={i} className="flex items-center justify-between border-b last:border-0 pb-3 last:pb-0">
                        <div className="overflow-hidden mr-4">
                          <div className="font-medium truncate text-sm">{sender.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{sender.email}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{sender.count}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-chart-4" />
                  Slowest Clients
                </CardTitle>
                <CardDescription>Longest average response times</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingResponse ? (
                  <div className="space-y-4">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {responseTimes?.slowestClients.slice(0, 5).map((client, i) => (
                      <div key={i} className="flex flex-col gap-1 border-b last:border-0 pb-3 last:pb-0">
                        <div className="flex items-center justify-between">
                          <div className="font-medium truncate text-sm flex-1 mr-2">{client.name}</div>
                          <div className="text-sm font-semibold whitespace-nowrap text-chart-4">
                            {Math.round(client.avgResponseMinutes/60)}h {client.avgResponseMinutes%60}m
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">{client.emailCount} emails</div>
                      </div>
                    ))}
                    {responseTimes?.slowestClients.length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-4">No data available yet.</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center mt-auto">
        <div 
          className="inline-block text-[10px] text-muted-foreground/30 font-mono cursor-default select-none uppercase tracking-[0.2em]"
          onClick={handleAdminClick}
        >
          GOLDMAILER
        </div>
      </footer>

      <Dialog open={showAdminPin} onOpenChange={setShowAdminPin}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Admin Access</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <Input 
              type="password" 
              placeholder="Enter PIN" 
              value={adminPin} 
              onChange={e => setAdminPin(e.target.value)}
              autoFocus
              className="text-center tracking-widest text-lg font-mono"
            />
            <Button type="submit" className="w-full">Unlock</Button>
          </form>
        </DialogContent>
      </Dialog>

      <AdminPanel isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />
    </div>
  );
}
