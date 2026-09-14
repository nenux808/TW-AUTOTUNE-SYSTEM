const TW_AUTO_TUNE_LOGO_SRC = "/tw-autotune-logo.jpeg";

type TwAutoTuneLogoProps = {
  className?: string;
  imageClassName?: string;
  showTagline?: boolean;
};

export default function TwAutoTuneLogo({
  className = "",
  imageClassName = "",
  showTagline = false,
}: TwAutoTuneLogoProps) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <img
        src={TW_AUTO_TUNE_LOGO_SRC}
        alt="TW AutoTune"
        className={`h-auto w-full object-contain ${imageClassName}`}
      />
      {showTagline && (
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          Trusted care for every drive
        </p>
      )}
    </div>
  );
}
