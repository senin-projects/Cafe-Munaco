import { type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  Activity, AlertTriangle, Archive, ArrowDown, ArrowUp, CalendarDays, ChefHat, CircleDollarSign,
  Coffee, ClipboardList, CreditCard, Fish, House, LayoutDashboard, LogOut, Menu,
  Package, Plus, Search, Settings2, ShoppingBag, Users, X, Utensils, Boxes,
  RefreshCw, ChevronRight
} from 'lucide-react';
import {
  getGetDashboardQueryKey, getListInventoryQueryKey,
  getListMenuItemsQueryKey, getListOrdersQueryKey, getListReservationsQueryKey,
  getListStaffQueryKey, useAdjustInventory, useCreateInventoryItem, useCreateMenuItem,
  useCreateOrder, useCreateReservation, useCreateStaff, useGetDashboard, useGetMyStaffProfile,
  useListInventory, useListMenuItems, useListOrders, useListReservations, useListStaff,
  useUpdateInventoryItem, useUpdateMenuItem, useUpdateOrder, useUpdateReservation, useUpdateStaff
} from '@workspace/api-client-react';
import type {
  InventoryItem, MenuItem, Order, Reservation, StaffMember,
  StaffMemberRole, OrderStatus, ReservationStatus
} from '@workspace/api-client-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import NotFound from '@/pages/not-found';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import './index.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000 } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#245447', colorForeground: '#283d34', colorMutedForeground: '#718075',
    colorDanger: '#b94c3d', colorBackground: '#fbf8ef', colorInput: '#fffdf7',
    colorInputForeground: '#283d34', colorNeutral: '#d8d0bf', fontFamily: "'DM Sans', sans-serif", borderRadius: '0.7rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-[#fbf8ef] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#234f42] font-semibold', headerSubtitle: 'text-[#718075]',
    socialButtonsBlockButtonText: 'text-[#283d34]', formFieldLabel: 'text-[#52665a]',
    footerActionLink: 'text-[#245447] font-semibold', footerActionText: 'text-[#718075]',
    dividerText: 'text-[#718075]', identityPreviewEditButton: 'text-[#245447]',
    formFieldSuccessText: 'text-[#386d4d]', alertText: 'text-[#7b4138]',
    logoBox: 'mb-3', logoImage: 'max-h-10', socialButtonsBlockButton: 'border-[#d8d0bf] bg-[#fffdf7]',
    formButtonPrimary: 'bg-[#245447] hover:bg-[#1b4338] text-[#fff8ea]',
    formFieldInput: 'border-[#d8d0bf] bg-[#fffdf7] text-[#283d34]',
    footerAction: 'text-[#718075]', dividerLine: 'bg-[#e0d9cb]', alert: 'bg-[#f8e8e1]',
    otpCodeFieldInput: 'border-[#d8d0bf]', formFieldRow: 'mb-4', main: 'text-[#283d34]',
  },
};

function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) qc.clear();
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);
  return null;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Your shift starts here.' } },
      signUp: { start: { title: 'Join the Munaco crew', subtitle: 'Create your employee account.' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}>
      <ClerkCacheInvalidator />
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/operations" component={() => <Protected><AppPage /></Protected>} />
        <Route path="/orders" component={() => <Protected><AppPage /></Protected>} />
        <Route path="/kitchen" component={() => <Protected><AppPage /></Protected>} />
        <Route path="/reservations" component={() => <Protected><AppPage /></Protected>} />
        <Route path="/inventory" component={() => <Protected><AppPage /></Protected>} />
        <Route path="/menu" component={() => <Protected><AppPage /></Protected>} />
        <Route path="/staff" component={() => <Protected><AppPage /></Protected>} />
        <Route path="/account" component={() => <Protected><AppPage /></Protected>} />
        <Route component={NotFound} />
      </Switch>
    </QueryClientProvider>
  </ClerkProvider>;
}

function SignInPage() { return <AuthFrame><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></AuthFrame>; }
function SignUpPage() { return <AuthFrame><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></AuthFrame>; }
function AuthFrame({ children }: { children: ReactNode }) {
  return <main className="landing" style={{ display: 'grid', placeItems: 'center', padding: 20, background: 'radial-gradient(ellipse at 8% 8%, #e6eadc 0, transparent 36%), #f6f1e4' }}>
    <Link href="/" className="brand-mark landing-logo" style={{ position: 'absolute', top: 24, left: 24, padding: 0 }}>
      <span className="brand-symbol">M</span><span><span className="brand-name">Cafe Munaco</span><span className="brand-caption">Staff operations</span></span>
    </Link>
    {children}
  </main>;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && isSignedIn) return <Redirect to="/operations" />;
  return <Landing />;
}

function Landing() {
  return <div className="landing">
    <nav className="landing-nav">
      <Link href="/" className="landing-logo"><span className="brand-symbol">M</span><span><span className="brand-name">Cafe Munaco</span><span className="brand-caption">Since the first cup</span></span></Link>
      <div className="landing-nav-actions"><Link href="/sign-in" className="button ghost">Employee sign in</Link><Link href="/sign-up" className="button primary">Join the team <ChevronRight size={14}/></Link></div>
    </nav>
    <section className="hero">
      <div className="hero-copy">
        <span className="hero-kicker"><span className="shift-dot"/><span>One team, every station</span></span>
        <h1>Good service<br/>starts <em>behind</em><br/>the scenes.</h1>
        <p>Munaco Operations keeps the dining room, kitchen, bookings and fresh stock moving together. One clear view for the people who make every visit count.</p>
        <div className="hero-cta"><Link href="/sign-in" className="button primary">Open your shift <ChevronRight size={15}/></Link><a href="#how-it-works" className="button ghost">See how it works</a></div>
      </div>
      <div className="hero-visual">
        <div className="hero-card"><div className="visual-orbit"/><div className="hero-card-label">Munaco · service dashboard</div>
          <div className="hero-card-heading">A steady hand<br/>through the rush.</div>
          <div className="hero-service">
            <div className="service-row"><span className="service-icon"><Utensils size={15}/></span><span><strong>Front of house</strong><small>Orders, tables & guest moments</small></span></div>
            <div className="service-row"><span className="service-icon"><ChefHat size={15}/></span><span><strong>Kitchen line</strong><small>Every ticket, in the right order</small></span></div>
            <div className="service-row"><span className="service-icon"><Fish size={15}/></span><span><strong>Fresh stock</strong><small>Know what came in, and when</small></span></div>
          </div>
        </div>
        <div className="floating-note"><small>Today at Munaco</small><strong>Ready for service</strong></div>
      </div>
    </section>
    <section className="landing-section" id="how-it-works">
      <div className="section-top"><div><div className="eyebrow">Made for the floor</div><h2>Less chasing.<br/>More looking after people.</h2></div><p>Built around the real rhythm of a Filipino cafe: a welcoming front, a focused kitchen and ingredients worth keeping fresh.</p></div>
      <div className="feature-strip">
        <article className="feature-block dark"><span className="feature-n">01 / SERVICE</span><h3>See the shift at a glance.</h3><p>Live order flow, today's bookings and the small details that keep a busy service feeling personal.</p></article>
        <article className="feature-block warm"><span className="feature-n">02 / KITCHEN</span><h3>Tickets in sync.</h3><p>Front and back of house share one queue, from the moment an order is sent until it is ready.</p></article>
        <article className="feature-block"><span className="feature-n">03 / CARE</span><h3>Freshness matters.</h3><p>Track pars, suppliers and expiry dates for the seafood and produce your menu depends on.</p></article>
      </div>
    </section>
    <div className="landing-quote"><div className="quote-inner"><blockquote>“A better shift is one where everyone knows what needs care next.”</blockquote><small>The Munaco way · Manila</small></div></div>
    <footer className="landing-footer"><strong>Cafe Munaco</strong><span>For the people behind every good meal.</span><Link href="/sign-in" style={{ color: '#315547', fontWeight: 700, textDecoration: 'none' }}>Employee access →</Link></footer>
  </div>;
}

