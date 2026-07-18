export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full px-3 py-2.5 rounded-lg border border-border-strong bg-bg text-text outline-none placeholder:text-faint focus:border-accent2 ${className}`}
      {...props}
    />
  );
}

export function TextArea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full px-3 py-2.5 rounded-lg border border-border-strong bg-bg text-text outline-none placeholder:text-faint focus:border-accent2 resize-y ${className}`}
      {...props}
    />
  );
}
