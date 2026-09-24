import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configurado = Boolean(url && chave)

// Links de convite/redefinição chegam como #access_token=...&type=invite.
// Guardamos o tipo ANTES do Supabase limpar o endereço.
const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
export const linkDeAcesso = {
  tipo: hash.get('type'),                         // 'invite' | 'recovery' | null
  erro: hash.get('error_description')?.replace(/\+/g, ' ') || null,
}
if (linkDeAcesso.erro) history.replaceState(null, '', window.location.pathname)

export const supabase = configurado
  ? createClient(url, chave, { auth: { persistSession: true, detectSessionInUrl: true } })
  : null

const traducoes = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Seu e-mail ainda não foi confirmado. Use o link do convite.',
  'New password should be different from the old password.': 'A nova senha precisa ser diferente da anterior.',
  'Password should be at least 6 characters.': 'A senha precisa ter pelo menos 6 caracteres.',
  'For security purposes, you can only request this after': 'Por segurança, aguarde alguns segundos antes de pedir de novo.',
  'Email link is invalid or has expired': 'Este link expirou ou já foi usado. Peça um novo.',
}

export function traduzirErro(erro) {
  const msg = erro?.message || String(erro || '')
  const chaveEncontrada = Object.keys(traducoes).find((k) => msg.startsWith(k))
  return chaveEncontrada ? traducoes[chaveEncontrada] : msg || 'Algo deu errado. Tente novamente.'
}
