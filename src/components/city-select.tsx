import { CITIES } from "@/lib/destinations";
import { fieldClass } from "@/components/ui";

export function CitySelect({
  name,
  required = false,
  taken = [],
}: {
  name: string;
  required?: boolean;
  taken?: string[];
}) {
  const used = new Set(taken.map((city) => city.toLowerCase()));

  return (
    <select name={name} required={required} className={fieldClass} defaultValue="">
      <option value="">Choose a city</option>
      {CITIES.map((city) => (
        <option key={city} value={city} disabled={used.has(city.toLowerCase())}>
          {city}
        </option>
      ))}
    </select>
  );
}
