import { promises as fs } from 'node:fs';
import path from 'node:path';

export type LogSink = (line: string) => Promise<void>;

export interface LogEnv {
  file: string;
}

function todayStamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function resolveLogFile(campaign?: { name?: string }): Promise<LogEnv> {
  const now = new Date();
  const stamp = todayStamp(now);
  const dir = campaign?.name ? path.join('.data', 'campaigns') : '.data';
  const base = campaign?.name ? `${campaign.name}-session-${stamp}.md` : `session-${stamp}.md`;
  const file = path.join(process.cwd(), dir, base);
  await fs.mkdir(path.dirname(file), { recursive: true });
  return { file };
}

function formatLine(line: string, date: Date): string {
  return `- ${date.toISOString()} ${line}`;
}

export async function appendLog(line: string, campaign?: { name?: string }): Promise<void> {
  const { file } = await resolveLogFile(campaign);
  const text = `\n${formatLine(line, new Date())}`;
  await fs.appendFile(file, text, 'utf-8');
}
