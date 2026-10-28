// The legacy build includes the polyfills needed by older iOS Safari versions.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PreviewDocument {
  numPages: number;
  renderPage(pageNumber: number, canvas: HTMLCanvasElement, cssWidth: number): Promise<void>;
  destroy(): Promise<void>;
}

/**
 * Opens a generated PDF for preview. The bytes are copied because PDF.js
 * transfers the buffer to its worker; nothing is fetched from the network.
 */
export async function openPreview(bytes: Uint8Array): Promise<PreviewDocument> {
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    disableFontFace: false,
    useSystemFonts: false,
    enableXfa: false,
    stopAtErrors: false,
  });
  const doc = await task.promise;
  return {
    numPages: doc.numPages,
    async renderPage(pageNumber, canvas, cssWidth) {
      const page = await doc.getPage(pageNumber);
      const unscaled = page.getViewport({ scale: 1 });
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      const scale = (cssWidth / unscaled.width) * ratio;
      const viewport = page.getViewport({ scale });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
      await page.render({ canvas, viewport }).promise;
      page.cleanup();
    },
    async destroy() {
      await task.destroy();
    },
  };
}
