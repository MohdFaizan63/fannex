import { useForm } from 'react-hook-form';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { authService } from '../../services/authService';
import { getErrorMessage } from '../../utils/helpers';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const navigate = useNavigate();
    const [serverError, setErr] = useState('');
    const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();

    const onSubmit = async ({ newPassword }) => {
        setErr('');
        try {
            await authService.resetPassword({ token, newPassword });
            navigate('/login', { replace: true });
        } catch (err) { setErr(getErrorMessage(err)); }
    };

    if (!token) return (
        <div className="text-center py-4">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-surface-400">Invalid or missing reset token.</p>
            <Link to="/forgot-password" className="mt-4 inline-block text-brand-400">Request a new link</Link>
        </div>
    );

    return (
        <>
            <h2 className="text-2xl font-bold text-white mb-1">Set new password</h2>
            <p className="text-sm text-surface-400 mb-8">Choose a strong password for your account.</p>
            {serverError && <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{serverError}</div>}
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
                <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">New Password</label>
                    <input {...register('newPassword', { required: 'Required', minLength: { value: 6, message: 'At least 6 characters' } })}
                        type="password" placeholder="Min 6 characters" className="input-dark" />
                    {errors.newPassword && <p className="mt-1 text-xs text-red-400">{errors.newPassword.message}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">Confirm Password</label>
                    <input {...register('confirmPassword', { required: 'Required', validate: v => v === watch('newPassword') || 'Passwords do not match' })}
                        type="password" placeholder="••••••••" className="input-dark" />
                    {errors.confirmPassword && <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>}
                </div>
                <button type="submit" disabled={isSubmitting} className="btn-brand w-full">{isSubmitting ? 'Updating…' : 'Reset password'}</button>
            </form>
        </>
    );
}
