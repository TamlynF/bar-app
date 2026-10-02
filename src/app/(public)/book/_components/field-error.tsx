export const incompleteButtonClass = "opacity-50 shadow-none";

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 ml-1 text-pill leading-relaxed font-bold text-red-400">
      {message}
    </p>
  );
}
