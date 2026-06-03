/** @type {import('next').NextConfig} */

// Cabeçalhos de segurança aplicados a todas as rotas. Endurece o app contra
// clickjacking, sniffing de MIME, vazamento de referer e carregamento de
// recursos de terceiros não confiáveis. A CSP permite o WebSocket do gateway
// (NEXT_PUBLIC_WS_URL) e imagens base64 (banners/branding enviados pelo admin).
const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000";
const wsConnect = `${wsUrl} ws://localhost:* wss://localhost:*`;

const csp = [
  "default-src 'self'",
  // Next em dev injeta scripts inline + eval (HMR). Em produção o ideal é
  // remover 'unsafe-eval'; mantido aqui para não quebrar o dev server.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // Escudos/bandeiras vêm de CDNs externas; imagens enviadas pelo admin são base64.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${wsConnect} https:`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig = {
  reactStrictMode: true,
  // Não revela a versão do Next no header (reduz fingerprinting).
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
