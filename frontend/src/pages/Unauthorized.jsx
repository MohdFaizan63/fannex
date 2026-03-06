import { Link } from 'react-router-dom';

export default function Unauthorized() {
    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-white mb-3">Access Denied</h2>
            <p className="text-surface-400 mb-8 max-w-xs">
                You don't have permission to view this page.
            </p>
            <Link to="/" className="btn-brand px-8 py-3">Go Home</Link>
        </div>
    );
}
