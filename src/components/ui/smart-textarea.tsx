"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { parseDatesFromText, ParsedDateInfo } from '@/lib/date-parser';

interface SmartTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    onDateDetected?: (date: Date | null) => void;
}

export const SmartTextarea = React.forwardRef<HTMLTextAreaElement, SmartTextareaProps>(
    ({ className, value, onChange, onDateDetected, ...props }, forwardedRef) => {
        const [parsedDates, setParsedDates] = useState<ParsedDateInfo[]>([]);
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const highlightRef = useRef<HTMLDivElement>(null);

        // Parse dates from text whenever the value changes
        useEffect(() => {
            if (typeof value === 'string') {
                const dates = parseDatesFromText(value);
                setParsedDates(dates);

                // Notify parent of the most recent date
                if (onDateDetected) {
                    const mostRecentDate = dates.length > 0 ? dates[dates.length - 1].date : null;
                    onDateDetected(mostRecentDate);
                }
            }
        }, [value, onDateDetected]);

        // Synchronize scroll between textarea and highlight div
        const handleScroll = useCallback(() => {
            if (textareaRef.current && highlightRef.current) {
                highlightRef.current.scrollTop = textareaRef.current.scrollTop;
                highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
            }
        }, []);

        // Create highlighted HTML
        const createHighlightedHTML = useCallback(() => {
            if (typeof value !== 'string' || value === '') {
                return '';
            }

            let html = '';
            let lastIndex = 0;

            // Sort dates by their position in the text
            const sortedDates = [...parsedDates].sort((a, b) => a.start - b.start);

            sortedDates.forEach((dateInfo) => {
                // Add text before the date (invisible, just for spacing)
                const beforeText = value.slice(lastIndex, dateInfo.start);
                html += escapeHtml(beforeText);

                // Get the exact date text (already trimmed from parser)
                const dateText = value.slice(dateInfo.start, dateInfo.end);

                // Wrap each character individually to prevent overflow
                const highlightedChars = dateText.split('').map((char, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === dateText.length - 1;
                    let classes = 'bg-orange-600';
                    if (isFirst && isLast) {
                        classes += ' rounded';
                    } else if (isFirst) {
                        classes += ' rounded-l';
                    } else if (isLast) {
                        classes += ' rounded-r';
                    }
                    return `<span class="${classes}" style="color: transparent; padding: 2px 0;">${escapeHtml(char)}</span>`;
                }).join('');

                html += highlightedChars;

                lastIndex = dateInfo.end;
            });

            // Add remaining text
            html += escapeHtml(value.slice(lastIndex));

            // Replace newlines with <br> tags
            html = html.replace(/\n/g, '<br>');

            return html;
        }, [value, parsedDates]);

        return (
            <div className={cn(
                "relative w-full smart-textarea-container rounded-md border border-input bg-background",
                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
            )}>
                {/* Highlight layer - shows only background colors behind the text */}
                <div
                    ref={highlightRef}
                    className={cn(
                        "absolute inset-0 pointer-events-none overflow-hidden whitespace-pre-wrap break-words",
                        "px-3 py-2 text-sm",
                        "font-[inherit] leading-[inherit]"
                    )}
                    style={{
                        color: 'transparent',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                        lineHeight: '1.5rem',
                        zIndex: 0,
                    }}
                    dangerouslySetInnerHTML={{ __html: createHighlightedHTML() }}
                />

                {/* Actual textarea - has transparent background so highlights show through */}
                <textarea
                    ref={(node) => {
                        // @ts-ignore - assigning to readonly ref
                        textareaRef.current = node;
                        if (typeof forwardedRef === 'function') {
                            forwardedRef(node);
                        } else if (forwardedRef) {
                            // @ts-ignore - assigning to readonly ref
                            forwardedRef.current = node;
                        }
                    }}
                    className={cn(
                        "relative resize-none w-full bg-transparent",
                        "min-h-[80px] px-3 py-2 text-sm text-foreground",
                        "placeholder:text-muted-foreground",
                        "focus-visible:outline-none border-0",
                        "disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                    style={{
                        lineHeight: '1.5rem',
                        zIndex: 1,
                    }}
                    value={value}
                    onChange={onChange}
                    onScroll={handleScroll}
                    {...props}
                />
            </div>
        );
    }
);

SmartTextarea.displayName = 'SmartTextarea';

// Helper function to escape HTML
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
