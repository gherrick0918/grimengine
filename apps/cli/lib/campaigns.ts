import { promises as fs } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

export interface CampaignData {
  name: string;
  party: string[];
  currentSnapshot: string | null;
  notesFile: string;
}

interface CliState {
  currentCampaignPath?: string;
}

const DATA_ROOT = join(process.cwd(), '.data');
const CAMPAIGN_DIR = join(DATA_ROOT, 'campaigns');
const STATE_FILE = join(DATA_ROOT, 'state.json');

function toSlug(rawName: string): string {
  const trimmed = rawName.trim();
  if (!trimmed) {
    return '';
  }
  const normalized = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/-+/g, '-');
  return normalized.replace(/^-|-$/g, '');
}

function campaignFilePath(slug: string): string {
  return join(CAMPAIGN_DIR, `${slug}.json`);
}

function ensureAbsolutePath(pathLike: string): string {
  if (isAbsolute(pathLike)) {
    return pathLike;
  }
  return resolve(process.cwd(), pathLike);
}

export function relativeSnapshotPath(pathLike: string): string {
  const absolute = ensureAbsolutePath(pathLike);
  return relative(process.cwd(), absolute);
}

async function ensureDataDirs(): Promise<void> {
  await fs.mkdir(CAMPAIGN_DIR, { recursive: true });
}

async function readState(): Promise<CliState> {
  try {
    const contents = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(contents) as CliState;
  } catch {
    return {};
  }
}

async function writeState(state: CliState): Promise<void> {
  await fs.mkdir(DATA_ROOT, { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export async function rememberCurrentCampaign(filePath: string | null): Promise<void> {
  const state = await readState();
  if (filePath) {
    state.currentCampaignPath = filePath;
  } else {
    delete state.currentCampaignPath;
  }
  await writeState(state);
}

export async function guessCurrentCampaignFile(): Promise<string | null> {
  const state = await readState();
  if (!state.currentCampaignPath) {
    return null;
  }
  try {
    await fs.access(state.currentCampaignPath);
    return state.currentCampaignPath;
  } catch {
    return null;
  }
}

export async function createCampaign(
  rawName: string,
  options: { force?: boolean } = {},
): Promise<{
  slug: string;
  filePath: string;
  campaign: CampaignData;
  created: boolean;
  overwritten: boolean;
}> {
  const slug = toSlug(rawName);
  if (!slug) {
    throw new Error('Campaign name must include letters or numbers.');
  }

  await ensureDataDirs();
  const filePath = campaignFilePath(slug);

  const notesFileAbsolute = join(CAMPAIGN_DIR, `${slug}-notes.md`);
  const notesFile = relative(process.cwd(), notesFileAbsolute);
  const campaign: CampaignData = {
    name: slug,
    party: [],
    currentSnapshot: null,
    notesFile,
  };

  let existed = false;
  try {
    await fs.access(filePath);
    existed = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.mkdir(dirname(notesFileAbsolute), { recursive: true });

  if (existed && !options.force) {
    const existingCampaign = await readCampaignFile(filePath);
    await rememberCurrentCampaign(filePath);
    return { slug, filePath, campaign: existingCampaign, created: false, overwritten: false };
  }

  await fs.writeFile(filePath, JSON.stringify(campaign, null, 2), 'utf-8');
  try {
    await fs.access(notesFileAbsolute);
  } catch {
    await fs.writeFile(notesFileAbsolute, '', 'utf-8');
  }

  await rememberCurrentCampaign(filePath);

  return { slug, filePath, campaign, created: true, overwritten: existed };
}

export async function loadCampaignByName(rawName: string): Promise<{
  slug: string;
  filePath: string;
  campaign: CampaignData;
}> {
  const slug = toSlug(rawName);
  if (!slug) {
    throw new Error('Campaign name must include letters or numbers.');
  }

  const filePath = campaignFilePath(slug);

  const campaign = await readCampaignFile(filePath);

  await rememberCurrentCampaign(filePath);

  return { slug, filePath, campaign };
}

export async function readCampaignFile(filePath: string): Promise<CampaignData> {
  await ensureDataDirs();
  const contents = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(contents) as CampaignData;
}

export async function writeCampaignFile(filePath: string, campaign: CampaignData): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(campaign, null, 2), 'utf-8');
}

export async function appendCampaignNote(campaign: CampaignData, text: string): Promise<void> {
  const absoluteNotesFile = ensureAbsolutePath(campaign.notesFile);
  await fs.mkdir(dirname(absoluteNotesFile), { recursive: true });
  let prefix = '';
  try {
    const stats = await fs.stat(absoluteNotesFile);
    if (stats.size > 0) {
      prefix = '\n';
    }
  } catch {
    // ignore missing notes file
  }
  const line = `${prefix}- ${new Date().toISOString()} ${text}\n`;
  await fs.appendFile(absoluteNotesFile, line, 'utf-8');
}

export function formatCampaignParty(party: string[]): string {
  if (party.length === 0) {
    return '(empty)';
  }
  return party.join(', ');
}

export function resolveSnapshotAbsolutePath(snapshot: string): string {
  return ensureAbsolutePath(snapshot);
}

export function snapshotLabel(snapshot: string | null): string {
  if (!snapshot) {
    return '(none)';
  }
  return relativeSnapshotPath(snapshot);
}
