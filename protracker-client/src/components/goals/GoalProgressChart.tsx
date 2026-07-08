import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Dot,
} from 'recharts';
import type { DotProps } from 'recharts';
import { useGoalProgress } from '../../hooks/useGoals';
import type { PersonalGoal, GoalProgress } from '../../types';
import { Spinner } from '../ui/Spinner';

interface Props {
  goal: PersonalGoal;
}

interface Point {
  name: string;
  value: number;
  source: string;
}

function TooltipBox({ active, payload }: {
  active?: boolean;
  payload?: { payload: Point }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl">
      <p className="text-xs font-semibold text-gray-400 mb-1">{p.name}</p>
      <p className="text-sm text-white font-medium">{p.value}{' '}
        <span className="text-xs text-gray-400 font-normal">· {p.source}</span>
      </p>
    </div>
  );
}

// Assessment-sourced points get a filled ring so auto-updates stand out from manual logs.
function ProgressDot(props: DotProps & { payload?: Point }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  const isAssessment = payload?.source === 'Assessment';
  return (
    <Dot
      cx={cx}
      cy={cy}
      r={isAssessment ? 5 : 3.5}
      fill={isAssessment ? '#22c55e' : '#6366f1'}
      stroke="#fff"
      strokeWidth={1.5}
    />
  );
}

export function GoalProgressChart({ goal }: Props) {
  const { data: progress = [], isLoading } = useGoalProgress(goal.id);

  if (isLoading) {
    return <div className="flex justify-center py-6"><Spinner /></div>;
  }

  const points: Point[] = progress.map((p: GoalProgress) => ({
    name: new Date(p.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: p.value,
    source: p.source,
  }));

  // Seed the line with the starting value so a single log still draws a trend.
  if (goal.currentValue != null && points.length === 0) {
    points.push({ name: 'Start', value: goal.currentValue, source: 'Manual' });
  }

  if (points.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
        No progress logged yet. Use “Log Progress” to start tracking.
      </p>
    );
  }

  const values = points.map(p => p.value);
  const target = goal.targetValue ?? undefined;
  const all = target != null ? [...values, target] : values;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = Math.max((max - min) * 0.15, 0.5);

  return (
    <div className="mt-2">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-gray-500" />
          <YAxis domain={[Math.floor(min - pad), Math.ceil(max + pad)]} tick={{ fontSize: 11 }} className="text-gray-500" />
          <Tooltip content={<TooltipBox />} />
          {target != null && (
            <ReferenceLine
              y={target}
              stroke="#22c55e"
              strokeDasharray="5 4"
              label={{ value: `Target ${target}${goal.unit ? ' ' + goal.unit : ''}`, position: 'insideTopRight', fontSize: 10, fill: '#22c55e' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#6366f1"
            strokeWidth={2}
            dot={<ProgressDot />}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
