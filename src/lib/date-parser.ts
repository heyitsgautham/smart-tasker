import * as chrono from 'chrono-node';

export interface ParsedDateInfo {
    text: string;
    start: number;
    end: number;
    date: Date;
}

/**
 * Parse natural language dates and times from text
 * Examples: "tomorrow at 3pm", "next monday", "jan 15", "in 2 hours"
 */
export function parseDatesFromText(text: string): ParsedDateInfo[] {
    const results = chrono.parse(text);

    return results.map(result => {
        // Trim the detected text to remove any extra whitespace or characters
        const trimmedText = result.text.trim();
        const leadingSpaces = result.text.length - result.text.trimStart().length;

        return {
            text: trimmedText,
            start: result.index + leadingSpaces,
            end: result.index + leadingSpaces + trimmedText.length,
            date: result.start.date(),
        };
    });
}

/**
 * Get the most relevant date from parsed results
 * (usually the first one, or the one closest to the cursor)
 */
export function getMostRelevantDate(parsedDates: ParsedDateInfo[]): ParsedDateInfo | null {
    if (parsedDates.length === 0) return null;
    // Return the last detected date (most recent in the text)
    return parsedDates[parsedDates.length - 1];
}

/**
 * Remove date text from the description
 */
export function removeDateFromText(text: string, dateInfo: ParsedDateInfo): string {
    return (text.slice(0, dateInfo.start) + text.slice(dateInfo.end)).trim();
}
