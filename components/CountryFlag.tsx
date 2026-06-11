import * as Flags from "country-flag-icons/react/3x2";
import { countryIso } from "@/lib/format";

/**
 * Small inline SVG flag for a country name. Renders nothing when the country
 * is unknown — emoji flags don't render on Windows, so this is SVG-based.
 */
export default function CountryFlag({
  country,
  className = "inline-block w-[18px] h-[12px] rounded-[1px] mr-1.5 align-[-1px] border border-zinc-200",
}: {
  country: string | null | undefined;
  className?: string;
}) {
  const iso = countryIso(country);
  if (!iso) return null;
  const Flag = (Flags as Record<string, React.ComponentType<{ className?: string; title?: string }>>)[iso];
  if (!Flag) return null;
  return <Flag className={className} title={country ?? undefined} />;
}
