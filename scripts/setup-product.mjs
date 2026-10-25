// Cadastra o fatiador no Supabase da loja + sobe imagens locais pro bucket `media`
// Uso: node scripts/setup-product.mjs
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const ENV_PATH = 'C:/Users/Eduardo Daflon/Desktop/loja produtos/.env.local'

const env = Object.fromEntries(
  readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL
const SECRET = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY
if (!SUPA || !SECRET) throw new Error('SUPABASE_URL/SECRET ausentes no .env.local')

const SLUG = 'fatiador-multifuncional-14-em-1'
const PRODUCT = {
  slug: SLUG,
  sku: 'FAT-14EM1-BF01',
  name: 'Fatiador Multifuncional de Vegetais 14 em 1 com Cesto de Drenagem — Black Friday 50%',
  short_description: '8 lâminas intercambiáveis, pote coletor e cesto de drenagem — pique, fatie e rale em segundos, sem sujeira.',
  description: [
    'O Fatiador Multifuncional 14 em 1 é a ferramenta completa pra cozinha: 8 lâminas de aço inox intercambiáveis pra cortar em cubos (12x12 e 13x18mm), fatiar liso ou ondulado e ralar grosso ou fino — queijo, batata, cebola, cenoura, abobrinha, gengibre e até chocolate.',
    'Vem com pote coletor grande e cesto de drenagem: corta direto no recipiente, lava e escorre a água sem sujar mais nada. Também acompanha protetor de mãos, descascador, escova de limpeza e separador de ovos.',
    'Corpo em ABS resistente com pés antiderrapantes, recipiente em acrílico transparente e lâminas de aço inoxidável. Desmonta fácil pra limpeza e guarda tudo organizado dentro do próprio pote.',
  ].join('\n\n'),
  specs: [
    { key: 'Funções', value: '14 em 1 — corta em cubos, fatia, ondula, rala, descasca' },
    { key: 'Lâminas', value: '8 lâminas de aço inox intercambiáveis' },
    { key: 'Material', value: 'ABS + acrílico + inox — sem BPA' },
    { key: 'Medidas', value: '32 × 12 × 12 cm' },
    { key: 'Extras', value: 'Cesto de drenagem, protetor de mãos, descascador, escova e separador de ovos' },
    { key: 'Limpeza', value: 'Desmonta fácil — escova de limpeza inclusa' },
  ],
  status: 'published',
  tags: ['black-friday', 'cozinha', 'fatiador'],
  countries: ['BR'],
  price_cents: 4990,
  compare_at_cents: 9990,
  currency: 'BRL',
  stock: 500,
  track_stock: true,
  installments_max: 3,
  installments_free: true,
  rating_avg: 4.8,
  rating_count: 2130,
  seo_title: 'Fatiador Multifuncional 14 em 1 — Black Friday 50% OFF',
  seo_description: 'Fatiador de vegetais 14 em 1 com 8 lâminas, cesto de drenagem e pote coletor. De R$99,90 por R$49,90 na Black Friday.',
}

const headers = {
  apikey: SECRET,
  Authorization: `Bearer ${SECRET}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

async function api(path, opts = {}) {
  const res = await fetch(`${SUPA}/rest/v1${path}`, { ...opts, headers: { ...headers, ...(opts.headers || {}) } })
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const t = await res.text()
  return t ? JSON.parse(t) : null
}

let [existing] = await api(`/products?slug=eq.${SLUG}&select=id`)
let productId
if (existing) {
  productId = existing.id
  await api(`/products?id=eq.${productId}`, { method: 'PATCH', body: JSON.stringify(PRODUCT) })
  console.log('produto atualizado:', productId)
} else {
  const [row] = await api('/products', { method: 'POST', body: JSON.stringify(PRODUCT) })
  productId = row.id
  console.log('produto criado:', productId)
}

const mediaRows = []
for (let i = 1; i <= 5; i++) {
  const buf = readFileSync(join(ROOT, 'img', `fat${i}.webp`))
  const path = `fatiador/fat${i}.webp`
  const up = await fetch(`${SUPA}/storage/v1/object/media/${path}`, {
    method: 'POST',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'image/webp', 'x-upsert': 'true' },
    body: buf,
  })
  if (!up.ok) { console.warn('upload falhou:', up.status, (await up.text()).slice(0, 200)); continue }
  mediaRows.push({
    product_id: productId,
    url: `${SUPA}/storage/v1/object/public/media/${path}`,
    storage_path: `media/${path}`,
    kind: 'image',
    alt: `Fatiador Multifuncional 14 em 1 — foto ${i}`,
    sort: i - 1,
  })
}
if (mediaRows.length) {
  await api(`/product_media?product_id=eq.${productId}`, { method: 'DELETE' })
  await api('/product_media', { method: 'POST', body: JSON.stringify(mediaRows) })
  console.log(`${mediaRows.length} mídias vinculadas`)
}

console.log('\nPRODUCT_ID=' + productId)
