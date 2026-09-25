import { LeafIcon } from '@/components/icons';

export function Logo() {
  return (
    <span className="flex items-center gap-3">
      <span className="flex size-9 md:size-10 items-center justify-center rounded-xl bg-brand-700 text-white">
        <LeafIcon className="size-5" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-display text-lg md:text-xl font-bold text-ink">FoodBridge</span>
        <span className="hidden md:block text-[13px] text-subtle">Schweizer Tafel</span>
      </span>
    </span>
  );
}
