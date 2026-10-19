import { cn } from "@/lib/utils";

// Ícono de la tab "Skills" del Journal -- compartido con los cubos del modal de confirmación.
export function SkillsSparkIcon({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex items-center justify-center", className)}>
      <svg viewBox="0 0 24 24" className="h-[84%] w-[84%] fill-black dark:fill-white" focusable="false">
        <path d="M12 2.5L15.2 8.8L21.5 12L15.2 15.2L12 21.5L8.8 15.2L2.5 12L8.8 8.8L12 2.5Z" />
      </svg>
    </span>
  );
}
