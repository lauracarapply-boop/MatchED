import { NextRequest, NextResponse } from 'next/server';

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAIL || process.env.ADMIN_EMAILS || '';
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 });
    }

    const adminEmails = getAdminEmails();
    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret) {
      return NextResponse.json({ error: 'Servidor não configurado' }, { status: 500 });
    }

    const emailMatch = adminEmails.includes(email.toLowerCase());
    const passwordMatch = password === adminSecret;

    if (!emailMatch || !passwordMatch) {
      return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 });
    }

    const response = NextResponse.json({ message: 'Autenticado com sucesso' });
    response.cookies.set({
      name: 'admin_token',
      value: adminSecret,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24h
    });

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
