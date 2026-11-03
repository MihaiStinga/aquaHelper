// Rule engine. Rules are plain JSON (see src/rules/default-rules.json and
// docs/rules.md) so new ones can be added without code: drop them in the
// JSON file, or import a JSON file from Settings → Rules in the app.

import { lastEventBefore } from './events';
import { formatValue } from './format';
import { getParameter } from './parameters';
import { statusFor } from './status';
import type { EventKind, Measurement, Range, TankEvent } from './types';

export type Severity = 'info' | 'warning' | 'critical';
export type Op = '>' | '>=' | '<' | '<=' | 'between' | 'outside';

interface ParamBase {
  param: string;
  /** Ignore readings older than this (default 168 h = 7 days). */
  maxAgeHours?: number;
  /** Only when the reading was taken this long after the last water change. */
  hoursAfterWaterChange?: { min?: number; max?: number };
}

export type Condition =
  /** Latest reading compared with a number (or [low, high] for between/outside). */
  | (ParamBase & { op: Op; value: number | [number, number] })
  /** Latest reading outside the user's ideal range for that parameter. */
  | (ParamBase & { outsideRange: true })
  /** Change over a time window ending at the latest reading. */
  | (ParamBase & { change: { withinHours: number; measure?: 'delta' | 'spread'; op: Op; value: number | [number, number] } })
  /** Ratio of two latest readings, e.g. NO₃ : PO₄. */
  | { ratio: { num: string; den: string }; op: Op; value: number | [number, number]; maxAgeHours?: number }
  /** Days since the last event of a kind. */
  | { daysSince: EventKind; op: Op; value: number | [number, number]; ifNever?: boolean }
  /** Any of these parameters not tested for `days` (only ones tested at least once). */
  | { staleTests: string[]; days: number }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export interface Rule {
  id: string;
  title: string;
  /** May use {placeholders} filled from the matching condition, e.g. {value}, {days}. */
  message: string;
  severity: Severity;
  when: Condition;
  advice?: string[];
  enabled?: boolean;
  tags?: string[];
  /** With a top-level "any": one alert per matching branch instead of one in total. */
  each?: boolean;
}

export interface RuleContext {
  now: number;
  /** Series per parameter code, oldest first, computed parameters included. */
  series: Record<string, Measurement[]>;
  range: (code: string) => Range;
  /** Oldest first. */
  events: TankEvent[];
}

export interface Alert {
  ruleId: string;
  severity: Severity;
  title: string;
  message: string;
  advice: string[];
  /** Identifies this occurrence: dismissing it lasts until the evidence changes. */
  key: string;
}

interface Match {
  vars: Record<string, string>;
  evidence: string[];
}

const HOUR = 3600_000;
const DEFAULT_MAX_AGE_H = 168;

export function compare(x: number, op: Op, v: number | [number, number]): boolean {
  if (op === 'between' || op === 'outside') {
    const [lo, hi] = Array.isArray(v) ? v : [v, v];
    const inside = x >= lo && x <= hi;
    return op === 'between' ? inside : !inside;
  }
  const n = Array.isArray(v) ? v[0] : v;
  switch (op) {
    case '>': return x > n;
    case '>=': return x >= n;
    case '<': return x < n;
    case '<=': return x <= n;
  }
}

const name = (code: string) => getParameter(code)?.name ?? code;
const fmt = (code: string, v: number) => {
  const d = getParameter(code);
  return `${formatValue(v, d?.decimals ?? 1)}${d?.unit ? ` ${d.unit}` : ''}`;
};