function Protected({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn) return <Redirect to="/" />;
  return <>{children}</>;
}
function LoadingScreen() { return <div className="content"><div className="skeleton" style={{ height: 35, width: 240, marginBottom: 18 }}/><div className="skeleton" style={{ height: 130, width: '100%' }}/></div>; }
type Role = StaffMemberRole;
function AppPage() {
  const { user } = useUser();
  const profile = useGetMyStaffProfile();
  const [loc] = useLocation();
  if (profile.isLoading) return <LoadingScreen />;
  if (profile.isError || !profile.data) return <BootstrapPage email={user?.primaryEmailAddress?.emailAddress || ''}/>;
  return <Shell profile={profile.data} path={loc}><FeatureRouter profile={profile.data}/></Shell>;
}

function BootstrapPage({ email }: { email: string }) {
  const { signOut } = useClerk();
  const profile = useGetMyStaffProfile();
  return <div className="landing" style={{ minHeight: '100dvh', padding: '24px' }}>
    <div className="panel" style={{ maxWidth: 620, margin: '12vh auto', padding: 32 }}>
      <div className="eyebrow">Employee account setup</div><h1>One last step before your shift.</h1>
      <p className="heading-note" style={{ lineHeight: 1.7, margin: '12px 0 20px' }}>You are signed in as <strong>{email}</strong>, but this account has not been linked to a Munaco staff profile yet. If this is the first employee account, it will become the initial administrator. After setup, an administrator must add each teammate's verified work email to the Staff roster before they can access shift tools.</p>
      <div className="actions" style={{ marginTop: 20 }}><button className="button ghost" onClick={() => profile.refetch()}><RefreshCw size={14}/> Check again</button><button className="button primary" onClick={() => signOut({ redirectUrl: basePath || '/' })}><LogOut size={14}/> Sign out</button></div>
    </div>
  </div>;
}

const navItems: { href: string; label: string; icon: typeof House; roles: Role[] }[] = [
  { href: '/operations', label: 'Shift overview', icon: LayoutDashboard, roles: ['admin','cashier','waiter','kitchen','inventory'] },
  { href: '/orders', label: 'Orders', icon: ClipboardList, roles: ['admin','cashier','waiter'] },
  { href: '/kitchen', label: 'Kitchen queue', icon: ChefHat, roles: ['admin','kitchen'] },
  { href: '/reservations', label: 'Reservations & events', icon: CalendarDays, roles: ['admin','cashier','waiter'] },
  { href: '/inventory', label: 'Inventory', icon: Boxes, roles: ['admin','inventory'] },
  { href: '/menu', label: 'Menu & availability', icon: Utensils, roles: ['admin'] },
  { href: '/staff', label: 'Staff roster', icon: Users, roles: ['admin'] },
  { href: '/account', label: 'My account', icon: Settings2, roles: ['admin','cashier','waiter','kitchen','inventory'] },
];

