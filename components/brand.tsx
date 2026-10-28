import Image from "next/image";

type BrandProps = {
  inverse?: boolean;
  priority?: boolean;
};

export function Brand({ inverse = false, priority = false }: BrandProps) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative h-[40px] w-[40px] shrink-0 overflow-hidden rounded-[11px] bg-[#f7f7f5]">
        <Image
          alt=""
          aria-hidden="true"
          className="absolute left-[-9px] top-[-2px] h-[52px] w-[56px] max-w-none"
          height={680}
          priority={priority}
          sizes="56px"
          src="/assets/image.png"
          width={734}
        />
      </span>
      <span className="flex flex-col">
        <span
          className={`text-[18px] font-bold leading-none tracking-[0.075em] ${
            inverse ? "text-white" : "text-ink"
          }`}
        >
          FARMAMED
        </span>
        <span
          className={`mt-1.5 text-[8px] font-semibold leading-none tracking-[0.23em] ${
            inverse ? "text-white/55" : "text-muted"
          }`}
        >
          ERP DROGUERÍAS
        </span>
      </span>
    </span>
  );
}
