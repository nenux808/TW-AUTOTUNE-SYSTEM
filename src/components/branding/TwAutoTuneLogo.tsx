const TW_AUTO_TUNE_LOGO_SRC =
  "data:image/webp;base64,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";

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
        alt="TW Auto Tune"
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
