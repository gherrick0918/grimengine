import { appendLog } from '@grimengine/core';

import { guessCurrentCampaignFile, readCampaignFile } from './lib/campaigns';
import { loadSettings } from './settings';

interface CampaignLogInfo {
  name?: string;
}

let cachedCampaign: { path: string; info: CampaignLogInfo | undefined } | null = null;

async function readCampaignForLogging(filePath: string): Promise<CampaignLogInfo | undefined> {
  if (cachedCampaign && cachedCampaign.path === filePath) {
    return cachedCampaign.info;
  }

  try {
    const campaign = await readCampaignFile(filePath);
    const info: CampaignLogInfo = { name: campaign.name };
    cachedCampaign = { path: filePath, info };
    return info;
  } catch {
    cachedCampaign = { path: filePath, info: undefined };
    return undefined;
  }
}

export async function currentCampaignForLogging(): Promise<CampaignLogInfo | undefined> {
  const filePath = await guessCurrentCampaignFile();
  if (!filePath) {
    cachedCampaign = null;
    return undefined;
  }
  return readCampaignForLogging(filePath);
}

export async function logIfEnabled(line: string): Promise<void> {
  try {
    const settings = await loadSettings();
    const enabled = settings.autoLog !== false;
    if (!enabled) {
      return;
    }
    const campaign = await currentCampaignForLogging();
    await appendLog(line, campaign);
  } catch (error) {
    console.warn('Failed to append session log entry:', error);
  }
}
