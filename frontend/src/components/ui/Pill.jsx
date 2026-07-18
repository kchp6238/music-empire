export function Pill({ active = false, size = 'md', className = '', children, ...props }) {
  const sizeCls = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm';
  return (
    <button
      type="button"
      className={`inline-flex items-center rounded-full border cursor-pointer transition-all duration-150 ${sizeCls} ${
        active
          ? 'bg-accent border-accent text-bg font-semibold'
          : 'bg-white/[0.03] border-border-strong text-text hover:border-accent2'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
