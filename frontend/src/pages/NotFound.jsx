import { Link } from 'react-router-dom';

export default function NotFound() {
    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
            <div className="text-8xl font-black gradient-text mb-4">404</div>
            <h2 className="text-2xl font-bold text-white mb-3">Page not found</h2>
            <p className="text-surface-400 mb-8 max-w-xs">
                The page you're looking for doesn't exist or has been moved.
            </p>
            <Link to="/" className="btn-brand px-8 py-3">Go Home</Link>
        </div>
    );
}