/** Latest reading of `code` at or before now, if fresh enough and in the after-water-change window. */
function latest(ctx: RuleContext, c: ParamBase): { m: Measurement; vars: Record<string, string> } | null {
  const s = ctx.series[c.param] ?? [];
  let m: Measurement | undefined;
  for (let i = s.length - 1; i >= 0; i--) if (s[i].measuredAt <= ctx.now) { m = s[i]; break; }
  if (!m) return null;
  if (ctx.now - m.measuredAt > (c.maxAgeHours ?? DEFAULT_MAX_AGE_H) * HOUR) return null;
  const vars: Record<string, string> = { param: name(c.param), value: fmt(c.param, m.value) };
  if (c.hoursAfterWaterChange) {
    const wc = lastEventBefore(ctx.events, 'water_change', m.measuredAt);
    if (!wc) return null;
    const h = (m.measuredAt - wc.at) / HOUR;
    const { min = 0, max = Infinity } = c.hoursAfterWaterChange;
    if (h < min || h > max) return null;
    vars.hoursAfter = String(Math.round(h));
    vars.daysAfter = formatValue(h / 24, 1);
    vars.percent = wc.percent != null ? String(Math.round(wc.percent)) : '?';
  }
  return { m, vars };
}

function evaluate(c: Condition, ctx: RuleContext): Match | null {
  if ('all' in c) {
    const out: Match = { vars: {}, evidence: [] };
    for (const sub of c.all) {
      const r = evaluate(sub, ctx);
      if (!r) return null;
      Object.assign(out.vars, r.vars);
      out.evidence.push(...r.evidence);
    }
    return out;
  }
  if ('any' in c) {
    for (const sub of c.any) {
      const r = evaluate(sub, ctx);
      if (r) return r;
    }
    return null;
  }
  if ('not' in c) return evaluate(c.not, ctx) ? null : { vars: {}, evidence: ['not'] };

  if ('ratio' in c) {
    const a = latest(ctx, { param: c.ratio.num, maxAgeHours: c.maxAgeHours });
    const b = latest(ctx, { param: c.ratio.den, maxAgeHours: c.maxAgeHours });
    if (!a || !b || b.m.value <= 0) return null;
    const r = a.m.value / b.m.value;
    if (!compare(r, c.op, c.value)) return null;
    return { vars: { ratio: formatValue(r, 1), num: a.vars.value, den: b.vars.value }, evidence: [a.m.id, b.m.id] };
  }

  if ('daysSince' in c) {
    const e = lastEventBefore(ctx.events, c.daysSince, ctx.now);
    if (!e) return c.ifNever ? { vars: { days: 'never' }, evidence: ['never'] } : null;
    const days = (ctx.now - e.at) / (24 * HOUR);
    if (!compare(days, c.op, c.value)) return null;
    return { vars: { days: String(Math.floor(days)) }, evidence: [e.id] };
  }

  if ('staleTests' in c) {
    const stale: string[] = [];
    const ids: string[] = [];
    for (const code of c.staleTests) {
      const s = (ctx.series[code] ?? []).filter((m) => m.measuredAt <= ctx.now);
      const last = s.at(-1);
      if (last && ctx.now - last.measuredAt >= c.days * 24 * HOUR) {
        stale.push(name(code).split(' (')[0]);
        ids.push(last.id);
      }
    }
    return stale.length ? { vars: { params: stale.join(', ') }, evidence: ids } : null;
  }

  // Parameter conditions
  const l = latest(ctx, c);
  if (!l) return null;
  if ('outsideRange' in c) {
    const st = statusFor(l.m.value, ctx.range(c.param));
    if (st !== 'low' && st !== 'high') return null;
    return { vars: { ...l.vars, status: st }, evidence: [l.m.id] };
  }
  if ('change' in c) {
    const from = l.m.measuredAt - c.change.withinHours * HOUR;
    const window = (ctx.series[c.param] ?? []).filter((m) => m.measuredAt >= from && m.measuredAt <= l.m.measuredAt);
    if (window.length < 2) return null;
    const values = window.map((m) => m.value);
    const amount = c.change.measure === 'spread' ? Math.max(...values) - Math.min(...values) : l.m.value - window[0].value;
    if (!compare(amount, c.change.op, c.change.value)) return null;
    const d = getParameter(c.param);
    return {
      vars: { ...l.vars, change: `${amount > 0 && c.change.measure !== 'spread' ? '+' : ''}${formatValue(amount, d?.decimals ?? 1)}`, hours: String(c.change.withinHours) },
      evidence: [window[0].id, l.m.id],
    };
  }
  if (!compare(l.m.value, c.op, c.value)) return null;
  return { vars: l.vars, evidence: [l.m.id] };
}

