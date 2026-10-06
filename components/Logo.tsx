import { BridgeIcon } from '@/components/icons';

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-9 md:size-10 items-center justify-center rounded-xl bg-brand-700 text-white shadow-[0_4px_12px_rgba(74,38,149,0.25)]">
        <BridgeIcon className="size-5" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-lg md:text-[19px] font-bold tracking-[-0.02em] text-ink">FoodBridge</span>
        <span className="hidden md:block text-[12px] font-medium text-subtle">Schweizer Tafel</span>
      </span>
    </span>
  );
}
