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
import img2_1 from '../assets/images 2/1.jpeg';
import img2_2 from '../assets/images 2/2.jpeg';
import img2_3 from '../assets/images 2/3.jpeg';
import img2_4 from '../assets/images 2/4.jpeg';
import img2_5 from '../assets/images 2/5.jpeg';

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

const FEATURES = [
    { icon: '💬', tag: 'New', title: 'AI Voice Messages', desc: 'Send personalised messages to every fan at scale, automatically.' },
    { icon: '🎙️', tag: 'New', title: 'AI Voice Notes', desc: 'Build deeper fan intimacy without spending hours in your inbox.' },
    { icon: '🔌', tag: 'Coming soon', title: 'Open API', desc: 'An open platform for innovation, built for ambitious creators.' },
    { icon: '⚡', tag: null, title: 'Instant Payouts', desc: 'Monetise your content. Get paid faster than ever before.' },
    { icon: '📊', tag: null, title: 'Real-time Analytics', desc: 'Know exactly who your fans are and what content they love.' },
    { icon: '🔒', tag: null, title: 'Exclusive Content', desc: 'Gate your best work behind subscriptions that pay you well.' },
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
    const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
    const heroOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

    // ── HOME PAGE 1: FAN (signed up via creator profile) ──────────────────────
    if (isAuthenticated && userType === 'fan') {
        return (
            <div className="bg-[#030208] text-white overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
                <section className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0"
                            style={{ background: 'radial-gradient(ellipse 120% 80% at 50% -10%, #1e0552 0%, #0a001a 50%, transparent 75%)' }} />
                        <motion.div className="absolute top-1/3 left-[20%] w-[500px] h-[500px] rounded-full"
                            style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.18), transparent 70%)' }}
                            animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
                            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
                        <motion.div className="absolute top-1/4 right-[15%] w-[400px] h-[400px] rounded-full"
                            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)' }}
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
            <div className="bg-[#030208] text-white overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
                <section className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0"
                            style={{ background: 'radial-gradient(ellipse 120% 80% at 50% -10%, #052e1c 0%, #030f08 50%, transparent 75%)' }} />
                        <motion.div className="absolute top-1/3 left-[20%] w-[500px] h-[500px] rounded-full"
                            style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.15), transparent 70%)' }}
                            animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
                            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
                        <motion.div className="absolute top-1/4 right-[15%] w-[400px] h-[400px] rounded-full"
                            style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.1), transparent 70%)' }}
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
            <div className="bg-[#030208] text-white overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
                <section className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0"
                            style={{ background: 'radial-gradient(ellipse 120% 80% at 50% -10%, #4a0520 0%, #0f021a 50%, transparent 75%)' }} />
                        <motion.div className="absolute top-1/3 left-[20%] w-[500px] h-[500px] rounded-full"
                            style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.15), transparent 70%)' }}
                            animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
                            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
                        <motion.div className="absolute top-1/4 right-[15%] w-[400px] h-[400px] rounded-full"
                            style={{ background: 'radial-gradient(circle, rgba(244,114,182,0.1), transparent 70%)' }}
                            animate={{ x: [0, -25, 0], y: [0, 25, 0] }}
                            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }} />
                    </div>
                    <div className="relative z-10 text-center max-w-4xl px-6">
                        <motion.div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full mb-10 border border-pink-500/20 text-xs font-medium tracking-widest uppercase"
                            style={{ background: 'rgba(236,72,153,0.08)', backdropFilter: 'blur(20px)', color: '#f9a8d4' }}
                            initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
                            <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
                            Turn your passion into income
                        </motion.div>
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
                        <motion.p className="text-lg text-white/40 mb-12 max-w-lg mx-auto leading-relaxed" style={{ fontWeight: 300 }}
                            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3 }}>
                            Join 50,000+ creators building a sustainable income from their content. Start your journey today — it&apos;s free.
                        </motion.p>
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
                <motion.div className="absolute inset-0 pointer-events-none" style={{ y: heroBgY, scale: heroScale }}>
                    {/* Deep purple radial */}
                    <div className="absolute inset-0"
                        style={{ background: 'radial-gradient(ellipse 120% 80% at 50% -10%, #3b0764 0%, #0a001a 50%, transparent 75%)' }} />
                    {/* Floating orbs */}
                    <motion.div className="absolute top-1/3 left-[15%] w-[500px] h-[500px] rounded-full"
                        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.18), transparent 70%)' }}
                        animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.15, 1] }}
                        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
                    <motion.div className="absolute top-1/4 right-[10%] w-[400px] h-[400px] rounded-full"
                        style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.14), transparent 70%)' }}
                        animate={{ x: [0, -25, 0], y: [0, 25, 0], scale: [1, 1.1, 1] }}
                        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }} />
                    <motion.div className="absolute bottom-1/4 left-1/3 w-[350px] h-[350px] rounded-full"
                        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.12), transparent 70%)' }}
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

            {/* ── STATS ────────────────────────────────────────────────────────── */}
            <section className="py-14 border-y border-white/5 relative overflow-hidden">
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
            </section>

            {/* ── CREATOR TICKER ───────────────────────────────────────────────── */}
            <section className="py-12 overflow-hidden">
                <Reveal className="text-center mb-10 px-6">
                    <p className="text-white/25 text-xs uppercase tracking-[0.3em]">Chosen by creators redefining what&apos;s possible</p>
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
            </section>

            {/* ── SPOTLIGHT GALLERY (Images 2) ──────────────────────────────────── */}
            <section className="py-20 relative overflow-hidden" style={{ background: '#050210' }}>
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
            </section>

            {/* ── CATEGORY SECTION ─────────────────────────────────────────────── */}
            <CategoryParallax />

            {/* ── FEATURE BENTO GRID ───────────────────────────────────────────── */}
            <section className="py-20 relative overflow-hidden">
                <div className="absolute inset-0"
                    style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 100%, rgba(168,85,247,0.1) 0%, transparent 60%)' }} />
                <div className="max-w-6xl mx-auto px-6">
                    <Reveal className="text-center mb-16">
                        <p className="text-brand-400 text-xs uppercase tracking-widest font-semibold mb-4">Platform features</p>
                        <h2 className="font-black text-white"
                            style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}>
                            Everything you need<br />to <em className="not-italic" style={{ background: 'linear-gradient(135deg, #e879f9, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>thrive</em>
                        </h2>
                    </Reveal>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {FEATURES.map((f, i) => (
                            <Reveal key={f.title} delay={i * 0.08} className="h-full">
                                <motion.div className="h-full p-7 rounded-2xl border border-white/[0.06] cursor-pointer group relative overflow-hidden"
                                    style={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(20px)' }}
                                    whileHover={{ y: -6, borderColor: 'rgba(168,85,247,0.35)' }}
                                    transition={{ duration: 0.3 }}>
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                        style={{ background: 'radial-gradient(circle at 50% 0%, rgba(168,85,247,0.1), transparent 60%)' }} />
                                    <div className="relative z-10">
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-5 border border-white/10"
                                            style={{ background: 'rgba(168,85,247,0.12)' }}>
                                            {f.icon}
                                        </div>
                                        {f.tag && (
                                            <span className="inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-3"
                                                style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }}>
                                                {f.tag}
                                            </span>
                                        )}
                                        <h3 className="text-white font-bold text-base mb-2">{f.title}</h3>
                                        <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
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

            {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
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

// ─── Category parallax section ────────────────────────────────────────────────
function CategoryParallax() {
    const NICHE_COLORS = [
        { gradient: 'linear-gradient(135deg, #a855f7, #ec4899)', glow: 'rgba(168,85,247,0.25)' },
        { gradient: 'linear-gradient(135deg, #f97316, #ef4444)', glow: 'rgba(249,115,22,0.25)' },
        { gradient: 'linear-gradient(135deg, #38bdf8, #818cf8)', glow: 'rgba(56,189,248,0.25)' },
        { gradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)', glow: 'rgba(251,191,36,0.25)' },
        { gradient: 'linear-gradient(135deg, #10b981, #34d399)', glow: 'rgba(16,185,129,0.25)' },
    ];

    return (
        <section className="relative py-12 sm:py-24 overflow-hidden" style={{ background: '#050208' }}>
            {/* Dot grid background */}
            <div className="absolute inset-0 opacity-[0.025]"
                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
            {/* Ambient glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(147,51,234,0.06), transparent 70%)' }} />

            <div className="max-w-5xl mx-auto px-4 sm:px-6">
                <div className="text-center mb-8 sm:mb-16">
                    <p className="text-brand-400 text-xs uppercase tracking-[0.3em] font-semibold mb-4">Every niche, every passion</p>
                    <h2 className="font-black text-white"
                        style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2rem, 5vw, 4.5rem)' }}>
                        Built for every{' '}
                        <em className="not-italic" style={{ background: 'linear-gradient(135deg, #e879f9, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            niche.
                        </em>
                    </h2>
                </div>

                <div className="space-y-0">
                    {CATEGORIES.map((cat, i) => (
                        <motion.div
                            key={cat.name}
                            className="group cursor-pointer relative py-4 sm:py-8 md:py-10 border-b border-white/[0.04] flex items-center justify-center"
                            whileHover={{ x: 8 }}
                            transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
                        >
                            {/* Background glow on hover */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                                style={{ background: `radial-gradient(ellipse 60% 100% at 50% 50%, ${NICHE_COLORS[i].glow}, transparent 80%)` }} />

                            {/* Number */}
                            <span className="absolute left-0 text-xs font-mono tracking-widest text-white/10 group-hover:text-white/30 transition-colors duration-500 hidden md:block"
                                style={{ top: '50%', transform: 'translateY(-50%)' }}>
                                0{i + 1}
                            </span>

                            {/* Category name */}
                            <h3 className="font-black text-center select-none transition-all duration-700 relative"
                                style={{
                                    fontFamily: "'Playfair Display', serif",
                                    fontSize: 'clamp(2.2rem, 8vw, 7rem)',
                                    color: 'rgba(255,255,255,0.1)',
                                    letterSpacing: '-0.02em',
                                }}
                                onMouseEnter={e => {
                                    e.target.style.background = NICHE_COLORS[i].gradient;
                                    e.target.style.WebkitBackgroundClip = 'text';
                                    e.target.style.WebkitTextFillColor = 'transparent';
                                    e.target.style.textShadow = 'none';
                                }}
                                onMouseLeave={e => {
                                    e.target.style.background = 'none';
                                    e.target.style.WebkitBackgroundClip = 'unset';
                                    e.target.style.WebkitTextFillColor = 'rgba(255,255,255,0.1)';
                                }}>
                                {cat.name}
                            </h3>

                            {/* Animated underline */}
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[1px] w-0 group-hover:w-[60%] transition-all duration-700 ease-out"
                                style={{ background: NICHE_COLORS[i].gradient }} />

                            {/* Arrow on hover — desktop only */}
                            <motion.div
                                className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-500 hidden md:flex items-center gap-2"
                                initial={{ x: -10 }}
                                whileHover={{ x: 0 }}
                            >
                                <span className="text-xs font-medium uppercase tracking-widest" style={{ background: NICHE_COLORS[i].gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Explore</span>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: NICHE_COLORS[i].glow.replace('0.25', '1') }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                </svg>
                            </motion.div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
