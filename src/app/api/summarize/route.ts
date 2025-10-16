import { NextRequest, NextResponse } from 'next/server';
import { summarizeTextFlow } from '@/ai/flows/summarize-text';

export async function POST(request: NextRequest) {
    try {
        const { text } = await request.json();

        if (!text || typeof text !== 'string') {
            return NextResponse.json(
                { error: 'Text is required' },
                { status: 400 }
            );
        }

        // If text is short enough, return it as-is
        if (text.length <= 100) {
            return NextResponse.json({ summary: text });
        }

        // Use AI to summarize
        const summary = await summarizeTextFlow({ text });

        return NextResponse.json({ summary });
    } catch (error) {
        console.error('Error in summarize API:', error);
        return NextResponse.json(
            { error: 'Failed to summarize text' },
            { status: 500 }
        );
    }
}