export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (all, k: string) => vars[k] ?? all);
}

const ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

/** Active alerts, most severe first. Disabled rules are skipped. */
export function evaluateRules(rules: Rule[], ctx: RuleContext): Alert[] {
  const out: Alert[] = [];
  for (const r of rules) {
    if (r.enabled === false) continue;
    let matches: Match[] = [];
    try {
      const branches = r.each && 'any' in r.when ? r.when.any : [r.when];
      matches = branches.map((b) => evaluate(b, ctx)).filter((m): m is Match => m != null);
    } catch {
      continue; // a malformed custom rule must not break the others
    }
    for (const match of matches) out.push({
      ruleId: r.id,
      severity: r.severity,
      title: fill(r.title, match.vars),
      message: fill(r.message, match.vars),
      advice: r.advice ?? [],
      key: `${r.id}:${match.evidence.join(',')}`,
    });
  }
  return out.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}

/** Checks a rules file; returns readable problems (empty = valid). */
export function validateRules(input: unknown): string[] {
  const problems: string[] = [];
  if (!Array.isArray(input)) return ['The file must contain a JSON array of rules.'];
  const ids = new Set<string>();
  input.forEach((r, i) => {
    const at = `Rule ${i + 1}${r && typeof r === 'object' && 'id' in r ? ` (${String((r as Rule).id)})` : ''}`;
    if (!r || typeof r !== 'object') return problems.push(`${at}: not an object`);
    const rule = r as Rule;
    if (!rule.id || typeof rule.id !== 'string') problems.push(`${at}: missing "id"`);
    else if (ids.has(rule.id)) problems.push(`${at}: duplicate id`);
    else ids.add(rule.id);
    if (typeof rule.title !== 'string') problems.push(`${at}: missing "title"`);
    if (typeof rule.message !== 'string') problems.push(`${at}: missing "message"`);
    if (!['info', 'warning', 'critical'].includes(rule.severity)) problems.push(`${at}: "severity" must be info, warning or critical`);
    const err = checkCondition(rule.when);
    if (err) problems.push(`${at}: ${err}`);
  });
  return problems;
}

const OPS: Op[] = ['>', '>=', '<', '<=', 'between', 'outside'];

function checkCondition(c: unknown): string | null {
  if (!c || typeof c !== 'object') return '"when" must be an object';
  const o = c as Record<string, unknown>;
  if (Array.isArray(o.all) || Array.isArray(o.any)) {
    for (const s of (o.all ?? o.any) as unknown[]) {
      const e = checkCondition(s);
      if (e) return e;
    }
    return null;
  }
  if ('not' in o) return checkCondition(o.not);
  if ('staleTests' in o) return Array.isArray(o.staleTests) && typeof o.days === 'number' ? null : 'staleTests needs a list and "days"';
  const opOk = (op: unknown) => OPS.includes(op as Op);
  if ('daysSince' in o) return opOk(o.op) ? null : `bad "op" ${String(o.op)}`;
  if ('ratio' in o) return opOk(o.op) ? null : `bad "op" ${String(o.op)}`;
  if (typeof o.param !== 'string' || !getParameter(o.param)) return `unknown parameter "${String(o.param)}"`;
  if (o.outsideRange === true) return null;
  if (o.change && typeof o.change === 'object') return opOk((o.change as Record<string, unknown>).op) ? null : 'bad "op" in change';
  return opOk(o.op) ? null : `bad "op" ${String(o.op)}`;
}

/** Defaults overlaid with the user's custom rules (same id = replaced) and on/off choices. */
export function mergeRules(defaults: Rule[], custom: Rule[], enabled: Record<string, boolean>): Rule[] {
  const byId = new Map<string, Rule>();
  for (const r of defaults) byId.set(r.id, { ...r, tags: r.tags ?? [] });
  for (const r of custom) byId.set(r.id, { ...r, tags: [...(r.tags ?? []), 'custom'] });
  return [...byId.values()].map((r) => (r.id in enabled ? { ...r, enabled: enabled[r.id] } : r));
}
