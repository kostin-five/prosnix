import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface DemoWakeChartPoint {
  name: string;
  label: string;
  value: number;
}

export default function DemoWakeChart({ data }: { data: DemoWakeChartPoint[] }) {
  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barSize={28} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#7878A0", fontSize: 12, fontFamily: "inherit" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#7878A0", fontSize: 11, fontFamily: "inherit" }}
            tickCount={4}
          />
          <Tooltip
            contentStyle={{
              background: "#12121E",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              color: "#ECEDF5",
              fontFamily: "inherit",
              fontSize: 13,
            }}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            formatter={(value: number) => [value > 0 ? `+${value}` : value, "Прирост бодрости"]}
          />
          <Bar
            dataKey="value"
            shape={(rawProps: unknown) => {
              const {
                x = 0,
                y = 0,
                width = 0,
                height = 0,
                value = 0,
              } = rawProps as Partial<Record<"x" | "y" | "width" | "height" | "value", number>>;
              if (!height || height <= 0) return <g />;
              const fill =
                value >= 5
                  ? "#22C55E"
                  : value >= 3
                    ? "#F97316"
                    : value >= 0
                      ? "#EAB308"
                      : "#EF4444";
              return <rect x={x} y={y} width={width} height={height} fill={fill} rx={5} ry={5} />;
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
