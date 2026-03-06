import { forwardRef } from 'react';

/**
 * Input — reusable form input component.
 *
 * Usage (with React Hook Form):
 *   <Input
 *     label="Email"
 *     type="email"
 *     placeholder="you@example.com"
 *     error={errors.email?.message}
 *     {...register('email')}
 *   />
 *
 * Supports all native <input> props via forwarded ref.
 */
const Input = forwardRef(function Input(
    { label, error, hint, id, className = '', type = 'text', ...rest },
    ref
) {
    // Generate a stable id from label if not provided
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label htmlFor={inputId} className="text-sm font-medium text-surface-300">
                    {label}
                </label>
            )}

            <input
                id={inputId}
                ref={ref}
                type={type}
                className={[
                    'input-dark',
                    error ? 'border-red-500 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]' : '',
                    className,
                ].filter(Boolean).join(' ')}
                {...rest}
            />

            {/* Validation error */}
            {error && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                    <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                </p>
            )}

            {/* Hint text (shown only when no error) */}
            {hint && !error && (
                <p className="text-xs text-surface-500">{hint}</p>
            )}
        </div>
    );
});

export default Input;
