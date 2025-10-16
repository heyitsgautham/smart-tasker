import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/app/actions';

// Helper function to get the base URL for redirects
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || '';
  const protocol = request.headers.get('x-forwarded-proto') || 'http';

  // Normalize 0.0.0.0 to localhost for redirects
  const normalizedHost = host.replace('0.0.0.0', 'localhost');

  return `${protocol}://${normalizedHost}`;
}

export async function GET(request: NextRequest) {
  console.log('🔵 OAuth callback route hit');

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // This is the userId
  const error = searchParams.get('error');

  console.log('📥 Callback parameters:', {
    hasCode: !!code,
    hasState: !!state,
    error: error,
    fullUrl: request.url
  });

  const baseUrl = getBaseUrl(request);

  // Handle OAuth errors
  if (error) {
    console.error('❌ Google OAuth error:', error);
    return NextResponse.redirect(
      `${baseUrl}/profile?error=${encodeURIComponent('Failed to connect Google Calendar')}`
    );
  }

  // Validate required parameters
  if (!code || !state) {
    console.error('❌ Missing code or state in OAuth callback');
    return NextResponse.redirect(
      `${baseUrl}/profile?error=invalid_callback`
    );
  }

  console.log('✅ Code and state present, attempting token exchange...');

  try {
    // Exchange the authorization code for tokens
    const result = await exchangeCodeForTokens(state, code);

    console.log('📊 Token exchange result:', { success: result.success, error: result.error });

    if (result.success) {
      // Redirect back to profile page with success message
      console.log('✅ Success! Redirecting to profile...');
      return NextResponse.redirect(
        `${baseUrl}/profile?calendar_connected=true`
      );
    } else {
      // Redirect with error message
      console.error('❌ Token exchange failed:', result.error);
      return NextResponse.redirect(
        `${baseUrl}/profile?error=${encodeURIComponent(result.error || 'Unknown error')}`
      );
    }
  } catch (error) {
    console.error('❌ Error in OAuth callback handler:', error);
    return NextResponse.redirect(
      `${baseUrl}/profile?error=callback_failed`
    );
  }
}