function Shell({ profile, path, children }: { profile: StaffMember; path: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { signOut } = useClerk();
  const current = navItems.find((n) => n.href === path)?.label || 'Munaco Operations';
  return <div className="app-shell grain">
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <Link href="/operations" className="brand-mark" style={{ color: 'inherit', textDecoration: 'none' }} onClick={() => setOpen(false)}>
        <span className="brand-symbol">M</span><span><span className="brand-name">Cafe Munaco</span><span className="brand-caption">Operations desk</span></span>
      </Link>
      <div className="nav-label">Your stations</div>
      <nav>{navItems.filter((i) => i.roles.includes(profile.role)).map((item) => {
        const Icon = item.icon;
        return <Link key={item.href} href={item.href} className={`nav-link ${path === item.href ? 'active' : ''}`} onClick={() => setOpen(false)}><Icon/><span>{item.label}</span></Link>;
      })}</nav>
      <div className="sidebar-bottom"><div className="shift-card"><div><span className="shift-dot"/><strong>Service is live</strong></div><p>Stay close to the handoff. Every station is working from the same board.</p></div>
        <button className="nav-link" style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left' }} onClick={() => signOut({ redirectUrl: basePath || '/' })}><LogOut size={17}/><span>Sign out</span></button>
      </div>
    </aside>
    <div className="main-area">
      <header className="topbar">
        <div className="topbar-left"><button aria-label="Open navigation" className="icon-button mobile-menu-button" onClick={() => setOpen(!open)}><Menu size={17}/></button><span className="breadcrumb">{current}</span></div>
        <div className="topbar-right"><span className="clock">{new Intl.DateTimeFormat('en-PH',{weekday:'short',month:'short',day:'numeric'}).format(new Date())}</span><div className="user-chip"><span className="avatar">{initials(profile.name)}</span><span>{profile.name}<small style={{ display: 'block', fontSize: 9, color: '#839083', fontWeight: 500, textTransform: 'capitalize' }}>{profile.role}</small></span></div></div>
      </header>
      <main className="content">{children}</main>
    </div>
    {open && <button aria-label="Close navigation" className="sidebar-scrim" onClick={() => setOpen(false)}/>}
  </div>;
}
function initials(value: string) { return value.split(/\s+/).slice(0,2).map((x) => x[0]).join('').toUpperCase(); }
function FeatureRouter({ profile }: { profile: StaffMember }) {
  return <Switch>
    <Route path="/operations"><Operations profile={profile}/></Route>
    <Route path="/orders"><Access profile={profile} allow={['admin','waiter','cashier']}><OrdersPage profile={profile}/></Access></Route>
    <Route path="/kitchen"><Access profile={profile} allow={['admin','kitchen']}><KitchenPage/></Access></Route>
    <Route path="/reservations"><Access profile={profile} allow={['admin','waiter','cashier']}><ReservationsPage/></Access></Route>
    <Route path="/inventory"><Access profile={profile} allow={['admin','inventory']}><InventoryPage/></Access></Route>
    <Route path="/menu"><Access profile={profile} allow={['admin']}><MenuPage/></Access></Route>
    <Route path="/staff"><Access profile={profile} allow={['admin']}><StaffPage/></Access></Route>
    <Route path="/account"><Account profile={profile}/></Route>
    <Route><Operations profile={profile}/></Route>
  </Switch>;
}
function Access({ profile, allow, children }: { profile: StaffMember; allow: Role[]; children: ReactNode }) {
  if (!allow.includes(profile.role)) return <div className="access-denied"><h2>This station is not on your role.</h2><p>Your {profile.role} account does not have access to this workspace. Ask an administrator if your role needs to change.</p></div>;
  return <>{children}</>;
}
function PageHeading({ eyebrow, title, note, children }: { eyebrow: string; title: string; note: string; children?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="heading-note">{note}</p></div>{children && <div className="actions">{children}</div>}</div>;
}
function Modal({ title, subtitle, close, children }: { title: string; subtitle: string; close: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><section className="modal" role="dialog" aria-modal="true">
    <div className="modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" aria-label="Close" onClick={close}><X size={16}/></button></div>{children}
  </section></div>;
}
function QueryFeedback({ loading, error, retry }: { loading: boolean; error: boolean; retry: () => void }) {
  if (loading) return <div className="panel" style={{ padding: 20 }}><div className="skeleton" style={{ height: 18, width: 180, marginBottom: 16 }}/><div className="skeleton" style={{ height: 100 }}/></div>;
  if (error) return <div className="access-denied"><h2>Could not load this station.</h2><p>Check your connection and try again. Your changes have not been replaced with sample data.</p><button className="button small" style={{ marginTop: 12 }} onClick={retry}><RefreshCw size={13}/> Retry</button></div>;
  return null;
}
function Empty({ icon: Icon = Archive, title, detail, action }: { icon?: typeof Archive; title: string; detail: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-mark"><Icon size={20}/></div><h3>{title}</h3><p>{detail}</p>{action}</div>;
}
function Status({ value }: { value: string }) { return <span className={`status-pill status-${value}`}>{value.replace('-', ' ')}</span>; }
function money(value: number) { return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value); }
function dateTime(value: string) { return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)); }
function invalidate(qc: ReturnType<typeof useQueryClient>, ...keys: readonly (readonly unknown[])[]) { keys.forEach((queryKey) => { void qc.invalidateQueries({ queryKey }); }); }

function Operations({ profile }: { profile: StaffMember }) {
  const dashboard = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey(), refetchInterval: 30_000 } });
  const orders = useListOrders({ query: { queryKey: getListOrdersQueryKey(), refetchInterval: 25_000 } });
  const reservations = useListReservations();
  const inventory = useListInventory();
  const { data: summary } = dashboard;
  const active = (orders.data || []).filter((o) => ['queued','preparing','ready'].includes(o.status)).slice(0,5);
  return <>
    <PageHeading eyebrow={`Good service, ${profile.name.split(' ')[0]}`} title="Shift overview" note="A live read on the room, the queue and what needs attention."/>
    <QueryFeedback loading={dashboard.isLoading || orders.isLoading} error={dashboard.isError || orders.isError} retry={() => { dashboard.refetch(); orders.refetch(); }}/>
    {summary && <><div className="metric-grid">
      <Metric icon={ShoppingBag} label="Active orders" value={summary.activeOrders} foot={`${summary.waitingOrders} waiting for the line`} />
      <Metric icon={CalendarDays} label="Bookings today" value={summary.reservationsToday} foot={`${(reservations.data || []).filter((r) => new Date(r.startsAt).toDateString() === new Date().toDateString()).length} guest plans on the board`} color="warm"/>
      <Metric icon={AlertTriangle} label="Low stock" value={summary.lowStockItems} foot="Items below their par level" color="gold"/>
      <Metric icon={CircleDollarSign} label="Today's revenue" value={money(summary.revenueToday)} foot="Paid orders · PHP" color="blue"/>
    </div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-head"><div><h2 className="panel-title">On the pass</h2><p className="panel-subtitle">Orders moving through service right now</p></div><Link href="/orders" className="button small ghost">All orders <ChevronRight size={13}/></Link></div>
        {active.length ? <div className="order-list">{active.map((o) => <div className="order-row" key={o.id}><div className="order-main"><span className="order-number">{o.orderNumber}</span><div style={{ minWidth: 0 }}><div className="order-desc">{o.customerName || o.tableName || (o.orderType === 'takeout' ? 'Takeout guest' : 'Walk-in')}</div><div className="order-meta">{o.items.reduce((n,i)=>n+i.quantity,0)} items · {o.serverName} · {dateTime(o.createdAt)}</div></div></div><span className="order-total">{money(o.total)}</span><Status value={o.status}/></div>)}</div> : <Empty icon={Coffee} title="The pass is clear" detail="New orders will appear here as soon as the team sends them." action={<Link href="/orders" className="button small primary">Start an order</Link>}/>}
      </section>
      <section className="panel"><div className="panel-head"><div><h2 className="panel-title">Shift notes</h2><p className="panel-subtitle">Recent activity across Munaco</p></div><Activity size={17} color="#66816e"/></div>
        {summary.recentActivity?.length ? <div className="activity-list">{summary.recentActivity.slice(0,6).map((a) => <div className="activity-item" key={a.id}><span className="activity-symbol">{a.kind === 'order' ? <ShoppingBag size={13}/> : a.kind === 'booking' ? <CalendarDays size={13}/> : <Package size={13}/>}</span><div><div className="activity-text">{a.label}</div><div className="activity-detail">{a.detail}</div><div className="activity-time">{dateTime(a.occurredAt)}</div></div></div>)}</div> : <Empty icon={Activity} title="A quiet moment" detail="New orders, bookings and stock updates will appear here."/>}
      </section>
    </div>
    <div className="dashboard-grid" style={{ marginTop: 16 }}>
      <section className="panel"><div className="panel-head"><div><h2 className="panel-title">Next guests</h2><p className="panel-subtitle">Upcoming reservations and celebrations</p></div><Link href="/reservations" className="button small ghost">Bookings <ChevronRight size={13}/></Link></div>
        {(reservations.data || []).filter((r) => !['completed','cancelled'].includes(r.status)).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)).slice(0,4).map((r) => <BookingRow reservation={r} key={r.id}/>)}{!reservations.isLoading && !reservations.data?.length && <Empty icon={CalendarDays} title="No upcoming bookings" detail="Add a reservation, birthday or special event."/>}
      </section>
      <section className="panel"><div className="panel-head"><div><h2 className="panel-title">Fresh check</h2><p className="panel-subtitle">Items that may need a top-up</p></div><Link href="/inventory" className="button small ghost">Stock room <ChevronRight size={13}/></Link></div>
        {(inventory.data || []).filter((i) => i.lowStock).slice(0,4).map((i) => <div className="order-row" key={i.id} style={{ margin: '0 18px' }}><div><div className="order-desc">{i.name}</div><div className="order-meta">{i.supplier || 'Supplier not listed'}</div></div><span className="order-total">{i.quantity} {i.unit}</span><Status value="pending"/></div>)}{!inventory.data?.some((i) => i.lowStock) && <Empty icon={Boxes} title="Par levels look good" detail="Low stock items will be flagged here."/>}
      </section>
    </div></>}
  </>;
}
function Metric({ icon: Icon, label, value, foot, color = '' }: { icon: typeof House; label: string; value: string | number; foot: string; color?: string }) {
  return <div className="panel metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${color}`}><Icon size={15}/></span></div><div className="metric-value">{value}</div><div className="metric-foot">{foot}</div><span className="metric-accent"/></div>;
}
function BookingRow({ reservation }: { reservation: Reservation }) {
  const d = new Date(reservation.startsAt);
  return <div className="booking-card"><div className="booking-date"><div className="booking-day">{d.getDate()}</div><div className="booking-month">{d.toLocaleString('en-PH',{month:'short'})} · {d.toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit'})}</div></div><div><div className="booking-name">{reservation.customerName}</div><div className="booking-meta">{reservation.guests} guests · {reservation.bookingType} · {reservation.phone}</div>{reservation.notes && <div className="booking-note">{reservation.notes}</div>}</div><Status value={reservation.status}/></div>;
}

function OrdersPage({ profile }: { profile: StaffMember }) {
  const qc = useQueryClient(); const query = useListOrders({ query: { queryKey: getListOrdersQueryKey(), refetchInterval: 20_000 } });
  const menu = useListMenuItems(); const update = useUpdateOrder({ mutation: { onSuccess: () => invalidate(qc,getListOrdersQueryKey(),getGetDashboardQueryKey()) } });
  const [modal,setModal]=useState(false); const [search,setSearch]=useState(''); const [filter,setFilter]=useState('active');
  const list=(query.data||[]).filter(o=>(filter==='all'||(filter==='active'?['queued','preparing','ready','served'].includes(o.status):o.status===filter))&&`${o.orderNumber} ${o.customerName||''} ${o.tableName||''}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return <><PageHeading eyebrow="Front of house" title="Orders" note="Build the check, send it to the line, keep payment in view."><button className="button primary" onClick={()=>setModal(true)}><Plus size={15}/> New order</button></PageHeading>
    <QueryFeedback loading={query.isLoading} error={query.isError} retry={()=>query.refetch()}/>
    {!query.isLoading&&!query.isError&&<><div className="toolbar"><div className="search"><Search size={15}/><input placeholder="Search tickets, guest or table…" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="filter-tabs">{['active','queued','ready','paid','all'].map(f=><button key={f} className={`filter-tab ${filter===f?'selected':''}`} onClick={()=>setFilter(f)}>{f}</button>)}</div></div>
    <section className="panel table-wrap"><table><thead><tr><th>Ticket</th><th>Guest / table</th><th>Items</th><th>Server</th><th>Total</th><th>Kitchen</th><th>Payment</th><th>Next action</th></tr></thead><tbody>
      {list.map(o=><tr key={o.id}><td className="primary-cell">{o.orderNumber}<div className="secondary-cell">{dateTime(o.createdAt)} · {o.orderType}</div></td><td>{o.customerName||'Walk-in'}<div className="secondary-cell">{o.tableName||'Takeout'}</div></td><td>{o.items.reduce((n,i)=>n+i.quantity,0)} items<div className="secondary-cell">{o.items.map(i=>`${i.quantity}× ${i.name}`).join(', ')}</div></td><td>{o.serverName}</td><td>{money(o.total)}</td><td><Status value={o.status}/></td><td><Status value={o.paymentStatus}/></td><td><OrderActions order={o} update={update}/></td></tr>)}
    </tbody></table>{!list.length&&<Empty icon={ClipboardList} title="No orders in this view" detail="Start a new order or switch to another status filter." action={<button className="button small primary" onClick={()=>setModal(true)}>Create an order</button>}/>}</section></>}
    {modal&&<CreateOrderModal profile={profile} menu={menu.data||[]} close={()=>setModal(false)}/>}
  </>;
}
function OrderActions({ order, update }: { order: Order; update: ReturnType<typeof useUpdateOrder> }) {
  const step: Partial<Record<OrderStatus,OrderStatus>>={queued:'preparing',preparing:'ready',ready:'served',served:'paid'};
  if (order.status==='paid'||order.status==='cancelled') return <span className="secondary-cell">Complete</span>;
  if(order.status==='served'&&order.paymentStatus==='unpaid') return <button className="button small primary" disabled={update.isPending} onClick={()=>update.mutate({id:order.id,data:{paymentStatus:'paid',status:'paid'}})}><CreditCard size={12}/> Take payment</button>;
  const next=step[order.status];
  return <div className="table-actions">{next&&<button className="button small" disabled={update.isPending} onClick={()=>update.mutate({id:order.id,data:{status:next}})}>{next==='preparing'?'Start':next==='ready'?'Ready':next==='served'?'Served':next}</button>}<button className="icon-button" title="Cancel order" disabled={update.isPending} onClick={()=>{if(window.confirm(`Cancel ${order.orderNumber}?`))update.mutate({id:order.id,data:{status:'cancelled'}})}}><X size={14}/></button></div>;
}
function CreateOrderModal({ profile, menu, close }: { profile: StaffMember; menu: MenuItem[]; close:()=>void }) {
  const qc=useQueryClient(); const create=useCreateOrder({mutation:{onSuccess:()=>{invalidate(qc,getListOrdersQueryKey(),getGetDashboardQueryKey());close()}}});
  const [orderType,setType]=useState<'dine-in'|'takeout'>('dine-in');const [table,setTable]=useState('');const [guest,setGuest]=useState('');const [cart,setCart]=useState<{id:number;qty:number;notes:string}[]>([]);
  const available=menu.filter(m=>m.available);const total=cart.reduce((sum,c)=>sum+(available.find(m=>m.id===c.id)?.price||0)*c.qty,0);
  function add(id:number){setCart(old=>old.some(c=>c.id===id)?old.map(c=>c.id===id?{...c,qty:c.qty+1}:c):[...old,{id,qty:1,notes:''}])}
  return <Modal title="Start an order" subtitle="The ticket goes straight to the shared kitchen queue." close={close}><form onSubmit={e=>{e.preventDefault();if(!cart.length)return;create.mutate({data:{orderType,tableName:orderType==='dine-in'?table||null:null,customerName:guest||null,items:cart.map(c=>({menuItemId:c.id,quantity:c.qty,notes:c.notes||null}))}})}}><div className="form-grid">
    <div className="field"><label>Order type</label><select value={orderType} onChange={e=>setType(e.target.value as 'dine-in'|'takeout')}><option value="dine-in">Dine in</option><option value="takeout">Takeout</option></select></div>
    <div className="field"><label>{orderType==='dine-in'?'Table':'Pickup guest'}</label><input value={orderType==='dine-in'?table:guest} onChange={e=>orderType==='dine-in'?setTable(e.target.value):setGuest(e.target.value)} placeholder={orderType==='dine-in'?'e.g. Table 06':'Guest name'}/></div>
    {orderType==='dine-in'&&<div className="field full"><label>Guest name <span style={{fontWeight:400}}>(optional)</span></label><input value={guest} onChange={e=>setGuest(e.target.value)} placeholder="Name for the check"/></div>}
    <div className="field full"><label>Available menu</label>{available.length?<div className="line-builder">{available.map(m=><div className="line-row" key={m.id}><button type="button" className="button small" style={{justifyContent:'space-between'}} onClick={()=>add(m.id)}><span>{m.name}</span><span>{money(m.price)}</span></button><span className="secondary-cell">{cart.find(c=>c.id===m.id)?.qty||''}</span><button type="button" className="icon-button" aria-label={`Add ${m.name}`} onClick={()=>add(m.id)}><Plus size={14}/></button></div>)}</div>:<p className="secondary-cell">No available menu items. Update menu availability first.</p>}</div>
    {cart.length>0&&<div className="field full"><label>Order lines</label>{cart.map(c=>{const m=available.find(x=>x.id===c.id);if(!m)return null;return <div className="line-row" key={c.id}><span className="primary-cell">{m.name}</span><input type="number" min="1" value={c.qty} onChange={e=>setCart(old=>old.map(x=>x.id===c.id?{...x,qty:Math.max(1,Number(e.target.value))}:x))}/><button type="button" className="icon-button" aria-label={`Remove ${m.name}`} onClick={()=>setCart(old=>old.filter(x=>x.id!==c.id))}><X size={14}/></button></div>})}<div className="basket-total"><span>Ticket total</span><strong>{money(total)}</strong></div></div>}
  </div><div className="modal-actions"><button type="button" className="button ghost" onClick={close}>Back</button><button className="button primary" disabled={!cart.length||create.isPending}>{create.isPending?'Sending…':<><ShoppingBag size={14}/> Send to kitchen</>}</button></div>{create.isError&&<p className="secondary-cell" style={{color:'#b94c3d',marginTop:10}}>Could not submit this order. Check the menu and try again.</p>}</form></Modal>;
}

function KitchenPage() {
  const qc=useQueryClient(); const query=useListOrders({query:{queryKey:getListOrdersQueryKey(),refetchInterval:12_000}});
  const update=useUpdateOrder({mutation:{onSuccess:()=>invalidate(qc,getListOrdersQueryKey(),getGetDashboardQueryKey())}});
  const groups=[{title:'New tickets',states:['queued'],next:'preparing' as OrderStatus,action:'Start prep'}, {title:'On the line',states:['preparing'],next:'ready' as OrderStatus,action:'Mark ready'}, {title:'Ready at pass',states:['ready'],next:'served' as OrderStatus,action:'Hand off'}];
  return <><PageHeading eyebrow="Back of house" title="Kitchen queue" note="New tickets surface here automatically. Keep the pass moving in order."/><QueryFeedback loading={query.isLoading} error={query.isError} retry={()=>query.refetch()}/>
    {!query.isLoading&&!query.isError&&<div className="kitchen-columns">{groups.map(g=>{const rows=(query.data||[]).filter(o=>g.states.includes(o.status));return <section className="kitchen-column" key={g.title}><div className="column-heading"><span>{g.title}</span><span className="count-bubble">{rows.length}</span></div>{rows.map(o=><article className="ticket" key={o.id}><div className="ticket-top"><span className="ticket-number">{o.orderNumber}</span><Status value={o.orderType}/></div><div style={{fontSize:11,fontWeight:700,marginBottom:7}}>{o.tableName||o.customerName||'Takeout'} <span style={{fontWeight:400,color:'#818b7f'}}>· {dateTime(o.createdAt)}</span></div>{o.items.map((i,idx)=><div key={idx}><div className="ticket-item"><span>{i.name}</span><strong>× {i.quantity}</strong></div>{i.notes&&<div className="ticket-notes">{i.notes}</div>}</div>)}<div className="ticket-footer"><span>{o.serverName}</span><button className="button small primary" disabled={update.isPending} onClick={()=>update.mutate({id:o.id,data:{status:g.next}})}>{g.action} <ChevronRight size={12}/></button></div></article>)}{!rows.length&&<div style={{padding:'25px 8px',textAlign:'center',fontSize:11,color:'#879286'}}>All clear for now.</div>}</section>})}</div>}
  </>;
}

function ReservationsPage() {
  const qc=useQueryClient();const query=useListReservations({query:{queryKey:getListReservationsQueryKey(),refetchInterval:60_000}});const create=useCreateReservation({mutation:{onSuccess:()=>invalidate(qc,getListReservationsQueryKey(),getGetDashboardQueryKey())}});const update=useUpdateReservation({mutation:{onSuccess:()=>invalidate(qc,getListReservationsQueryKey(),getGetDashboardQueryKey())}});
  const [modal,setModal]=useState(false);const [filter,setFilter]=useState('upcoming');
  const rows=(query.data||[]).filter(r=>filter==='all'||(filter==='upcoming'?!['completed','cancelled'].includes(r.status):r.bookingType===filter)).sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
  return <><PageHeading eyebrow="Guest plans" title="Reservations & events" note="Every booking, from a table for two to a full-room celebration."><button className="button primary" onClick={()=>setModal(true)}><Plus size={15}/> Add booking</button></PageHeading><QueryFeedback loading={query.isLoading} error={query.isError} retry={()=>query.refetch()}/>
    {!query.isLoading&&!query.isError&&<><div className="toolbar"><span className="heading-note">{rows.length} bookings in view</span><div className="filter-tabs">{['upcoming','reservation','birthday','buffet','event','all'].map(f=><button key={f} className={`filter-tab ${filter===f?'selected':''}`} onClick={()=>setFilter(f)}>{f}</button>)}</div></div><section className="panel">{rows.map(r=><div className="booking-card" key={r.id}><div className="booking-date"><div className="booking-day">{new Date(r.startsAt).getDate()}</div><div className="booking-month">{new Date(r.startsAt).toLocaleString('en-PH',{month:'short'})}<br/>{new Date(r.startsAt).toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit'})}</div></div><div><div className="booking-name">{r.customerName}</div><div className="booking-meta">{r.guests} guests · {r.bookingType} · {r.phone}</div>{r.notes&&<div className="booking-note">{r.notes}</div>}</div><div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8}}><Status value={r.status}/><select aria-label={`Update status for ${r.customerName}`} style={{width:115,padding:'6px 8px',fontSize:10}} value={r.status} disabled={update.isPending} onChange={e=>update.mutate({id:r.id,data:{status:e.target.value as ReservationStatus}})}>{['pending','confirmed','arrived','completed','cancelled'].map(s=><option key={s}>{s}</option>)}</select></div></div>)}{!rows.length&&<Empty icon={CalendarDays} title="No bookings to show" detail="Add a reservation, birthday, buffet or event to plan ahead." action={<button className="button small primary" onClick={()=>setModal(true)}>Add booking</button>}/>}</section></>}
    {modal&&<ReservationModal create={create} close={()=>setModal(false)}/>}
  </>;
}
function ReservationModal({create,close}:{create:ReturnType<typeof useCreateReservation>;close:()=>void}) {
  const [f,setF]=useState({customerName:'',phone:'',startsAt:'',guests:'2',bookingType:'reservation',notes:''});
  return <Modal title="Add a guest plan" subtitle="Keep the occasion and key details with the booking." close={close}><form onSubmit={e=>{e.preventDefault();create.mutate({data:{customerName:f.customerName,phone:f.phone,startsAt:new Date(f.startsAt).toISOString(),guests:Number(f.guests),bookingType:f.bookingType as 'reservation'|'birthday'|'buffet'|'event',notes:f.notes||null,status:'pending'}},{onSuccess:close})}}><div className="form-grid">
    <Field label="Guest name"><input required value={f.customerName} onChange={e=>setF({...f,customerName:e.target.value})}/></Field><Field label="Phone"><input required value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></Field>
    <Field label="Date & time"><input required type="datetime-local" value={f.startsAt} onChange={e=>setF({...f,startsAt:e.target.value})}/></Field><Field label="Guests"><input required type="number" min="1" value={f.guests} onChange={e=>setF({...f,guests:e.target.value})}/></Field>
    <Field label="Booking type"><select value={f.bookingType} onChange={e=>setF({...f,bookingType:e.target.value})}>{['reservation','birthday','buffet','event'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Notes"><input value={f.notes} onChange={e=>setF({...f,notes:e.target.value})} placeholder="Dietary needs, setup…"/></Field>
    </div><div className="modal-actions"><button type="button" className="button ghost" onClick={close}>Cancel</button><button className="button primary" disabled={create.isPending}>{create.isPending?'Saving…':'Save booking'}</button></div></form></Modal>;
}
function Field({label,children,full=false}:{label:string;children:ReactNode;full?:boolean}) { return <div className={`field ${full?'full':''}`}><label>{label}</label>{children}</div>; }

function InventoryPage() {
  const qc=useQueryClient();const query=useListInventory({query:{queryKey:getListInventoryQueryKey()}});const create=useCreateInventoryItem({mutation:{onSuccess:()=>invalidate(qc,getListInventoryQueryKey(),getGetDashboardQueryKey())}});const update=useUpdateInventoryItem({mutation:{onSuccess:()=>invalidate(qc,getListInventoryQueryKey(),getGetDashboardQueryKey())}});const adjust=useAdjustInventory({mutation:{onSuccess:()=>invalidate(qc,getListInventoryQueryKey(),getGetDashboardQueryKey())}});
  const [modal,setModal]=useState<'add'|'edit'|'adjust'|null>(null);const [selected,setSelected]=useState<InventoryItem|null>(null);const [search,setSearch]=useState('');
  const rows=(query.data||[]).filter(i=>`${i.name} ${i.category} ${i.supplier||''}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>Number(b.lowStock)-Number(a.lowStock)||a.name.localeCompare(b.name));
  return <><PageHeading eyebrow="Stock room" title="Inventory" note="Know what's on hand, what's coming up and who supplies it."><button className="button primary" onClick={()=>{setSelected(null);setModal('add')}}><Plus size={15}/> Add stock item</button></PageHeading><QueryFeedback loading={query.isLoading} error={query.isError} retry={()=>query.refetch()}/>
    {!query.isLoading&&!query.isError&&<><div className="inventory-grid"><section><div className="toolbar"><div className="search"><Search size={15}/><input placeholder="Find an ingredient or supplier…" value={search} onChange={e=>setSearch(e.target.value)}/></div><span className="heading-note">{rows.length} stock items</span></div><section className="panel table-wrap"><table><thead><tr><th>Ingredient</th><th>On hand</th><th>Par level</th><th>Supplier</th><th>Unit cost</th><th>Freshness</th><th>Actions</th></tr></thead><tbody>{rows.map(i=><tr key={i.id}><td className="primary-cell">{i.name}<div className="secondary-cell">{i.category}</div></td><td><strong>{i.quantity}</strong> {i.unit}<div className="secondary-cell">{i.lowStock?<Status value="pending"/>:<span style={{color:'#52745c'}}>In range</span>}</div></td><td>{i.parLevel} {i.unit}</td><td>{i.supplier||'—'}</td><td>{money(i.unitCost)}</td><td>{i.expiresAt?new Date(i.expiresAt).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}):'Not set'}</td><td><div className="table-actions"><button className="button small" onClick={()=>{setSelected(i);setModal('adjust')}}><ArrowUp size={12}/><ArrowDown size={12}/> Adjust</button><button className="icon-button" aria-label={`Edit ${i.name}`} onClick={()=>{setSelected(i);setModal('edit')}}><Settings2 size={14}/></button></div></td></tr>)}</tbody></table>{!rows.length&&<Empty icon={Boxes} title="No stock items found" detail="Add an ingredient and capture its supplier, par level and expiry date." action={<button className="button small primary" onClick={()=>setModal('add')}>Add stock item</button>}/>}</section></section>
      <aside className="panel stock-summary"><h3>Stock watch</h3><div className="stock-stat"><span>Items tracked</span><strong>{query.data?.length||0}</strong></div><div className="stock-stat"><span>Below par</span><strong style={{color:'#ad5d40'}}>{query.data?.filter(i=>i.lowStock).length||0}</strong></div><div className="stock-stat"><span>Suppliers</span><strong>{new Set(query.data?.map(i=>i.supplier).filter(Boolean)).size}</strong></div><div className="stock-warning"><strong>Freshness reminder</strong><br/>Record delivery and expiry details when seafood and produce come in. The board reflects the latest update from your team.</div></aside></div></>}
    {modal&&<InventoryModal kind={modal} item={selected} create={create} update={update} adjust={adjust} close={()=>setModal(null)}/>}
  </>;
}
function InventoryModal({kind,item,create,update,adjust,close}:{kind:'add'|'edit'|'adjust';item:InventoryItem|null;create:ReturnType<typeof useCreateInventoryItem>;update:ReturnType<typeof useUpdateInventoryItem>;adjust:ReturnType<typeof useAdjustInventory>;close:()=>void}) {
  const [f,setF]=useState({name:item?.name||'',category:item?.category||'Seafood',unit:item?.unit||'kg',quantity:String(item?.quantity??0),parLevel:String(item?.parLevel??0),unitCost:String(item?.unitCost??0),supplier:item?.supplier||'',expiresAt:item?.expiresAt?.slice(0,10)||''});const [change,setChange]=useState('');const [reason,setReason]=useState('Delivery received');
  const title=kind==='add'?'Add stock item':kind==='edit'?'Edit stock details':'Adjust on hand';
  return <Modal title={title} subtitle={kind==='adjust'?`${item?.name} · record a delivery, waste or count correction.`:'Keep quantities, source and freshness details current.'} close={close}><form onSubmit={e=>{e.preventDefault();if(kind==='adjust'&&item){adjust.mutate({id:item.id,data:{change:Number(change),reason}},{onSuccess:close});return}const payload={name:f.name,category:f.category,unit:f.unit,quantity:Number(f.quantity),parLevel:Number(f.parLevel),unitCost:Number(f.unitCost),supplier:f.supplier||null,expiresAt:f.expiresAt?new Date(`${f.expiresAt}T12:00:00`).toISOString():null};if(kind==='add')create.mutate({data:payload},{onSuccess:close});else if(item)update.mutate({id:item.id,data:{name:f.name,category:f.category,unit:f.unit,parLevel:Number(f.parLevel),unitCost:Number(f.unitCost),supplier:f.supplier||null,expiresAt:f.expiresAt?new Date(`${f.expiresAt}T12:00:00`).toISOString():null}},{onSuccess:close});}}><div className="form-grid">
    {kind==='adjust'?<><Field label="Change quantity"><input type="number" step="any" required value={change} onChange={e=>setChange(e.target.value)} placeholder="Use negative for waste"/></Field><Field label="Reason"><select value={reason} onChange={e=>setReason(e.target.value)}>{['Delivery received','Waste / spoilage','Count correction','Used in service'].map(r=><option key={r}>{r}</option>)}</select></Field></>:<>
      <Field label="Item name"><input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></Field><Field label="Category"><select value={f.category} onChange={e=>setF({...f,category:e.target.value})}>{['Seafood','Produce','Meat','Dry goods','Dairy','Beverage','Other'].map(x=><option key={x}>{x}</option>)}</select></Field>
      <Field label="Unit"><input required value={f.unit} onChange={e=>setF({...f,unit:e.target.value})} placeholder="kg, pcs, L"/></Field>{kind==='add'&&<Field label="Starting quantity"><input type="number" min="0" step="any" value={f.quantity} onChange={e=>setF({...f,quantity:e.target.value})}/></Field>}
      <Field label="Par level"><input type="number" min="0" step="any" value={f.parLevel} onChange={e=>setF({...f,parLevel:e.target.value})}/></Field><Field label="Unit cost (PHP)"><input type="number" min="0" step="any" value={f.unitCost} onChange={e=>setF({...f,unitCost:e.target.value})}/></Field>
      <Field label="Supplier"><input value={f.supplier} onChange={e=>setF({...f,supplier:e.target.value})} placeholder="Supplier name"/></Field><Field label="Expiry date"><input type="date" value={f.expiresAt} onChange={e=>setF({...f,expiresAt:e.target.value})}/></Field>
    </>}
    </div><div className="modal-actions"><button type="button" className="button ghost" onClick={close}>Cancel</button><button className="button primary" disabled={create.isPending||update.isPending||adjust.isPending}>{kind==='adjust'?'Save adjustment':'Save stock item'}</button></div></form></Modal>;
}

