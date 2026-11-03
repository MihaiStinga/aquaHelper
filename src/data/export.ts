import { Platform, Share } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getParameter } from '@/domain/parameters';
import { dateTime, formatValue } from '@/domain/format';
import { statusFor } from '@/domain/status';
import { STATUS_LABEL } from '@/theme/theme';
import type { Measurement, Range } from '@/domain/types';
import type { Backup } from './repo';

/** Saves text as a file: a download on web, the share sheet on Android. */
export async function saveText(name: string, mime: string, content: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: name });
}

const stamp = () => new Date().toISOString().slice(0, 10);

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(series: Record<string, Measurement[]>, codes: string[]): string {
  const rows = [['parameter', 'value', 'unit', 'measured_at_iso', 'measured_at_local', 'calculated', 'note']];
  for (const code of codes) {
    const def = getParameter(code)!;
    for (const m of series[code] ?? []) {
      rows.push([
        def.name,
        // Full stored precision in the CSV; rounding is only for display.
        String(m.value),
        def.unit,
        new Date(m.measuredAt).toISOString(),
        dateTime(m.measuredAt),
        def.kind === 'computed' ? 'yes' : 'no',
        m.note ?? '',
      ]);
    }
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

export async function exportCsv(series: Record<string, Measurement[]>, codes: string[], name = 'all'): Promise<void> {
  await saveText(`aquahelper-${name}-${stamp()}.csv`, 'text/csv', toCsv(series, codes));
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export async function exportPdf(title: string, series: Record<string, Measurement[]>, codes: string[], range: (code: string) => Range): Promise<void> {
  const sections = codes
    .filter((c) => series[c]?.length)
    .map((c) => {
      const def = getParameter(c)!;
      const r = range(c);
      const rows = [...series[c]].reverse().map((m) => {
        const st = statusFor(m.value, r);
        return `<tr><td>${esc(dateTime(m.measuredAt))}</td><td>${formatValue(m.value, def.decimals)} ${esc(def.unit)}</td><td>${st === 'none' ? '' : STATUS_LABEL[st]}</td><td>${esc(m.note ?? '')}</td></tr>`;
      });
      const ideal = r.min != null || r.max != null ? ` · ideal ${r.min ?? '…'} – ${r.max ?? '…'} ${esc(def.unit)}` : '';
      return `<h2>${esc(def.name)}${def.kind === 'computed' ? ' (calculated)' : ''}</h2><p>${series[c].length} measurements${ideal}</p><table><tr><th>Date</th><th>Value</th><th>Status</th><th>Note</th></tr>${rows.join('')}</table>`;
    });
  const html = `<html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Roboto,sans-serif;color:#1b1b1b;padding:24px}
    h1{font-size:22px} h2{font-size:17px;margin:22px 0 4px} p{color:#5f6368;margin:0 0 8px;font-size:12px}
    table{border-collapse:collapse;width:100%;font-size:12px} th,td{border-bottom:1px solid #e2e2e2;padding:5px 6px;text-align:left}
  </style></head><body><h1>${esc(title)}</h1><p>Exported ${esc(dateTime(Date.now()))}</p>${sections.join('') || '<p>No measurements.</p>'}</body></html>`;
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: title });
}

export async function shareSummary(text: string): Promise<void> {
  if (Platform.OS === 'web' && !navigator.share) {
    await navigator.clipboard.writeText(text);
    alert('Summary copied to clipboard');
    return;
  }
  await Share.share({ message: text });
}

export async function exportBackupFile(backup: Backup): Promise<void> {
  await saveText(`aquahelper-backup-${stamp()}.json`, 'application/json', JSON.stringify(backup, null, 2));
}

/** Lets the user pick a JSON file and parses it; returns null when cancelled. */
export async function pickJsonFile(): Promise<unknown> {
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (res.canceled) return null;
  const asset = res.assets[0];
  const text = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new File(asset.uri).text();
  return JSON.parse(text);
}

export async function pickBackupFile(): Promise<Backup | null> {
  return (await pickJsonFile()) as Backup | null;
}
