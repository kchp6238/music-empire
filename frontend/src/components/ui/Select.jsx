export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`px-3 py-2.5 rounded-lg border border-border-strong bg-bg text-text outline-none focus:border-accent2 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