function MenuPage() {
  const qc=useQueryClient();const query=useListMenuItems({query:{queryKey:getListMenuItemsQueryKey()}});const create=useCreateMenuItem({mutation:{onSuccess:()=>invalidate(qc,getListMenuItemsQueryKey())}});const update=useUpdateMenuItem({mutation:{onSuccess:()=>invalidate(qc,getListMenuItemsQueryKey())}});
  const [modal,setModal]=useState(false);const [selected,setSelected]=useState<MenuItem|null>(null);const [cat,setCat]=useState('All');const [search,setSearch]=useState('');
  const categories=['All',...new Set((query.data||[]).map(x=>x.category))];const rows=(query.data||[]).filter(m=>(cat==='All'||m.category===cat)&&m.name.toLowerCase().includes(search.toLowerCase()));
  return <><PageHeading eyebrow="Menu desk" title="Menu & availability" note="Keep the floor in step with what's actually coming out of the kitchen."><button className="button primary" onClick={()=>{setSelected(null);setModal(true)}}><Plus size={15}/> Add menu item</button></PageHeading><QueryFeedback loading={query.isLoading} error={query.isError} retry={()=>query.refetch()}/>
    {!query.isLoading&&!query.isError&&<><div className="toolbar"><div className="search"><Search size={15}/><input placeholder="Search menu…" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="filter-tabs">{categories.map(c=><button key={c} className={`filter-tab ${cat===c?'selected':''}`} onClick={()=>setCat(c)}>{c}</button>)}</div></div><div className="menu-grid">{rows.map(m=><article className="panel menu-item-card" key={m.id}><div className="menu-card-top"><span className="menu-category">{m.category}</span><button className="icon-button" aria-label={`Edit ${m.name}`} onClick={()=>{setSelected(m);setModal(true)}}><Settings2 size={14}/></button></div><h3>{m.name}</h3><p className="menu-description">{m.description||'A Munaco favourite, made fresh to order.'}</p><div className="menu-card-bottom"><span className="menu-price">{money(m.price)}</span><button className={`status-pill ${m.available?'status-confirmed':'status-cancelled'}`} style={{border:0,cursor:'pointer'}} onClick={()=>update.mutate({id:m.id,data:{available:!m.available}})}>{m.available?'Available':'Unavailable'}</button></div></article>)}</div>{!rows.length&&<section className="panel"><Empty icon={Utensils} title="Nothing on this menu yet" detail="Add dishes with a price and category. Availability changes appear for order entry." action={<button className="button small primary" onClick={()=>setModal(true)}>Add menu item</button>}/></section>}</>}
    {modal&&<MenuModal item={selected} create={create} update={update} close={()=>setModal(false)}/>}
  </>;
}
function MenuModal({item,create,update,close}:{item:MenuItem|null;create:ReturnType<typeof useCreateMenuItem>;update:ReturnType<typeof useUpdateMenuItem>;close:()=>void}) {
  const [f,setF]=useState({name:item?.name||'',category:item?.category||'Mains',description:item?.description||'',price:String(item?.price??0),available:item?.available??true});
  return <Modal title={item?'Edit menu item':'Add to the menu'} subtitle="Clear names and honest availability make ordering easier." close={close}><form onSubmit={e=>{e.preventDefault();const data={name:f.name,category:f.category,description:f.description||null,price:Number(f.price),available:f.available};if(item)update.mutate({id:item.id,data},{onSuccess:close});else create.mutate({data},{onSuccess:close})}}><div className="form-grid"><Field label="Dish name"><input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></Field><Field label="Category"><select value={f.category} onChange={e=>setF({...f,category:e.target.value})}>{['Mains','Small plates','Seafood','Rice & noodles','Desserts','Drinks','Sides','Other'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Price (PHP)"><input required type="number" min="0" step="any" value={f.price} onChange={e=>setF({...f,price:e.target.value})}/></Field><Field label="Availability"><select value={String(f.available)} onChange={e=>setF({...f,available:e.target.value==='true'})}><option value="true">Available</option><option value="false">Unavailable</option></select></Field><Field label="Description" full><textarea value={f.description} onChange={e=>setF({...f,description:e.target.value})} placeholder="Short guest-facing description"/></Field></div><div className="modal-actions"><button type="button" className="button ghost" onClick={close}>Cancel</button><button className="button primary" disabled={create.isPending||update.isPending}>Save item</button></div></form></Modal>;
}

function StaffPage() {
  const qc=useQueryClient();const query=useListStaff({query:{queryKey:getListStaffQueryKey()}});const create=useCreateStaff({mutation:{onSuccess:()=>invalidate(qc,getListStaffQueryKey())}});const update=useUpdateStaff({mutation:{onSuccess:()=>invalidate(qc,getListStaffQueryKey())}});
  const [modal,setModal]=useState(false);const [selected,setSelected]=useState<StaffMember|null>(null);const [search,setSearch]=useState('');
  const rows=(query.data||[]).filter(s=>`${s.name} ${s.email} ${s.role}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageHeading eyebrow="People & access" title="Staff roster" note="Give each teammate the access their station needs."><button className="button primary" onClick={()=>{setSelected(null);setModal(true)}}><Plus size={15}/> Add teammate</button></PageHeading><QueryFeedback loading={query.isLoading} error={query.isError} retry={()=>query.refetch()}/>
    {!query.isLoading&&!query.isError&&<><div className="toolbar"><div className="search"><Search size={15}/><input placeholder="Search the roster…" value={search} onChange={e=>setSearch(e.target.value)}/></div><span className="heading-note">{rows.length} employees · {rows.filter(s=>s.linked).length} linked accounts</span></div><section className="panel table-wrap"><table><thead><tr><th>Employee</th><th>Work email</th><th>Role</th><th>Account</th><th>Joined</th><th>Access</th></tr></thead><tbody>{rows.map(s=><tr key={s.id}><td className="primary-cell"><span className="avatar" style={{display:'inline-grid',verticalAlign:'middle',marginRight:9,width:28,height:28}}>{initials(s.name)}</span>{s.name}</td><td>{s.email}</td><td><span className={`role-chip ${s.role}`}>{s.role}</span></td><td><Status value={s.linked?'confirmed':'pending'}/></td><td>{new Date(s.createdAt).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}</td><td><div className="table-actions"><button className="button small" onClick={()=>{setSelected(s);setModal(true)}}><Settings2 size={12}/> Edit role</button>{!s.linked&&<span className="secondary-cell">Awaiting sign-in</span>}</div></td></tr>)}</tbody></table>{!rows.length&&<Empty icon={Users} title="No teammates found" detail="Add the employee's name, work email and station role to invite them into the roster." action={<button className="button small primary" onClick={()=>setModal(true)}>Add teammate</button>}/>}</section></>}
    {modal&&<StaffModal item={selected} create={create} update={update} close={()=>setModal(false)}/>}
  </>;
}
function StaffModal({item,create,update,close}:{item:StaffMember|null;create:ReturnType<typeof useCreateStaff>;update:ReturnType<typeof useUpdateStaff>;close:()=>void}) {
  const [name,setName]=useState(item?.name||'');const [email,setEmail]=useState(item?.email||'');const [role,setRole]=useState<Role>(item?.role||'waiter');
  return <Modal title={item?'Update teammate':'Add a teammate'} subtitle={item?'Change their name or station access.':'Use the work email they will use to sign in with Clerk.'} close={close}><form onSubmit={e=>{e.preventDefault();if(item)update.mutate({id:item.id,data:{name,role}},{onSuccess:close});else create.mutate({data:{name,email,role}},{onSuccess:close})}}><div className="form-grid"><Field label="Full name"><input required value={name} onChange={e=>setName(e.target.value)}/></Field>{!item&&<Field label="Work email"><input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></Field>}<Field label="Station role"><select value={role} onChange={e=>setRole(e.target.value as Role)}>{['admin','cashier','waiter','kitchen','inventory'].map(r=><option key={r} value={r}>{r}</option>)}</select></Field><div className="field full"><p className="secondary-cell">Admin: full access · Cashier: orders, bookings and payments · Waiter: orders and guest plans · Kitchen: ticket queue · Inventory: stock control.</p></div></div><div className="modal-actions"><button type="button" className="button ghost" onClick={close}>Cancel</button><button className="button primary" disabled={create.isPending||update.isPending}>{item?'Save changes':'Add to roster'}</button></div></form></Modal>;
}

function Account({profile}:{profile:StaffMember}) {
  const { user }=useUser();const {signOut}=useClerk();
  return <><PageHeading eyebrow="Your workspace" title="My account" note="Your employee identity and current station access."/><div className="dashboard-grid" style={{gridTemplateColumns:'minmax(0,1fr) 300px'}}><section className="panel" style={{padding:24}}><div style={{display:'flex',alignItems:'center',gap:16,marginBottom:23}}><div className="avatar" style={{width:58,height:58,fontSize:18}}>{initials(profile.name)}</div><div><h2 className="panel-title" style={{fontSize:21}}>{profile.name}</h2><p className="panel-subtitle">{profile.email}</p></div></div><div className="stock-stat"><span>Station role</span><span className={`role-chip ${profile.role}`}>{profile.role}</span></div><div className="stock-stat"><span>Account connection</span><strong>{profile.linked?'Linked':'Pending'}</strong></div><div className="stock-stat"><span>Roster since</span><strong>{new Date(profile.createdAt).toLocaleDateString('en-PH',{month:'long',year:'numeric'})}</strong></div><div className="stock-stat"><span>Clerk identity</span><strong>{user?.primaryEmailAddress?.emailAddress||profile.email}</strong></div></section><aside className="panel" style={{padding:20}}><div className="empty-mark"><Settings2 size={18}/></div><h2 className="panel-title">Need a role change?</h2><p className="panel-subtitle" style={{lineHeight:1.65,margin:'8px 0 18px'}}>Your station access is managed by Cafe Munaco administrators. Ask them to update your roster entry.</p><button className="button primary" style={{width:'100%'}} onClick={()=>signOut({redirectUrl:basePath||'/'})}><LogOut size={14}/> Sign out</button></aside></div></>;
}

function RoutedErrorBoundary({children}:{children:ReactNode}) {
  const [location]=useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function App() {
  return <TooltipProvider><WouterRouter base={basePath}><RoutedErrorBoundary><ClerkRoutes/></RoutedErrorBoundary></WouterRouter><Toaster/></TooltipProvider>;
}
export default App;