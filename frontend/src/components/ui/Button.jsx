const VARIANTS = {
  primary: 'bg-accent text-bg font-bold hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed',
  ghost: 'bg-transparent text-text border border-border-strong hover:border-accent2 disabled:opacity-30 disabled:cursor-not-allowed',
  danger: 'bg-transparent text-danger border border-danger/50 hover:bg-danger/10 disabled:opacity-30 disabled:cursor-not-allowed',
};

const SIZES = {
  sm: 'px-2.5 py-1 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-5 py-3 text-sm rounded-xl',
};

export function Button({ variant = 'ghost', size = 'md', className = '', children, ...props }) {
  return (
    <button
      className={`inline-flex items-center gap-2 cursor-pointer transition-all duration-150 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
