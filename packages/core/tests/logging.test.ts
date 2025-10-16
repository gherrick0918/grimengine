import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { appendLog, resolveLogFile } from '../src/log.js';

const ORIGINAL_CWD = process.cwd();
let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'grim-log-'));
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(ORIGINAL_CWD);
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe('logging helpers', () => {
  test('appendLog writes to session log when no campaign', async () => {
    await appendLog('opened the door');
    const { file } = await resolveLogFile();
    const contents = await fs.readFile(file, 'utf-8');
    expect(contents.trim().endsWith('opened the door')).toBe(true);
    expect(path.relative(tempDir, file)).toMatch(/\.data\/session-\d{4}-\d{2}-\d{2}\.md$/);
  });

  test('appendLog uses campaign-specific log file', async () => {
    await appendLog('met the merchant', { name: 'greenway' });
    const { file } = await resolveLogFile({ name: 'greenway' });
    const contents = await fs.readFile(file, 'utf-8');
    expect(contents.trim().endsWith('met the merchant')).toBe(true);
    expect(path.relative(tempDir, file)).toMatch(/\.data\/campaigns\/greenway-session-\d{4}-\d{2}-\d{2}\.md$/);
  });

  test('appendLog preserves chronological order for tailing', async () => {
    for (let i = 0; i < 7; i += 1) {
      await appendLog(`Entry ${i}`);
    }
    const { file } = await resolveLogFile();
    const contents = await fs.readFile(file, 'utf-8');
    const lines = contents.trim().split(/\r?\n/);
    const tail = lines.slice(-5);
    expect(tail).toHaveLength(5);
    tail.forEach((line, index) => {
      expect(line.endsWith(`Entry ${index + 2}`)).toBe(true);
    });
  });
});
