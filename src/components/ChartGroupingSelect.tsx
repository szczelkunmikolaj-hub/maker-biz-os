import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ChartGrouping = "day" | "week" | "month" | "year";

interface Props {
  value: ChartGrouping;
  onChange: (v: ChartGrouping) => void;
}

export default function ChartGroupingSelect({ value, onChange }: Props) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ChartGrouping)}>
      <SelectTrigger className="w-[100px] h-7 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="day">Daily</SelectItem>
        <SelectItem value="week">Weekly</SelectItem>
        <SelectItem value="month">Monthly</SelectItem>
        <SelectItem value="year">Yearly</SelectItem>
      </SelectContent>
    </Select>
  );
}
