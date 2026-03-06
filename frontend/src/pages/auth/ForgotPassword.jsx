import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { authService } from '../../services/authService';
import { getErrorMessage } from '../../utils/helpers';

export default function ForgotPassword() {
    const [sent, setSent] = useState(false);
    const [serverError, setErr] = useState('');
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

    const onSubmit = async ({ email }) => {
        setErr('');
        try { await authService.forgotPassword(email); setSent(true); }
        catch (err) { setErr(getErrorMessage(err)); }
    };

    if (sent) return (
        <div className="text-center py-4">
            <div className="text-5xl mb-4">📧</div>
            <h3 className="text-xl font-bold text-white mb-2">Reset link sent!</h3>
            <p className="text-surface-400 text-sm">Check your inbox for the password reset link.</p>
        </div>
    );

    return (
        <>
            <h2 className="text-2xl font-bold text-white mb-1">Forgot password?</h2>
            <p className="text-sm text-surface-400 mb-8">We'll send you a reset link.</p>
            {serverError && <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{serverError}</div>}
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
                <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Email</label>
                    <input {...register('email', { required: 'Email is required' })} type="email" placeholder="you@example.com" className="input-dark" />
                    {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
                </div>
                <button type="submit" disabled={isSubmitting} className="btn-brand w-full">{isSubmitting ? 'Sending…' : 'Send reset link'}</button>
            </form>
            <p className="mt-6 text-center text-sm text-surface-400">
                <Link to="/login" className="text-brand-400 hover:text-brand-300">← Back to login</Link>
            </p>
        </>
    );
}
