import {
  ACCESS_DURATION_STEPS,
  formatAccessDuration,
} from "@screen-time/contracts";

import { SteppedSlider } from "@/components/stepped-slider";
import { localize } from "@/i18n";

type Props = {
  value: number;
  onChange: (seconds: number) => void;
  disabled?: boolean;
  /** `dark` for the intervention shield, `light` for Still's own screens. */
  tone?: "dark" | "light";
};

function label(seconds: number) {
  return localize(
    formatAccessDuration(seconds, "en"),
    formatAccessDuration(seconds, "es"),
  );
}

/**
 * The stepped slider the user drags to choose how long access lasts, from one
 * minute to the rest of the day. Stops come from `ACCESS_DURATION_STEPS`, so
 * the scale gives minutes most of the travel.
 */
export function DurationSlider({ value, onChange, disabled, tone }: Props) {
  return (
    <SteppedSlider
      accessibilityLabel={localize(
        "How long access lasts",
        "Cuánto dura el acceso",
      )}
      disabled={disabled}
      format={label}
      onChange={onChange}
      steps={ACCESS_DURATION_STEPS}
      tone={tone}
      value={value}
    />
  );
}
