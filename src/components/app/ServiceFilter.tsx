import { Field, NativeSelect } from "@/components/app/ui";
import { SERVICE_TYPES } from "@/lib/services";
export function ServiceFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <Field label="Service type"><NativeSelect value={value} onChange={(e) => onChange(e.target.value)}><option value="">All services</option>{SERVICE_TYPES.map((s) => <option key={s}>{s}</option>)}<option value="unknown">Unknown — review required</option></NativeSelect></Field>;
}