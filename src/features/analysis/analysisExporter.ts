import { AnalysisResult } from '../../types/analysis';
import { AnalysisResultV1 } from '../../types/analysisV1';
import * as Clipboard from 'expo-clipboard';
import { Logger } from '../../utils/logger';

/**
 * Export an AnalysisResult as pretty-printed JSON.
 */
export function exportToJSON(result: AnalysisResult | AnalysisResultV1): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Copy analysis result JSON to clipboard.
 */
export async function copyToClipboard(result: AnalysisResult | AnalysisResultV1): Promise<void> {
  try {
    const json = exportToJSON(result);
    await Clipboard.setStringAsync(json);
    Logger.pose.info('Analysis result copied to clipboard');
  } catch (error) {
    Logger.pose.error('Failed to copy to clipboard', { error: String(error) });
    throw error;
  }
}
