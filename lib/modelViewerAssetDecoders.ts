const MESHOPT_DECODER_URL = "/model-viewer/meshopt-decoder-74188840.js";

type ModelViewerStaticConfig = CustomElementConstructor & {
  meshoptDecoderLocation?: string;
};

export function configureModelViewerAssetDecoders(): void {
  if (typeof window === "undefined") return;

  const modelViewerGlobal = window as Window & {
    ModelViewerElement?: { meshoptDecoderLocation?: string };
  };
  modelViewerGlobal.ModelViewerElement = {
    ...(modelViewerGlobal.ModelViewerElement ?? {}),
    meshoptDecoderLocation: MESHOPT_DECODER_URL
  };

  const ModelViewerElement = customElements.get("model-viewer") as
    | ModelViewerStaticConfig
    | undefined;
  if (ModelViewerElement) {
    ModelViewerElement.meshoptDecoderLocation = MESHOPT_DECODER_URL;
  }
}
