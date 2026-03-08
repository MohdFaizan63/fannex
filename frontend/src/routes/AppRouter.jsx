import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ProtectedRoute, GuestRoute } from './ProtectedRoute';
import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';

// ── Loading spinner ──────────────────────────────────────────────────────────
const PageLoader = () => (
    <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-surface-900)' }}>
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            <p className="text-sm" style={{ color: 'var(--color-surface-500)' }}>Loading…</p>
        </div>
    </div>
);

const wrap = (Component) => (
    <Suspense fallback={<PageLoader />}>
        <Component />
    </Suspense>
);

// ── Public ────────────────────────────────────────────────────────────────────
const Home = lazy(() => import('../pages/Home'));
const Explore = lazy(() => import('../pages/Explore'));
const CreatorProfile = lazy(() => import('../pages/CreatorProfile'));
const NotFound = lazy(() => import('../pages/NotFound'));
const Unauthorized = lazy(() => import('../pages/Unauthorized'));
const UserProfile = lazy(() => import('../pages/UserProfile'));

// ── Subscription ─────────────────────────────────────────────────────────────
const SubscriptionSuccess = lazy(() => import('../pages/subscription/SubscriptionSuccess'));
const SubscriptionCancel = lazy(() => import('../pages/subscription/SubscriptionCancel'));
const SubscribePage = lazy(() => import('../pages/subscription/SubscribePage'));
const Subscriptions = lazy(() => import('../pages/Subscriptions'));

// ── Auth ─────────────────────────────────────────────────────────────────────
const Login = lazy(() => import('../pages/auth/Login'));
const Register = lazy(() => import('../pages/auth/Register'));
const ForgotPassword = lazy(() => import('../pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('../pages/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('../pages/auth/VerifyEmail'));

// ── Creator ───────────────────────────────────────────────────────────────────
const Dashboard = lazy(() => import('../pages/creator/Dashboard'));
const UploadPost = lazy(() => import('../pages/creator/UploadPost'));
const Verification = lazy(() => import('../pages/creator/Verification'));
const Earnings = lazy(() => import('../pages/creator/Earnings'));
const PayoutSettings = lazy(() => import('../pages/creator/PayoutSettings'));
const VerificationStatus = lazy(() => import('../pages/VerificationStatus'));
const Chat = lazy(() => import('../pages/Chat'));
const Wallet = lazy(() => import('../pages/Wallet'));
const CreatorChatDashboard = lazy(() => import('../pages/creator/CreatorChatDashboard'));
const ProfileInsights = lazy(() => import('../pages/creator/ProfileInsights'));
const Subscribers = lazy(() => import('../pages/creator/Subscribers'));


// ── Admin ─────────────────────────────────────────────────────────────────────
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers'));
const AdminPayouts = lazy(() => import('../pages/admin/AdminPayouts'));
const AdminVerifications = lazy(() => import('../pages/admin/AdminVerifications'));
const AdminGate = lazy(() => import('../pages/admin/AdminGate'));

// ── Route tree ────────────────────────────────────────────────────────────────
const router = createBrowserRouter([
    // ── MainLayout: Navbar + Footer ─────────────────────────────────────────
    {
        element: <MainLayout />,
        children: [
            // Public
            { path: '/', element: wrap(Home) },
            { path: '/explore', element: wrap(Explore) },
            { path: '/creator/:id', element: wrap(CreatorProfile) },
            { path: '/unauthorized', element: wrap(Unauthorized) },

            // Subscription result pages (public, after Stripe redirect)
            { path: '/subscription-success', element: wrap(SubscriptionSuccess) },
            { path: '/subscription-cancel', element: wrap(SubscriptionCancel) },

            // Any logged-in user
            {
                element: <ProtectedRoute />,
                children: [
                    { path: '/profile', element: wrap(UserProfile) },
                    { path: '/creator/verification-status', element: wrap(VerificationStatus) },
                    { path: '/creator/:username/subscribe', element: wrap(SubscribePage) },
                    { path: '/subscriptions', element: wrap(Subscriptions) },
                    { path: '/wallet', element: wrap(Wallet) },
                ],
            },

            // Creator + Admin → sidebar layout
            {
                element: <ProtectedRoute allowedRoles={['creator', 'admin']} />,
                children: [{
                    element: <DashboardLayout />,
                    children: [
                        { path: '/dashboard', element: wrap(Dashboard) },
                        { path: '/upload', element: wrap(UploadPost) },
                        { path: '/posts/create', element: wrap(UploadPost) },
                        { path: '/verification', element: wrap(Verification) },
                        { path: '/earnings', element: wrap(Earnings) },
                        { path: '/payout-settings', element: wrap(PayoutSettings) },
                        { path: '/creator/chat', element: wrap(CreatorChatDashboard) },
                        { path: '/insights', element: wrap(ProfileInsights) },
                        { path: '/subscribers', element: wrap(Subscribers) },
                    ],
                }],
            },

            // Admin only → show password gate first, then sidebar layout
            {
                element: <Suspense fallback={null}><AdminGate /></Suspense>,
                children: [{
                    element: <DashboardLayout />,
                    children: [
                        { path: '/admin', element: wrap(AdminDashboard) },
                        { path: '/admin/users', element: wrap(AdminUsers) },
                        { path: '/admin/payouts', element: wrap(AdminPayouts) },
                        { path: '/admin/verifications', element: wrap(AdminVerifications) },
                    ],
                }],
            },
        ],
    },

    // ── AuthLayout: centered card, guest-only ─────────────────────────────────
    {
        element: <GuestRoute />,
        children: [
            {
                element: <AuthLayout />,
                children: [
                    { path: '/login', element: wrap(Login) },
                    { path: '/register', element: wrap(Register) },
                    { path: '/forgot-password', element: wrap(ForgotPassword) },
                    { path: '/reset-password', element: wrap(ResetPassword) },
                ],
            },
            { path: '/verify-email', element: wrap(VerifyEmail) },
        ],
    },

    // ── 404 ──────────────────────────────────────────────────────────────────
    { path: '*', element: wrap(NotFound) },

    // ── Chat: full-screen, no Navbar/Footer ──────────────────────────────────
    {
        element: <ProtectedRoute />,
        children: [
            { path: '/chat/:chatId', element: wrap(Chat) },
        ],
    },
]);

export default function AppRouter() {
    return <RouterProvider router={router} />;
}
