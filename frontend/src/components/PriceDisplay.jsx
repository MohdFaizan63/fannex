/**
 * PriceDisplay.jsx — Render a geo-localised price with correct symbol
 *
 * Props:
 *   price    {number}  — numeric price value (e.g. 120 or 4.99)
 *   currency {"INR"|"USD"} — currency code
 *   suffix   {string}  — optional suffix (e.g. "/mo")
 *   className {string} — optional extra class
 *   style    {object}  — optional inline style
 *
 * Examples:
 *   <PriceDisplay price={120}  currency="INR" suffix="/mo" />  → ₹120/mo
 *   <PriceDisplay price={4.99} currency="USD" suffix="/mo" />  → $4.99/mo
 */

export default function PriceDisplay({ price, currency = 'INR', suffix = '', className = '', style = {} }) {
    if (price === null || price === undefined) return null;

    const formatted = new Intl.NumberFormat(
        currency === 'INR' ? 'en-IN' : 'en-US',
        {
            style: 'currency',
            currency,
            minimumFractionDigits: currency === 'INR' ? 0 : 2,
            maximumFractionDigits: currency === 'INR' ? 0 : 2,
        }
    ).format(price);

    return (
        <span className={className} style={style}>
            {formatted}{suffix}
        </span>
    );
}
