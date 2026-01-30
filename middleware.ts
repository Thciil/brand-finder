import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  // Skip auth for API endpoints (they handle their own CORS)
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const auth = req.headers.get('authorization');

  if (!auth) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Sponsor Pathfinder Dashboard"',
      },
    });
  }

  const [type, credentials] = auth.split(' ');

  if (type !== 'Basic' || !credentials) {
    return new NextResponse('Invalid authentication', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Sponsor Pathfinder Dashboard"',
      },
    });
  }

  try {
    const decoded = Buffer.from(credentials, 'base64').toString('utf-8');
    const [username, password] = decoded.split(':');

    const expectedPassword = process.env.DASHBOARD_PASSWORD || 'demo';

    if (password === expectedPassword) {
      return NextResponse.next();
    }
  } catch (error) {
    // Invalid base64 or other error
  }

  return new NextResponse('Authentication failed', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Sponsor Pathfinder Dashboard"',
    },
  });
}

export const config = {
  matcher: ['/', '/companies/:path*'],
};
