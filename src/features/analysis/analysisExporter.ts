/**
 * analysisExporter.ts
 * SwingSwang
 *
 * Export analysis results as JSON.
 */

import { AnalysisResult } from '../../types/analysis';
import * as Clipboard from 'expo-clipboard';
import { Logger } from '../../utils/logger';

/**
 * Export an AnalysisResult as pretty-printed JSON.
 */
export function exportToJSON(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Copy analysis result JSON to clipboard.
 */
export async function copyToClipboard(result: AnalysisResult): Promise<void> {
  try {
    const json = exportToJSON(result);
    await Clipboard.setStringAsync(json);
    Logger.pose.info('Analysis result copied to clipboard');
  } catch (error) {
    Logger.pose.error('Failed to copy to clipboard', { error: String(error) });
    throw error;
  }
}
