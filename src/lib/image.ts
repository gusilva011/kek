"use client";

/**
 * Conversão de arquivo de imagem do computador → data URL compactada.
 *
 * Redimensiona e comprime no navegador (via canvas) antes de salvar, para o
 * arquivo não pesar no JSON nem no WebSocket. Banners usam JPEG; o logo usa PNG
 * (preserva transparência) num tamanho menor.
 */

export interface ImageOptions {
  maxW?: number;
  maxH?: number;
  type?: "image/jpeg" | "image/png";
  quality?: number;
}

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB de entrada

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

function fit(w: number, h: number, maxW: number, maxH: number) {
  const ratio = Math.min(1, maxW / w, maxH / h);
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

export async function fileToDataUrl(file: File, opts: ImageOptions = {}): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Imagem muito grande (máx. 8 MB).");

  const { maxW = 1280, maxH = 720, type = "image/jpeg", quality = 0.82 } = opts;
  const img = await loadImage(file);
  const { width, height } = fit(img.naturalWidth, img.naturalHeight, maxW, maxH);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Falha ao processar a imagem.");
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL(type, quality);
}
