export function Panel({ className = '', children, ...props }) {
  return (
    <div className={`bg-panel border border-border rounded-2xl p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Card({ className = '', selected = false, children, ...props }) {
  return (
    <div
      className={`bg-panel border rounded-2xl p-4 cursor-pointer transition-all duration-150 hover:border-accent hover:-translate-y-0.5 ${
        selected ? 'border-accent2 shadow-[0_0_0_1px_var(--color-accent2)]' : 'border-border'
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
