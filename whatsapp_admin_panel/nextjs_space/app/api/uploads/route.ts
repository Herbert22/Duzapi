import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const BRIDGE_AUTH_TOKEN = process.env.BRIDGE_AUTH_TOKEN || '';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 });
    }

    // Forward to backend upload endpoint
    const backendFormData = new FormData();
    backendFormData.append('file', file);

    const response = await fetch(`${BACKEND_URL}/api/v1/admin/uploads/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BRIDGE_AUTH_TOKEN}`,
      },
      body: backendFormData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Upload failed' }));
      return NextResponse.json(
        { error: err.detail || 'Erro ao enviar arquivo' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erro ao processar upload' }, { status: 500 });
  }
}
