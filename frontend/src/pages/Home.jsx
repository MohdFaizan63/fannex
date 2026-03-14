import { useRef, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectCoverflow } from 'swiper/modules';
import { useAuth } from '../context/AuthContext';
import CreatorOnboardingModal from '../components/onboarding/CreatorOnboardingModal';
import 'swiper/css';
import 'swiper/css/effect-coverflow';

// ─── Local Creator Images ─────────────────────────────────────────────────────
import img1 from '../assets/images/1.jpeg';
import img2 from '../assets/images/2.jpeg';
import img3 from '../assets/images/3.jpeg';
import img4 from '../assets/images/4.jpeg';
import img5 from '../assets/images/5.jpeg';
import img6 from '../assets/images/6.jpeg';
import img7 from '../assets/images/7.jpeg';

const CREATOR_IMAGES = [
    { src: img1, name: 'Ava Sterling', title: 'Visionary Creator', color: '#a855f7' },
    { src: img2, name: 'Kai Nakamura', title: 'Digital Artist', color: '#ec4899' },
    { src: img3, name: 'Zara Moon', title: 'Fashion Icon', color: '#f59e0b' },
    { src: img4, name: 'Riven Cross', title: 'Content Pioneer', color: '#38bdf8' },
    { src: img5, name: 'Luna Vega', title: 'Lifestyle Mogul', color: '#10b981' },
    { src: img6, name: 'Nico Hart', title: 'Fitness Coach', color: '#f97316' },
    { src: img7, name: 'Aria Lake', title: 'Music Producer', color: '#8b5cf6' },
];

// ─── Local Creator Images Set 2 ───────────────────────────────────────────────
import img2_1 from '../assets/images2/1.jpeg';
import img2_2 from '../assets/images2/2.jpeg';
import img2_3 from '../assets/images2/3.jpeg';
import img2_4 from '../assets/images2/4.jpeg';
import img2_5 from '../assets/images2/5.jpeg';

const SPOTLIGHT_IMAGES = [
    { src: img2_1, name: 'Ivy Thornton', title: 'Brand Strategist', color: '#c084fc' },
    { src: img2_2, name: 'Dante Reeves', title: 'Film Director', color: '#fb7185' },
    { src: img2_3, name: 'Serena Blake', title: 'Luxury Lifestyle', color: '#fbbf24' },
    { src: img2_4, name: 'Orion Chase', title: 'Photographer', color: '#34d399' },
    { src: img2_5, name: 'Nova Quinn', title: 'Creative Director', color: '#60a5fa' },
];

// ─── Google Fonts (loaded once) ───────────────────────────────────────────────
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Inter:wght@300;400;500;600;700&display=swap';
document.head.appendChild(fontLink);

// ─── Data ─────────────────────────────────────────────────────────────────────
const CREATORS = [
    { name: 'Sofia M.', cat: 'Fitness', fans: '230K', img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80', color: '#a855f7' },
    { name: 'James K.', cat: 'Boxing', fans: '180K', img: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=400&q=80', color: '#ec4899' },
    { name: 'Aria Chen', cat: 'Art', fans: '95K', img: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400&q=80', color: '#38bdf8' },
    { name: 'Lena V.', cat: 'Fashion', fans: '312K', img: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&q=80', color: '#f59e0b' },
    { name: 'Marco R.', cat: 'Travel', fans: '156K', img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80', color: '#10b981' },
    { name: 'Priya S.', cat: 'Music', fans: '420K', img: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80', color: '#f97316' },
    { name: 'Alex D.', cat: 'Gaming', fans: '280K', img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80', color: '#8b5cf6' },
    { name: 'Maya T.', cat: 'Lifestyle', fans: '198K', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80', color: '#ef4444' },
];

const CATEGORIES = [
    { name: 'Sport', img: 'https://images.unsplash.com/photo-1561049933-c8fbef47b329?w=600&q=80', creator: 'Darren Sungh · 230k+ fans' },
    { name: 'Music', img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80', creator: 'Sarah Wave · 180k+ fans' },
    { name: 'Art', img: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&q=80', creator: 'Elena Arts · 95k+ fans' },
    { name: 'Fashion', img: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=600&q=80', creator: 'Lena V. · 312k+ fans' },
    { name: 'Travel', img: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=80', creator: 'Juliette M. · 190k+ fans' },
];

// ─── Feature flag: set to true once Paytm gateway is live ───────────────────
const SHOW_IMAGE_GALLERIES = true;

// SVG icon components for features
const IconSubscribe = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
);
const IconLock = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
);
const IconChat = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
);
const IconGift = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <polyline points="20 12 20 22 4 22 4 12" />
        <rect x="2" y="7" width="20" height="5" />
        <line x1="12" y1="22" x2="12" y2="7" />
        <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
        <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
    </svg>
);
const IconWallet = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M21 12V7H5a2 2 0 010-4h14v4" />
        <path d="M3 5v14a2 2 0 002 2h16v-5" />
        <path d="M18 12a2 2 0 000 4h4v-4z" />
    </svg>
);
const IconChart = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
);
const IconShield = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
    </svg>
);
const IconPayout = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
);

const FEATURES = [
    {
        Icon: IconLock,
        color: '#a855f7',
        tag: null,
        title: 'Exclusive Subscriber Content',
        desc: 'Gate your best photos, videos, and posts behind a subscription. Your fans unlock premium content the moment they subscribe.',
        hero: true,
    },
    {
        Icon: IconChat,
        color: '#ec4899',
        tag: null,
        title: 'Direct Fan Messaging',
        desc: 'Chat with your subscribers in real time. Build genuine relationships that keep fans coming back.',
    },
    {
        Icon: IconGift,
        color: '#f59e0b',
        tag: null,
        title: 'Fan Gifting',
        desc: 'Let fans send you gifts as a token of appreciation — a frictionless way to earn beyond subscriptions.',
    },
    {
        Icon: IconPayout,
        color: '#10b981',
        tag: null,
        title: 'Fast & Secure Payouts',
        desc: 'Withdraw your earnings directly to your bank account. Get paid without the wait.',
    },
    {
        Icon: IconChart,
        color: '#38bdf8',
        tag: null,
        title: 'Creator Dashboard',
        desc: 'Track your subscribers, revenue, and top-performing content — all from one clean dashboard.',
    },
    {
        Icon: IconWallet,
        color: '#c084fc',
        tag: null,
        title: 'Wallet & Easy Payments',
        desc: 'Fans top up their Fanvew wallet and subscribe seamlessly. No friction, more conversions for you.',
    },
    {
        Icon: IconShield,
        color: '#fb7185',
        tag: null,
        title: 'Verified Creator Accounts',
        desc: 'Every creator on Fanvew goes through a verification process — so fans know they are supporting the real deal.',
    },
];

const TESTIMONIALS = [
    { name: 'Sofia M.', handle: '@sofiam', img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=80&q=80', text: 'Fannex changed my life. I went from zero to ₹8L/month in under a year.' },
    { name: 'Priya S.', handle: '@priyas', img: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=80&q=80', text: 'The platform just gets creators. Payouts are instant, support is incredible.' },
    { name: 'James K.', handle: '@jamesk', img: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=80&q=80', text: 'My subscribers are more engaged here than anywhere else. Worth every rupee.' },
];

// ─── Count-up animation ────────────────────────────────────────────────────────
function CountUp({ end, suffix = '', duration = 2 }) {
    const [count, setCount] = useState(0);
    const ref = useRef(null);
    const inView = useInView(ref, { once: true });
    useEffect(() => {
        if (!inView) return;
        let start = 0;
        const step = end / (duration * 60);
        const timer = setInterval(() => {
            start += step;
            if (start >= end) { setCount(end); clearInterval(timer); }
            else setCount(Math.floor(start));
        }, 1000 / 60);
        return () => clearInterval(timer);
    }, [inView, end, duration]);
    return <span ref={ref}>{count.toLocaleString('en-IN')}{suffix}</span>;
}

// ─── Smooth fade-in when visible ──────────────────────────────────────────────
function Reveal({ children, delay = 0, y = 40, className = '' }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-80px' });
    return (
        <motion.div ref={ref} className={className}
            initial={{ opacity: 0, y }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay, ease: [0.25, 0.4, 0.25, 1] }}>
            {children}
        </motion.div>
    );
}

// ─── Infinite horizontal ticker ────────────────────────────────────────────────
function Ticker({ reverse = false }) {
    const doubled = [...CREATORS, ...CREATORS];
    return (
        <div className="overflow-hidden py-2" style={{
            maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
        }}>
            <motion.div className="flex gap-4" style={{ width: 'max-content' }}
                animate={{ x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
                transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}>
                {doubled.map((c, i) => (
                    <div key={i} className="relative flex-shrink-0 w-44 h-60 rounded-2xl overflow-hidden group cursor-pointer"
                        style={{ boxShadow: `0 0 30px ${c.color}25` }}>
                        <img src={c.img} alt={c.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            style={{ boxShadow: `inset 0 0 0 1.5px ${c.color}` }} />
                        <div className="absolute bottom-4 left-4 right-4">
                            <p className="text-white font-semibold text-sm">{c.name}</p>
                            <div className="flex items-center justify-between mt-1">
                                <span className="text-xs" style={{ color: c.color }}>{c.cat}</span>
                                <span className="text-white/50 text-xs">{c.fans}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </motion.div>
        </div>
    );
}

// ─── Floating card with swing animation ───────────────────────────────────────
function FloatCard({ src, name, fans, style = {}, delay = 0 }) {
    return (
        <motion.div className="absolute rounded-2xl overflow-hidden shadow-2xl border border-white/10 backdrop-blur-sm"
            style={style}
            animate={{ y: [0, -14, 0], rotate: ['-1.5deg', '1.5deg', '-1.5deg'] }}
            transition={{ duration: 6 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
            whileHover={{ scale: 1.05, zIndex: 10 }}>
            <img src={src} alt={name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
                <p className="text-white text-xs font-semibold">{name}</p>
                <p className="text-white/50 text-[10px]">{fans} fans</p>
            </div>
        </motion.div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
    const { isAuthenticated, isCreator, user, creatorApplicationStatus } = useAuth();
    const navigate = useNavigate();
    const [onboardingOpen, setOnboardingOpen] = useState(false);
    const [hasSubscriptions, setHasSubscriptions] = useState(false);

    // Fetch subscription count once on mount (for authenticated normal/fan users)
    useEffect(() => {
        if (!isAuthenticated) return;
        import('../services/api').then(({ default: api }) => {
            api.get('/subscriptions/my')
                .then(({ data }) => setHasSubscriptions((data?.data?.length ?? 0) > 0))
                .catch(() => setHasSubscriptions(false));
        });
    }, [isAuthenticated]);

    // Determine user type for role-based home page
    // Only use server-side fields — localStorage 'fannex_fan_intent' is unreliable
    // (it gets set when anyone visits a creator profile, not only fan signups)
    const isFan = user?.signupSource === 'creator_profile' || !!user?.creatorReferred;
    const userType = isCreator ? 'creator' : isFan ? 'fan' : 'normal';
    const heroRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const heroBgY = useTransform(scrollYProgress, [0, 1], ['0%', '25%']);
    const heroOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

    // ── HOME PAGE 1: FAN (signed up via creator profile) ──────────────────────
    if (isAuthenticated && userType === 'fan') {
        return (
            <div className="bg-[#030208] text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
                <section className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden pt-14 sm:pt-16">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0"
                            style={{ background: 'radial-gradient(ellipse 120% 80% at 50% -10%, #1e0552 0%, #0a001a 50%, transparent 75%)' }} />
                        <motion.div className="absolute top-1/3 left-[20%] w-[500px] h-[500px] rounded-full"
                            style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.18), transparent 70%)', willChange: 'transform' }}
                            animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
                            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
                        <motion.div className="absolute top-1/4 right-[15%] w-[400px] h-[400px] rounded-full"
                            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)', willChange: 'transform' }}
                            animate={{ x: [0, -25, 0], y: [0, 25, 0] }}
                            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }} />
                    </div>
                    <div className="relative z-10 text-center max-w-4xl px-6">
                        <motion.div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full mb-10 border border-violet-500/20 text-xs font-medium tracking-widest uppercase"
                            style={{ background: 'rgba(139,92,246,0.08)', backdropFilter: 'blur(20px)', color: '#a78bfa' }}
                            initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                            Your favourite creators are here
                        </motion.div>
                        <motion.h1 className="font-black tracking-tight leading-[0.92] mb-8 text-white"
                            style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(3rem, 7vw, 6rem)' }}
                            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 1.1, delay: 0.15 }}>
                            Support creators you<br />
                            <em className="not-italic" style={{
                                background: 'linear-gradient(135deg, #e879f9 0%, #a855f7 40%, #ec4899 100%)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            }}>love</em>
                        </motion.h1>
                        <motion.p className="text-lg text-white/40 mb-12 max-w-lg mx-auto leading-relaxed" style={{ fontWeight: 300 }}
                            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3 }}>
                            Subscribe to your favourite creators, unlock exclusive content, and help them earn what they deserve.
                        </motion.p>
                        <motion.div className="flex flex-col sm:flex-row items-center justify-center gap-4"
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.45 }}>
                            <Link to="/explore"
                                className="group relative px-10 py-4 rounded-full font-semibold text-base text-white overflow-hidden transition-all duration-300 hover:scale-105"
                                style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', boxShadow: '0 0 50px rgba(124,58,237,0.5)' }}>
                                <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ background: 'linear-gradient(135deg, #8b5cf6, #c084fc)' }} />
                                <span className="relative z-10 flex items-center gap-2">
                                    Explore Creators
                                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </span>
                            </Link>
                            <Link to="/subscriptions"
                                className="px-10 py-4 rounded-full font-medium text-base border transition-all duration-300 hover:scale-[1.02] flex items-center gap-2"
                                style={{ backdropFilter: 'blur(20px)', background: 'rgba(139,92,246,0.08)', borderColor: 'rgba(139,92,246,0.3)', color: '#c4b5fd' }}>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                </svg>
                                My Subscriptions
                            </Link>
                        </motion.div>
                    </div>
                </section>
            </div>
        );
    }

    // ── HOME PAGE 2: CREATOR ──────────────────────────────────────────────────
    if (isAuthenticated && userType === 'creator') {
        return (
            <div className="bg-[#030208] text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
                <section className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden pt-14 sm:pt-16">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0"
                            style={{ background: 'radial-gradient(ellipse 120% 80% at 50% -10%, #052e1c 0%, #030f08 50%, transparent 75%)' }} />
                        <motion.div className="absolute top-1/3 left-[20%] w-[500px] h-[500px] rounded-full"
                            style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.15), transparent 70%)', willChange: 'transform' }}
                            animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
                            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
                        <motion.div className="absolute top-1/4 right-[15%] w-[400px] h-[400px] rounded-full"
                            style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.1), transparent 70%)', willChange: 'transform' }}
                            animate={{ x: [0, -25, 0], y: [0, 25, 0] }}
                            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }} />
                    </div>
                    <div className="relative z-10 text-center max-w-4xl px-6">
                        <motion.div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full mb-10 border border-emerald-500/20 text-xs font-medium tracking-widest uppercase"
                            style={{ background: 'rgba(16,185,129,0.08)', backdropFilter: 'blur(20px)', color: '#6ee7b7' }}
                            initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Welcome back, Creator
                        </motion.div>
                        <motion.h1 className="font-black tracking-tight leading-[0.92] mb-8 text-white"
                            style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(3rem, 7vw, 6rem)' }}
                            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 1.1, delay: 0.15 }}>
                            Keep creating,<br />
                            <em className="not-italic" style={{
                                background: 'linear-gradient(135deg, #34d399 0%, #10b981 40%, #6ee7b7 100%)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            }}>keep earning</em>
                        </motion.h1>
                        <motion.p className="text-lg text-white/40 mb-12 max-w-lg mx-auto leading-relaxed" style={{ fontWeight: 300 }}
                            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3 }}>
                            Manage your content, grow your audience, and turn your passion into sustainable income — all in one place.
                        </motion.p>
                        <motion.div className="flex flex-col sm:flex-row items-center justify-center gap-4"
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.45 }}>
                            <Link to="/explore"
                                className="group relative px-10 py-4 rounded-full font-semibold text-base text-white overflow-hidden transition-all duration-300 hover:scale-105"
                                style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 0 50px rgba(16,185,129,0.4)' }}>
                                <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ background: 'linear-gradient(135deg, #34d399, #6ee7b7)' }} />
                                <span className="relative z-10 flex items-center gap-2">
                                    Explore Creators
                                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </span>
                            </Link>
                            <Link to="/dashboard"
                                className="px-10 py-4 rounded-full font-medium text-base border transition-all duration-300 hover:scale-[1.02] flex items-center gap-2"
                                style={{ backdropFilter: 'blur(20px)', background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                Dashboard
                            </Link>
                        </motion.div>
                    </div>
                </section>
            </div>
        );
    }

    // ── HOME PAGE 3: NORMAL USER (default signup) ─────────────────────────────
    if (isAuthenticated && userType === 'normal') {
        return (
            <div className="bg-[#030208] text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
                <section className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden pt-14 sm:pt-16">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0"
                            style={{ background: 'radial-gradient(ellipse 120% 80% at 50% -10%, #4a0520 0%, #0f021a 50%, transparent 75%)' }} />
                        <motion.div className="absolute top-1/3 left-[20%] w-[500px] h-[500px] rounded-full"
                            style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.15), transparent 70%)', willChange: 'transform' }}
                            animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
                            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
                        <motion.div className="absolute top-1/4 right-[15%] w-[400px] h-[400px] rounded-full"
                            style={{ background: 'radial-gradient(circle, rgba(244,114,182,0.1), transparent 70%)', willChange: 'transform' }}
                            animate={{ x: [0, -25, 0], y: [0, 25, 0] }}
                            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }} />
                    </div>
                    <div className="relative z-10 text-center max-w-4xl px-6">

                        <motion.h1 className="font-black tracking-tight leading-[0.92] mb-8 text-white"
                            style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(3rem, 7vw, 6rem)' }}
                            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 1.1, delay: 0.15 }}>
                            Where creators<br />
                            <em className="not-italic" style={{
                                background: 'linear-gradient(135deg, #f472b6 0%, #ec4899 40%, #db2777 100%)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            }}>become icons</em>
                        </motion.h1>
                        <motion.div className="flex justify-center mb-12"
                            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3 }}>
                            <span className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-pink-500/20 text-xs font-medium tracking-widest uppercase"
                                style={{ background: 'rgba(236,72,153,0.08)', backdropFilter: 'blur(20px)', color: '#f9a8d4' }}>
                                <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
                                Turn your passion into income
                            </span>
                        </motion.div>
                        <motion.div className="flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap"
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.45 }}>
                            {/* Explore Creators — always shown */}
                            <Link to="/explore"
                                className="group relative px-10 py-4 rounded-full font-semibold text-base text-white overflow-hidden transition-all duration-300 hover:scale-105"
                                style={{ background: 'linear-gradient(135deg, #be185d, #ec4899)', boxShadow: '0 0 50px rgba(236,72,153,0.45)' }}>
                                <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ background: 'linear-gradient(135deg, #ec4899, #f472b6)' }} />
                                <span className="relative z-10 flex items-center gap-2">
                                    Explore Creators
                                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </span>
                            </Link>

                            {/* Become a Creator — status-aware */}
                            {creatorApplicationStatus === 'pending' ? (
                                <div
                                    className="px-10 py-4 rounded-full font-medium text-base border flex items-center gap-2 cursor-not-allowed opacity-90"
                                    style={{ backdropFilter: 'blur(20px)', background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.35)', color: '#fcd34d' }}>
                                    <span className="w-3.5 h-3.5 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin flex-shrink-0" />
                                    Verification Pending
                                </div>
                            ) : creatorApplicationStatus === 'rejected' ? (
                                <button onClick={() => setOnboardingOpen(true)}
                                    className="px-10 py-4 rounded-full font-medium text-base border transition-all duration-300 hover:scale-[1.02] flex items-center gap-2"
                                    style={{ backdropFilter: 'blur(20px)', background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5' }}>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Reapply as Creator
                                </button>
                            ) : (
                                <button onClick={() => setOnboardingOpen(true)}
                                    className="px-10 py-4 rounded-full font-medium text-base border transition-all duration-300 hover:scale-[1.02] flex items-center gap-2"
                                    style={{ backdropFilter: 'blur(20px)', background: 'rgba(236,72,153,0.08)', borderColor: 'rgba(236,72,153,0.3)', color: '#f9a8d4' }}>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                    Become a Creator
                                </button>
                            )}

                            {/* My Subscriptions — only shown if user has active subscriptions */}
                            {hasSubscriptions && (
                                <Link to="/subscriptions"
                                    className="px-10 py-4 rounded-full font-medium text-base text-white/60 border border-white/10 hover:border-white/25 hover:text-white transition-all duration-300 hover:scale-[1.02] flex items-center gap-2"
                                    style={{ backdropFilter: 'blur(20px)', background: 'rgba(255,255,255,0.04)' }}>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                    </svg>
                                    My Subscriptions
                                </Link>
                            )}
                        </motion.div>
                    </div>
                </section>
                <CreatorOnboardingModal isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
            </div>
        );
    }

    return (
        <div className="bg-[#030208] text-white overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

            {/* ── CINEMATIC HERO ───────────────────────────────────────────────── */}
            <section ref={heroRef} className="relative min-h-[85vh] sm:min-h-screen flex flex-col items-center justify-center overflow-hidden">

                {/* Animated background canvas */}
                <motion.div className="absolute inset-0 pointer-events-none" style={{ y: heroBgY, willChange: 'transform' }}>
                    {/* Deep purple radial */}
                    <div className="absolute inset-0"
                        style={{ background: 'radial-gradient(ellipse 120% 80% at 50% -10%, #3b0764 0%, #0a001a 50%, transparent 75%)' }} />
                    {/* Floating orbs */}
                    <motion.div className="absolute top-1/3 left-[15%] w-[500px] h-[500px] rounded-full"
                        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.18), transparent 70%)', willChange: 'transform' }}
                        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
                        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
                    <motion.div className="absolute top-1/4 right-[10%] w-[400px] h-[400px] rounded-full"
                        style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.14), transparent 70%)', willChange: 'transform' }}
                        animate={{ x: [0, -25, 0], y: [0, 25, 0] }}
                        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }} />
                    <motion.div className="absolute bottom-1/4 left-1/3 w-[350px] h-[350px] rounded-full"
                        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.12), transparent 70%)', willChange: 'transform' }}
                        animate={{ x: [0, 20, 0], y: [0, 30, 0] }}
                        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut', delay: 4 }} />
                    {/* Noise grain texture */}
                    <div className="absolute inset-0 opacity-[0.04]"
                        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")", backgroundSize: '200px' }} />
                </motion.div>



                {/* Hero copy */}
                <motion.div className="relative z-10 text-center max-w-5xl px-4 sm:px-6 w-full" style={{ opacity: heroOpacity }}>

                    <motion.div className="inline-flex items-center gap-2.5 px-4 sm:px-5 py-2 rounded-full mb-6 sm:mb-10 border border-white/10 text-xs font-medium tracking-widest uppercase text-white/50"
                        style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)' }}
                        initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, ease: [0.25, 0.4, 0.25, 1] }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                        The creator subscription platform
                    </motion.div>

                    <motion.h1
                        className="font-black tracking-tight leading-[0.88] mb-6 sm:mb-8 text-white"
                        style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2.8rem, 9vw, 8rem)' }}
                        initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1.1, delay: 0.15, ease: [0.25, 0.4, 0.25, 1] }}>
                        Where creators<br />
                        <em className="not-italic" style={{
                            background: 'linear-gradient(135deg, #e879f9 0%, #a855f7 40%, #ec4899 100%)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        }}>become icons</em>
                    </motion.h1>

                    <motion.p className="text-base sm:text-xl text-white/40 mb-8 sm:mb-14 max-w-lg mx-auto leading-relaxed px-2"
                        style={{ fontWeight: 300 }}
                        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.3 }}>
                        Subscribe to your favourite creators, unlock exclusive content, and help them earn what they deserve.
                    </motion.p>

                    <motion.div className="flex flex-col sm:flex-row items-center justify-center gap-4"
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.45 }}>
                        {/* PRIMARY: Explore Creators */}
                        <Link to="/explore"
                            className="group relative px-10 py-4 rounded-full font-semibold text-base text-white overflow-hidden transition-all duration-300 hover:scale-105"
                            style={{ background: 'linear-gradient(135deg, #9333ea, #ec4899)', boxShadow: '0 0 50px rgba(147,51,234,0.5), 0 0 100px rgba(147,51,234,0.2)' }}>
                            <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ background: 'linear-gradient(135deg, #a855f7, #f472b6)' }} />
                            <span className="relative z-10 flex items-center gap-2">
                                Explore Creators
                                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </span>
                        </Link>
                        {/* SECONDARY: Become a Creator */}
                        <Link to="/register"
                            className="px-10 py-4 rounded-full font-medium text-base text-white/60 border border-white/10 hover:border-white/25 hover:text-white transition-all duration-300 hover:scale-[1.02] flex items-center gap-2"
                            style={{ backdropFilter: 'blur(20px)', background: 'rgba(255,255,255,0.04)' }}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Become a Creator
                        </Link>
                    </motion.div>

                    {/* Trust pill */}
                    <motion.div className="mt-6 sm:mt-10 flex items-center justify-center gap-3"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.7 }}>
                        <div className="flex -space-x-2">
                            {CREATORS.slice(0, 4).map((c, i) => (
                                <img key={i} src={c.img} alt={c.name}
                                    className="w-7 h-7 rounded-full border-2 border-[#030208] object-cover" />
                            ))}
                        </div>
                        <p className="text-sm text-white/40">
                            Join <span className="text-white/70 font-semibold">50,000+</span> creators already earning
                        </p>
                    </motion.div>
                </motion.div>

                {/* Scroll nudge */}
                <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/20"
                    animate={{ y: [0, 8, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}>
                    <div className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center p-1">
                        <motion.div className="w-1 h-2 bg-white/40 rounded-full"
                            animate={{ y: [0, 10, 0] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }} />
                    </div>
                </motion.div>
            </section>

            {/* ── STATS (hidden) ───────────────────────────────────────────── */}
            {false && (<section className="py-14 border-y border-white/5 relative overflow-hidden">
                <div className="absolute inset-0"
                    style={{ background: 'radial-gradient(ellipse 60% 100% at 50% 50%, rgba(147,51,234,0.07) 0%, transparent 70%)' }} />
                <div className="max-w-5xl mx-auto px-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
                        {[
                            { val: 50, suffix: 'K+', label: 'Creators' },
                            { val: 2, suffix: 'M+', label: 'Subscribers' },
                            { val: 10, suffix: 'Cr+', label: 'Rupees Paid Out', prefix: '₹' },
                            { val: 98, suffix: '%', label: 'Creator Satisfaction' },
                        ].map(({ val, suffix, label, prefix = '' }) => (
                            <Reveal key={label}>
                                <p className="text-4xl sm:text-5xl font-black mb-2"
                                    style={{ background: 'linear-gradient(135deg, #e879f9, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                    {prefix}<CountUp end={val} suffix={suffix} />
                                </p>
                                <p className="text-sm text-white/40 uppercase tracking-widest">{label}</p>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>)}

            {/* ── CREATOR TICKER + IMAGE SHOWCASE ────────────────────────────── */}
            {SHOW_IMAGE_GALLERIES && (<section className="py-12 overflow-hidden">
                <Reveal className="text-center mb-10 px-6">
                    <div className="inline-flex flex-col items-center gap-3">
                        {/* Top rule */}
                        <div className="flex items-center gap-4 w-full">
                            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.4))' }} />
                            <span className="text-[10px] font-bold uppercase tracking-[0.4em] px-4 py-1.5 rounded-full"
                                style={{
                                    color: 'rgba(255,255,255,0.35)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    background: 'rgba(255,255,255,0.03)',
                                    letterSpacing: '0.35em',
                                }}>
                                Featured Creators
                            </span>
                            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(168,85,247,0.4), transparent)' }} />
                        </div>
                        <p className="text-white/20 text-[11px] uppercase tracking-[0.25em] font-medium">
                            Handpicked. Verified. Extraordinary.
                        </p>
                    </div>
                </Reveal>


                {/* ── LUXURIOUS IMAGE SHOWCASE ──────────────────────────────── */}
                <div className="max-w-7xl mx-auto px-6 mt-16">
                    {/* Top row — 4 images */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        {CREATOR_IMAGES.slice(0, 4).map((img, i) => (
                            <Reveal key={i} delay={i * 0.1}>
                                <motion.div
                                    className="relative rounded-2xl overflow-hidden cursor-pointer group"
                                    style={{
                                        height: i % 2 === 0 ? 340 : 280,
                                        boxShadow: `0 0 0 1px rgba(255,255,255,0.06)`,
                                    }}
                                    whileHover={{ y: -8, scale: 1.02 }}
                                    transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
                                >
                                    <img
                                        src={img.src}
                                        alt={img.name}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                    {/* Gradient overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-500" />
                                    {/* Colored glow on hover */}
                                    <div
                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                        style={{
                                            background: `radial-gradient(circle at 50% 80%, ${img.color}25, transparent 60%)`,
                                            boxShadow: `inset 0 0 0 1.5px ${img.color}60`,
                                            borderRadius: '1rem',
                                        }}
                                    />
                                    {/* Creator info */}
                                    <div className="absolute bottom-0 left-0 right-0 p-5 translate-y-2 group-hover:translate-y-0 transition-transform duration-400">
                                        <p className="text-white font-bold text-sm tracking-wide">{img.name}</p>
                                        <p className="text-xs font-medium mt-0.5" style={{ color: img.color }}>{img.title}</p>
                                    </div>
                                    {/* Top-right badge */}
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                                        <span
                                            className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full"
                                            style={{
                                                background: 'rgba(0,0,0,0.6)',
                                                backdropFilter: 'blur(12px)',
                                                color: img.color,
                                                border: `1px solid ${img.color}40`,
                                            }}
                                        >
                                            Creator
                                        </span>
                                    </div>
                                </motion.div>
                            </Reveal>
                        ))}
                    </div>

                    {/* Bottom row — 3 images, wider */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {CREATOR_IMAGES.slice(4, 7).map((img, i) => (
                            <Reveal key={i + 4} delay={0.4 + i * 0.12}>
                                <motion.div
                                    className="relative rounded-2xl overflow-hidden cursor-pointer group"
                                    style={{
                                        height: i === 1 ? 360 : 300,
                                        boxShadow: `0 0 0 1px rgba(255,255,255,0.06)`,
                                    }}
                                    whileHover={{ y: -8, scale: 1.02 }}
                                    transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
                                >
                                    <img
                                        src={img.src}
                                        alt={img.name}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                    {/* Gradient overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-90 transition-opacity duration-500" />
                                    {/* Colored glow on hover */}
                                    <div
                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                        style={{
                                            background: `radial-gradient(circle at 50% 80%, ${img.color}25, transparent 60%)`,
                                            boxShadow: `inset 0 0 0 1.5px ${img.color}60`,
                                            borderRadius: '1rem',
                                        }}
                                    />
                                    {/* Creator info */}
                                    <div className="absolute bottom-0 left-0 right-0 p-5 translate-y-2 group-hover:translate-y-0 transition-transform duration-400">
                                        <p className="text-white font-bold text-base tracking-wide">{img.name}</p>
                                        <p className="text-xs font-medium mt-0.5" style={{ color: img.color }}>{img.title}</p>
                                    </div>
                                    {/* Top-right badge */}
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                                        <span
                                            className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full"
                                            style={{
                                                background: 'rgba(0,0,0,0.6)',
                                                backdropFilter: 'blur(12px)',
                                                color: img.color,
                                                border: `1px solid ${img.color}40`,
                                            }}
                                        >
                                            Creator
                                        </span>
                                    </div>
                                </motion.div>
                            </Reveal>
                        ))}
                    </div>

                    {/* Ambient glow behind the gallery */}
                    <div
                        className="absolute left-1/2 -translate-x-1/2 w-[80%] h-[400px] pointer-events-none -z-10"
                        style={{
                            bottom: '-100px',
                            background: 'radial-gradient(ellipse 80% 100% at 50% 100%, rgba(147,51,234,0.08) 0%, transparent 70%)',
                        }}
                    />
                </div>
            </section>)}

            {/* ── SPOTLIGHT GALLERY (Images 2) ──────────────────────────────────── */}
            {false && (<section className="py-20 relative overflow-hidden" style={{ background: '#050210' }}>
                {/* Section heading */}
                <Reveal className="text-center mb-16 px-6">
                    <p className="text-brand-400 text-xs uppercase tracking-widest font-semibold mb-4">Our creators</p>
                    <h2 className="font-black text-white leading-tight"
                        style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2.5rem, 5vw, 4.5rem)' }}>
                        Find your next<br />
                        <span style={{ background: 'linear-gradient(135deg, #e879f9, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>obsession</span>
                    </h2>
                </Reveal>

                {/* Ambient background glows */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(192,132,252,0.08), transparent 70%)' }} />
                    <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(251,113,133,0.06), transparent 70%)' }} />
                </div>

                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    {/* Hero-style feature image — first image large */}
                    <Reveal>
                        <motion.div
                            className="relative rounded-3xl overflow-hidden cursor-pointer group mb-6"
                            style={{ height: 520, boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 30px 80px -20px rgba(0,0,0,0.7)' }}
                            whileHover={{ y: -6 }}
                            transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
                        >
                            <img src={SPOTLIGHT_IMAGES[0].src} alt={SPOTLIGHT_IMAGES[0].name}
                                className="w-full h-full object-cover transition-transform duration-[1.2s] group-hover:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-70" />
                            <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
                            {/* Reveal content */}
                            <div className="absolute bottom-0 left-0 right-0 p-10 md:p-14">
                                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                                    <span className="text-[10px] font-bold uppercase tracking-[0.25em] px-4 py-1.5 rounded-full mb-4 inline-block"
                                        style={{ background: `${SPOTLIGHT_IMAGES[0].color}20`, color: SPOTLIGHT_IMAGES[0].color, border: `1px solid ${SPOTLIGHT_IMAGES[0].color}40` }}>
                                        Featured Creator
                                    </span>
                                    <h3 className="text-white font-black text-3xl md:text-5xl mt-3" style={{ fontFamily: "'Playfair Display', serif" }}>
                                        {SPOTLIGHT_IMAGES[0].name}
                                    </h3>
                                    <p className="text-white/50 text-lg mt-2 font-light">{SPOTLIGHT_IMAGES[0].title}</p>
                                </motion.div>
                            </div>
                            {/* Corner accent */}
                            <div className="absolute top-0 right-0 w-40 h-40 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                                style={{ background: `radial-gradient(circle at 100% 0%, ${SPOTLIGHT_IMAGES[0].color}15, transparent 70%)` }} />
                        </motion.div>
                    </Reveal>

                    {/* Grid of 4 smaller images */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {SPOTLIGHT_IMAGES.slice(1, 5).map((img, i) => (
                            <Reveal key={i} delay={0.1 + i * 0.08}>
                                <motion.div
                                    className="relative rounded-2xl overflow-hidden cursor-pointer group"
                                    style={{
                                        height: i % 2 === 0 ? 380 : 320,
                                        boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 20px 60px -15px rgba(0,0,0,0.6)',
                                    }}
                                    whileHover={{ y: -10, scale: 1.02 }}
                                    transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
                                >
                                    <img src={img.src} alt={img.name}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                                    {/* Colored glow on hover */}
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                        style={{
                                            background: `linear-gradient(180deg, transparent 40%, ${img.color}18 100%)`,
                                            boxShadow: `inset 0 0 0 1.5px ${img.color}50`,
                                            borderRadius: '1rem',
                                        }} />
                                    {/* Creator info */}
                                    <div className="absolute bottom-0 left-0 right-0 p-5">
                                        <p className="text-white font-bold text-sm tracking-wide">{img.name}</p>
                                        <p className="text-xs font-medium mt-0.5" style={{ color: img.color }}>{img.title}</p>
                                    </div>
                                    {/* Hover shine effect */}
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                                        style={{ background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.03) 50%, transparent 70%)' }} />
                                </motion.div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>)}

            {/* ── EARNINGS TRANSPARENCY SECTION ─────────────────────────────────── */}
            <section className="py-20 sm:py-32 relative overflow-hidden" style={{ background: '#040110' }}>
                {/* Background layers */}
                <div className="absolute inset-0 pointer-events-none">
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(124,58,237,0.14) 0%, transparent 65%)',
                    }} />
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'radial-gradient(ellipse 50% 50% at 80% 80%, rgba(16,185,129,0.06) 0%, transparent 60%)',
                    }} />
                    {/* Dot grid */}
                    <div className="absolute inset-0 opacity-[0.02]"
                        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '36px 36px' }} />
                </div>

                <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">

                    {/* ── Section heading ── */}
                    <Reveal className="text-center mb-14 sm:mb-20">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6"
                            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Transparent Earnings
                        </span>
                        <h2 className="font-black text-white leading-tight"
                            style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2.2rem, 5vw, 4.5rem)' }}>
                            You earn more.{' '}
                            <em className="not-italic" style={{
                                background: 'linear-gradient(135deg, #34d399 0%, #10b981 50%, #6ee7b7 100%)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            }}>Period.</em>
                        </h2>
                        <p className="mt-5 text-white/40 text-base sm:text-lg max-w-xl mx-auto leading-relaxed" style={{ fontWeight: 300 }}>
                            We keep it simple and honest — the lowest platform cut in the industry, paid out every single week.
                        </p>
                    </Reveal>

                    {/* ── Main split card ── */}
                    <Reveal delay={0.1}>
                        <div className="relative rounded-3xl overflow-hidden mb-6"
                            style={{
                                background: 'linear-gradient(135deg, rgba(10,3,30,0.95) 0%, rgba(5,1,15,0.98) 100%)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                backdropFilter: 'blur(24px)',
                                boxShadow: '0 40px 120px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
                            }}>

                            {/* Top shimmer line */}
                            <div className="absolute top-0 left-1/4 right-1/4 h-px"
                                style={{ background: 'linear-gradient(90deg, transparent, rgba(52,211,153,0.6), transparent)' }} />

                            {/* Mobile: stacked | Desktop: side-by-side */}
                            <div className="flex flex-col lg:flex-row">

                                {/* LEFT: 80% Creator slice */}
                                <div className="relative flex-1 p-8 sm:p-10 lg:p-14 flex flex-col items-center lg:items-start text-center lg:text-left"
                                    style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                    {/* Glow */}
                                    <div className="absolute inset-0 pointer-events-none"
                                        style={{ background: 'radial-gradient(circle at 30% 40%, rgba(16,185,129,0.08), transparent 60%)' }} />

                                    {/* 80% badge */}
                                    <motion.div
                                        className="relative z-10 mb-5 sm:mb-6"
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        whileInView={{ scale: 1, opacity: 1 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.7, ease: [0.25, 0.4, 0.25, 1] }}>
                                        <span className="text-[5rem] sm:text-[7rem] lg:text-[8rem] font-black leading-none block"
                                            style={{
                                                background: 'linear-gradient(135deg, #34d399 0%, #10b981 60%, #6ee7b7 100%)',
                                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                                fontFamily: "'Inter', sans-serif",
                                                letterSpacing: '-0.04em',
                                                filter: 'drop-shadow(0 0 40px rgba(16,185,129,0.35))',
                                            }}>80%</span>
                                    </motion.div>

                                    <h3 className="relative z-10 text-white font-bold text-xl sm:text-2xl mb-3"
                                        style={{ fontFamily: "'Playfair Display', serif" }}>
                                        Goes to you, the creator
                                    </h3>
                                    <p className="relative z-10 text-white/45 text-sm sm:text-base leading-relaxed max-w-sm">
                                        Every subscription, every gift, every paid message — you keep 80% of everything your fans spend on you.
                                    </p>

                                    {/* Revenue bar */}
                                    <div className="relative z-10 mt-8 w-full max-w-sm">
                                        <div className="flex justify-between text-xs text-white/30 mb-2 font-medium">
                                            <span>Your share</span>
                                            <span>100%</span>
                                        </div>
                                        <div className="h-3 rounded-full overflow-hidden"
                                            style={{ background: 'rgba(255,255,255,0.06)' }}>
                                            <motion.div className="h-full rounded-full"
                                                style={{ background: 'linear-gradient(90deg, #10b981, #34d399, #6ee7b7)' }}
                                                initial={{ width: 0 }}
                                                whileInView={{ width: '80%' }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 1.2, delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }} />
                                        </div>
                                    </div>
                                </div>

                                {/* Divider label — shows on lg between the two halves */}
                                <div className="hidden lg:flex flex-col items-center justify-center w-20 flex-shrink-0 relative">
                                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px"
                                        style={{ background: 'rgba(255,255,255,0.05)' }} />
                                    <div className="relative z-10 w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold text-white/30"
                                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                        vs
                                    </div>
                                </div>

                                {/* RIGHT: 20% Platform slice */}
                                <div className="relative flex-1 p-8 sm:p-10 lg:p-14 flex flex-col items-center lg:items-start text-center lg:text-left border-t border-white/5 lg:border-t-0">
                                    {/* Glow */}
                                    <div className="absolute inset-0 pointer-events-none"
                                        style={{ background: 'radial-gradient(circle at 70% 40%, rgba(124,58,237,0.06), transparent 60%)' }} />

                                    {/* 20% badge */}
                                    <motion.div
                                        className="relative z-10 mb-5 sm:mb-6"
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        whileInView={{ scale: 1, opacity: 1 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.7, delay: 0.15, ease: [0.25, 0.4, 0.25, 1] }}>
                                        <span className="text-[5rem] sm:text-[7rem] lg:text-[8rem] font-black leading-none block"
                                            style={{
                                                background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.15) 100%)',
                                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                                fontFamily: "'Inter', sans-serif",
                                                letterSpacing: '-0.04em',
                                            }}>20%</span>
                                    </motion.div>

                                    <h3 className="relative z-10 text-white/60 font-bold text-xl sm:text-2xl mb-3"
                                        style={{ fontFamily: "'Playfair Display', serif" }}>
                                        Platform fee — that&apos;s it
                                    </h3>
                                    <p className="relative z-10 text-white/30 text-sm sm:text-base leading-relaxed max-w-sm">
                                        One flat fee. No payment gateway surcharge, no withdrawal fees, no surprises. Ever.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Reveal>

                    {/* ── Bottom 3-card row ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">

                        {/* Card 1: Weekly Payouts */}
                        <Reveal>
                            <motion.div
                                className="relative p-6 sm:p-8 rounded-2xl overflow-hidden group cursor-default h-full flex flex-col"
                                style={{
                                    background: 'rgba(255,255,255,0.025)',
                                    border: '1px solid rgba(255,255,255,0.07)',
                                    backdropFilter: 'blur(20px)',
                                }}
                                whileHover={{ y: -4, borderColor: 'rgba(52,211,153,0.35)' }}
                                transition={{ duration: 0.3 }}>
                                {/* Hover glow */}
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                    style={{ background: 'radial-gradient(circle at 30% 0%, rgba(16,185,129,0.1), transparent 60%)' }} />
                                {/* Top accent line */}
                                <div className="absolute top-0 left-8 right-8 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                    style={{ background: 'linear-gradient(90deg, transparent, rgba(52,211,153,0.7), transparent)' }} />

                                <div className="relative z-10 flex flex-col h-full">
                                    {/* Icon */}
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 flex-shrink-0"
                                        style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                            <line x1="16" y1="2" x2="16" y2="6" />
                                            <line x1="8" y1="2" x2="8" y2="6" />
                                            <line x1="3" y1="10" x2="21" y2="10" />
                                        </svg>
                                    </div>

                                    {/* Weekly badge */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <h3 className="text-white font-bold text-lg">Weekly Payouts</h3>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
                                            style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>
                                            Every 7 days
                                        </span>
                                    </div>
                                    <p className="text-white/40 text-sm leading-relaxed flex-1">
                                        Your earnings are processed and transferred to your bank account every week — no waiting, no delays.
                                    </p>

                                    {/* Calendar visual */}
                                    <div className="mt-6 grid grid-cols-7 gap-1">
                                        {['M','T','W','T','F','S','S'].map((d, i) => (
                                            <div key={i} className="flex flex-col items-center gap-1">
                                                <span className="text-[9px] text-white/20 font-medium">{d}</span>
                                                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold"
                                                    style={{
                                                        background: i === 6 ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.04)',
                                                        color: i === 6 ? '#34d399' : 'rgba(255,255,255,0.2)',
                                                        border: i === 6 ? '1px solid rgba(52,211,153,0.4)' : '1px solid rgba(255,255,255,0.05)',
                                                    }}>
                                                    {i === 6 ? '₹' : ''}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        </Reveal>

                        {/* Card 2: No Hidden Fees */}
                        <Reveal delay={0.1}>
                            <motion.div
                                className="relative p-6 sm:p-8 rounded-2xl overflow-hidden group cursor-default h-full flex flex-col"
                                style={{
                                    background: 'rgba(255,255,255,0.025)',
                                    border: '1px solid rgba(255,255,255,0.07)',
                                    backdropFilter: 'blur(20px)',
                                }}
                                whileHover={{ y: -4, borderColor: 'rgba(168,85,247,0.35)' }}
                                transition={{ duration: 0.3 }}>
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                    style={{ background: 'radial-gradient(circle at 30% 0%, rgba(168,85,247,0.1), transparent 60%)' }} />
                                <div className="absolute top-0 left-8 right-8 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                    style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.7), transparent)' }} />

                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 flex-shrink-0"
                                        style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)', color: '#a855f7' }}>
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                            <polyline points="9 12 11 14 15 10" />
                                        </svg>
                                    </div>
                                    <h3 className="text-white font-bold text-lg mb-3">Zero Hidden Fees</h3>
                                    <p className="text-white/40 text-sm leading-relaxed flex-1">
                                        No setup fees. No withdrawal charges. No monthly minimums. The 20% is all we ever take — nothing else.
                                    </p>

                                    {/* Fee breakdown */}
                                    <div className="mt-6 space-y-2">
                                        {[
                                            { label: 'Platform fee', val: '20%', positive: false },
                                            { label: 'Withdrawal fee', val: 'Free', positive: true },
                                            { label: 'Setup fee', val: '₹0', positive: true },
                                            { label: 'Monthly minimum', val: 'None', positive: true },
                                        ].map(({ label, val, positive }) => (
                                            <div key={label} className="flex items-center justify-between text-xs">
                                                <span className="text-white/40">{label}</span>
                                                <span className="font-semibold" style={{ color: positive ? '#34d399' : 'rgba(255,255,255,0.5)' }}>{val}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        </Reveal>

                        {/* Card 3: Earnings Calculator */}
                        <Reveal delay={0.15}>
                            <motion.div
                                className="relative p-6 sm:p-8 rounded-2xl overflow-hidden group cursor-default h-full flex flex-col"
                                style={{
                                    background: 'rgba(255,255,255,0.025)',
                                    border: '1px solid rgba(255,255,255,0.07)',
                                    backdropFilter: 'blur(20px)',
                                }}
                                whileHover={{ y: -4, borderColor: 'rgba(251,191,36,0.35)' }}
                                transition={{ duration: 0.3 }}>
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                    style={{ background: 'radial-gradient(circle at 30% 0%, rgba(251,191,36,0.08), transparent 60%)' }} />
                                <div className="absolute top-0 left-8 right-8 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                    style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)' }} />

                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 flex-shrink-0"
                                        style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="1" x2="12" y2="23" />
                                            <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                                        </svg>
                                    </div>
                                    <h3 className="text-white font-bold text-lg mb-3">See Your Earnings</h3>
                                    <p className="text-white/40 text-sm leading-relaxed mb-6">
                                        With just 100 subscribers at ₹199/mo, here&apos;s what you&apos;d make:
                                    </p>

                                    {/* Earnings example */}
                                    <div className="space-y-3 flex-1">
                                        {[
                                            { fans: '100 fans', gross: '₹19,900/mo', net: '₹15,920', color: '#fbbf24' },
                                            { fans: '500 fans', gross: '₹99,500/mo', net: '₹79,600', color: '#f59e0b' },
                                            { fans: '1,000 fans', gross: '₹1,99,000/mo', net: '₹1,59,200', color: '#d97706' },
                                        ].map(({ fans, gross, net, color }) => (
                                            <div key={fans} className="p-3 rounded-xl flex items-center justify-between"
                                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div>
                                                    <p className="text-white/60 text-xs">{fans} @ ₹199</p>
                                                    <p className="text-white/30 text-[10px]">Gross: {gross}</p>
                                                </div>
                                                <span className="font-bold text-sm" style={{ color }}>{net}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-white/20 text-[10px] mt-3 text-center">After 20% platform fee</p>
                                </div>
                            </motion.div>
                        </Reveal>
                    </div>

                    {/* ── Competitor comparison bar ── */}
                    <Reveal delay={0.2}>
                        <div className="relative rounded-2xl overflow-hidden p-6 sm:p-8 mt-4"
                            style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                backdropFilter: 'blur(20px)',
                            }}>
                            <p className="text-center text-white/30 text-xs uppercase tracking-widest font-semibold mb-8">How we compare</p>
                            <div className="space-y-5 max-w-2xl mx-auto">
                                {[
                                    { name: 'Fannex', cut: 20, color: '#10b981', highlight: true },
                                    { name: 'OnlyFans', cut: 20, color: 'rgba(255,255,255,0.2)', highlight: false },
                                    { name: 'Patreon', cut: 33, color: 'rgba(255,255,255,0.12)', highlight: false },

                                ].map(({ name, cut, color, highlight, note }) => (
                                    <div key={name} className="flex items-center gap-4">
                                        <div className="w-24 sm:w-28 flex-shrink-0">
                                            <span className="text-sm font-semibold" style={{ color: highlight ? '#34d399' : 'rgba(255,255,255,0.4)' }}>
                                                {name}
                                                {highlight && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                                                    style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>us</span>}
                                            </span>
                                        </div>
                                        <div className="flex-1 h-2.5 rounded-full overflow-hidden"
                                            style={{ background: 'rgba(255,255,255,0.05)' }}>
                                            <motion.div className="h-full rounded-full"
                                                style={{ background: color }}
                                                initial={{ width: 0 }}
                                                whileInView={{ width: `${cut * 2.5}%` }}
                                                viewport={{ once: true }}
                                                transition={{ duration: 1, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }} />
                                        </div>
                                        <div className="w-20 text-right flex-shrink-0">
                                            <span className="text-sm font-bold" style={{ color: highlight ? '#34d399' : 'rgba(255,255,255,0.35)' }}>
                                                {cut}% {note || ''}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="text-center text-white/18 text-xs mt-8">Platform fees shown. Lower is better for creators.</p>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ── FEATURE BENTO GRID ───────────────────────────────────────────── */}
            <section className="py-16 sm:py-24 relative overflow-hidden">
                {/* Ambient background */}
                <div className="absolute inset-0 pointer-events-none">
                    <div style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 110%, rgba(168,85,247,0.12) 0%, transparent 60%)', position: 'absolute', inset: 0 }} />
                    <div style={{ background: 'radial-gradient(ellipse 40% 40% at 20% 30%, rgba(236,72,153,0.06) 0%, transparent 70%)', position: 'absolute', inset: 0 }} />
                </div>

                <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
                    {/* Heading */}
                    <Reveal className="text-center mb-10 sm:mb-20">
                        <p className="text-xs uppercase tracking-[0.3em] font-semibold mb-4" style={{ color: '#a855f7' }}>What we offer</p>
                        <h2 className="font-black text-white leading-tight"
                            style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2rem, 5vw, 4rem)' }}>
                            Everything you need<br />to{' '}
                            <em className="not-italic" style={{ background: 'linear-gradient(135deg, #e879f9, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                thrive
                            </em>
                        </h2>
                        <p className="mt-4 sm:mt-6 text-white/40 text-sm sm:text-base max-w-xl mx-auto leading-relaxed" style={{ fontWeight: 300 }}>
                            Fanvew is built for creators who are serious about monetising their audience — with tools that actually work.
                        </p>
                    </Reveal>

                    {/* Hero feature card */}
                    <Reveal delay={0.05} className="mb-4">
                        {(() => { const f = FEATURES[0]; return (
                        <motion.div
                            className="relative rounded-3xl overflow-hidden border border-white/[0.06] cursor-pointer group"
                            style={{
                                background: `linear-gradient(135deg, rgba(${f.color === '#a855f7' ? '168,85,247' : '168,85,247'},0.1) 0%, rgba(10,0,30,0.95) 60%)`,
                                backdropFilter: 'blur(20px)',
                                padding: '0',
                            }}
                            whileHover={{ y: -5, borderColor: `${f.color}55` }}
                            transition={{ duration: 0.35 }}
                        >
                            {/* Glow on hover */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                                style={{ background: `radial-gradient(circle at 30% 50%, ${f.color}18, transparent 55%)` }} />
                            {/* Border glow line */}
                            <div className="absolute top-0 left-10 right-10 h-px opacity-50 group-hover:opacity-100 transition-opacity duration-500"
                                style={{ background: `linear-gradient(90deg, transparent, ${f.color}80, transparent)` }} />

                            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-8 p-6 sm:p-10 md:p-12">
                                {/* Icon */}
                                <div className="flex-shrink-0 w-14 h-14 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-400"
                                    style={{ background: `${f.color}18`, color: f.color, boxShadow: `0 0 40px ${f.color}20` }}>
                                    <f.Icon />
                                </div>
                                {/* Text */}
                                <div className="flex-1">
                                    <h3 className="text-white font-bold text-xl sm:text-2xl md:text-3xl mb-2 sm:mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
                                        {f.title}
                                    </h3>
                                    <p className="text-white/50 text-sm sm:text-base leading-relaxed max-w-xl">{f.desc}</p>
                                </div>
                                {/* Arrow — hidden on mobile, visible md+ */}
                                <div className="hidden sm:flex flex-shrink-0 w-12 h-12 rounded-full items-center justify-center border border-white/10 group-hover:border-purple-500/50 group-hover:bg-purple-500/10 transition-all duration-300 ml-auto">
                                    <svg className="w-5 h-5 text-white/30 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                    </svg>
                                </div>
                            </div>
                        </motion.div>
                        ); })()}
                    </Reveal>

                    {/* 2-col on mobile → 3-col on lg */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {FEATURES.slice(1).map((f, i) => (
                            <Reveal key={f.title} delay={0.1 + i * 0.07} className="h-full">
                                <motion.div
                                    className="h-full p-4 sm:p-7 rounded-2xl border border-white/[0.06] cursor-pointer group relative overflow-hidden flex flex-col"
                                    style={{ background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(20px)' }}
                                    whileHover={{ y: -6, borderColor: `${f.color}40` }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {/* Gradient glow on hover */}
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                        style={{ background: `radial-gradient(circle at 20% 0%, ${f.color}12, transparent 55%)` }} />
                                    {/* Top edge highlight */}
                                    <div className="absolute top-0 left-8 right-8 h-px opacity-0 group-hover:opacity-60 transition-opacity duration-500"
                                        style={{ background: `linear-gradient(90deg, transparent, ${f.color}90, transparent)` }} />

                                    <div className="relative z-10 flex flex-col h-full">
                                        {/* Icon */}
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-5 border border-white/8 group-hover:scale-110 transition-transform duration-300 flex-shrink-0"
                                            style={{ background: `${f.color}14`, color: f.color }}>
                                            <f.Icon />
                                        </div>
                                        {/* Title */}
                                        <h3 className="text-white font-bold text-[13px] sm:text-[15px] mb-1.5 sm:mb-2 leading-snug">{f.title}</h3>
                                        {/* Description */}
                                        <p className="text-white/40 text-xs sm:text-sm leading-relaxed flex-1 hidden sm:block">{f.desc}</p>
                                        {/* Bottom accent line */}
                                        <div className="mt-6 h-px w-0 group-hover:w-full transition-all duration-500 opacity-30"
                                            style={{ background: `linear-gradient(90deg, ${f.color}, transparent)` }} />
                                    </div>
                                </motion.div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
            <section className="py-16 relative overflow-hidden">
                <div className="max-w-5xl mx-auto px-6">
                    <Reveal className="text-center mb-14">
                        <h2 className="font-black text-white"
                            style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>
                            Creators who believe in us
                        </h2>
                    </Reveal>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {TESTIMONIALS.map((t, i) => (
                            <Reveal key={t.name} delay={i * 0.1}>
                                <div className="p-6 rounded-2xl border border-white/[0.06] relative overflow-hidden h-full"
                                    style={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(20px)' }}>
                                    <div className="text-brand-400 text-5xl leading-none mb-4 font-serif">&ldquo;</div>
                                    <p className="text-white/70 text-sm leading-relaxed mb-6">{t.text}</p>
                                    <div className="flex items-center gap-3 mt-auto">
                                        <img src={t.img} alt={t.name} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                                        <div>
                                            <p className="text-white text-sm font-semibold">{t.name}</p>
                                            <p className="text-white/40 text-xs">{t.handle}</p>
                                        </div>
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0"
                        style={{ background: 'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(124,58,237,0.22) 0%, transparent 70%)' }} />
                    <div className="absolute inset-0"
                        style={{ background: 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(236,72,153,0.1) 0%, transparent 60%)' }} />
                </div>
                <Reveal className="text-center max-w-3xl mx-auto px-6">
                    <p className="text-brand-400 text-xs uppercase tracking-widest font-semibold mb-5">Ready to start?</p>
                    <h2 className="font-black text-white leading-tight mb-6"
                        style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(3rem, 6vw, 5.5rem)' }}>
                        Turn your passion<br />into your{' '}
                        <em className="not-italic" style={{ background: 'linear-gradient(135deg, #e879f9, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            income
                        </em>
                    </h2>
                    <p className="text-xl text-white/35 mb-14 leading-relaxed" style={{ fontWeight: 300 }}>
                        Join 50,000+ creators building sustainable income from their content — right now.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
                        <Link to="/register"
                            className="group relative px-12 py-5 rounded-full text-lg font-bold text-white overflow-hidden transition-all duration-300 hover:scale-105"
                            style={{ background: 'linear-gradient(135deg, #9333ea, #ec4899)', boxShadow: '0 0 80px rgba(147,51,234,0.5)' }}>
                            <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ background: 'linear-gradient(135deg, #a855f7, #f472b6)' }} />
                            <span className="relative z-10">Create your account — free</span>
                        </Link>
                        <Link to="/login"
                            className="px-12 py-5 rounded-full text-lg font-bold text-white/50 border border-white/10 hover:border-white/25 hover:text-white transition-all duration-300"
                            style={{ backdropFilter: 'blur(20px)', background: 'rgba(255,255,255,0.03)' }}>
                            Sign in
                        </Link>
                    </div>
                    <div className="flex flex-wrap justify-center gap-6 text-white/25 text-xs tracking-wide">
                        <span>✓ No setup fee</span>
                        <span>✓ Instant payouts</span>
                        <span>✓ Keep 80%+ revenue</span>
                        <span>✓ Cancel anytime</span>
                    </div>
                </Reveal>
            </section>

        </div>
    );
}

