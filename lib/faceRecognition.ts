import Human from '@vladmandic/human';

/**
 * Motor facial da Portaria.
 *
 * O reconhecimento é executado integralmente no navegador com @vladmandic/human.
 * Apenas os módulos necessários à identificação facial ficam habilitados:
 * detecção, rotação/alinhamento por mesh e embedding FaceRes.
 */

export const FACE_DESCRIPTOR_LENGTH = 1024;
export const DEFAULT_FACE_MATCH_THRESHOLD = 75;

export interface FaceDetectionResult {
  detected: boolean;
  box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  score: number;
  descriptor?: number[];
  thumbnailDataUrl?: string;
}

export interface VisitorMatchResult<T = any> {
  matched: boolean;
  visitor?: T;
  bestCandidate?: T;
  similarity: number;
  distance: number;
}

const human = new Human({
  backend: 'webgl',
  modelBasePath: '/models/',
  debug: false,
  cacheModels: true,
  filter: {
    enabled: true,
    equalization: true,
    flip: false
  },
  face: {
    enabled: true,
    detector: {
      enabled: true,
      rotation: true,
      maxDetected: 1,
      minConfidence: 0.5
    },
    mesh: {
      enabled: true
    },
    description: {
      enabled: true,
      minConfidence: 0.5
    },
    iris: {
      enabled: false
    },
    emotion: {
      enabled: false
    },
    antispoof: {
      enabled: false
    },
    liveness: {
      enabled: false
    },
    gear: {
      enabled: false
    }
  },
  body: {
    enabled: false
  },
  hand: {
    enabled: false
  },
  object: {
    enabled: false
  },
  segmentation: {
    enabled: false
  }
});

let initializationPromise: Promise<void> | null = null;

export const initializeFaceRecognition = async (): Promise<void> => {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await human.load();
      await human.warmup();
    })().catch(error => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
};

export const isFaceDescriptorValid = (descriptor?: number[] | null): descriptor is number[] => (
  Array.isArray(descriptor)
  && descriptor.length === FACE_DESCRIPTOR_LENGTH
  && descriptor.every(Number.isFinite)
);


export interface FaceEnrollmentResult {
  detected: boolean;
  descriptor?: number[];
  thumbnailDataUrl?: string;
  samplesCollected: number;
}

/**
 * Calcula o centróide L2-normalizado de múltiplos embeddings válidos.
 * Mantém um único faceDescriptor no schema existente.
 */
export const averageFaceDescriptors = (descriptors: number[][]): number[] | null => {
  const valid = descriptors.filter(isFaceDescriptorValid);
  if (valid.length === 0) return null;

  const average = new Array<number>(FACE_DESCRIPTOR_LENGTH).fill(0);
  for (const descriptor of valid) {
    for (let i = 0; i < FACE_DESCRIPTOR_LENGTH; i++) {
      average[i] += descriptor[i];
    }
  }

  let norm = 0;
  for (let i = 0; i < FACE_DESCRIPTOR_LENGTH; i++) {
    average[i] /= valid.length;
    norm += average[i] * average[i];
  }

  norm = Math.sqrt(norm);
  if (!Number.isFinite(norm) || norm <= 0) return null;

  for (let i = 0; i < FACE_DESCRIPTOR_LENGTH; i++) {
    average[i] /= norm;
  }

  return average;
};

const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

/**
 * Cadastro facial robusto: coleta várias leituras válidas por ~3 segundos
 * e salva somente o descritor médio normalizado.
 */
export const captureFaceEnrollment = async (
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  options?: {
    durationMs?: number;
    intervalMs?: number;
    minSamples?: number;
    maxSamples?: number;
    minimumConsistency?: number;
  }
): Promise<FaceEnrollmentResult> => {
  await initializeFaceRecognition();

  const durationMs = options?.durationMs ?? 3000;
  const intervalMs = options?.intervalMs ?? 300;
  const minSamples = options?.minSamples ?? 4;
  const maxSamples = options?.maxSamples ?? 8;
  const minimumConsistency = options?.minimumConsistency ?? 60;

  const descriptors: number[][] = [];
  let thumbnailDataUrl: string | undefined;
  const startedAt = Date.now();

  while (Date.now() - startedAt < durationMs && descriptors.length < maxSamples) {
    const detection = await extractFaceFromCanvasOrVideo(source);

    if (detection.detected && isFaceDescriptorValid(detection.descriptor)) {
      const candidate = detection.descriptor;
      const isConsistent = descriptors.length === 0
        || calculateFaceSimilarity(descriptors[0], candidate) >= minimumConsistency;

      if (isConsistent) {
        descriptors.push(candidate);
        if (detection.thumbnailDataUrl) thumbnailDataUrl = detection.thumbnailDataUrl;
      }
    }

    if (Date.now() - startedAt < durationMs && descriptors.length < maxSamples) {
      await wait(intervalMs);
    }
  }

  const descriptor = descriptors.length >= minSamples
    ? averageFaceDescriptors(descriptors)
    : null;

  if (!descriptor) {
    return {
      detected: false,
      thumbnailDataUrl,
      samplesCollected: descriptors.length
    };
  }

  return {
    detected: true,
    descriptor,
    thumbnailDataUrl,
    samplesCollected: descriptors.length
  };
};

const getSourceDimensions = (
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): { width: number; height: number } => {
  if (source instanceof HTMLVideoElement) {
    return {
      width: source.videoWidth || source.clientWidth || 0,
      height: source.videoHeight || source.clientHeight || 0
    };
  }

  if (source instanceof HTMLImageElement) {
    return {
      width: source.naturalWidth || source.width || 0,
      height: source.naturalHeight || source.height || 0
    };
  }

  return {
    width: source.width || 0,
    height: source.height || 0
  };
};

const createFaceThumbnail = (
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  box: [number, number, number, number]
): string | undefined => {
  if (typeof document === 'undefined') return undefined;

  const { width: sourceWidth, height: sourceHeight } = getSourceDimensions(source);
  if (!sourceWidth || !sourceHeight) return undefined;

  const [x, y, width, height] = box;
  if (width <= 0 || height <= 0) return undefined;

  const marginX = width * 0.12;
  const marginY = height * 0.12;
  const cropX = Math.max(0, x - marginX);
  const cropY = Math.max(0, y - marginY);
  const cropWidth = Math.min(sourceWidth - cropX, width + marginX * 2);
  const cropHeight = Math.min(sourceHeight - cropY, height + marginY * 2);

  if (cropWidth <= 0 || cropHeight <= 0) return undefined;

  const canvas = document.createElement('canvas');
  const targetSize = 224;
  canvas.width = targetSize;
  canvas.height = targetSize;

  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.drawImage(
    source,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    targetSize,
    targetSize
  );

  return canvas.toDataURL('image/jpeg', 0.82);
};

/**
 * Detecta uma única face e extrai o embedding neural FaceRes.
 * A função é assíncrona porque a inferência do modelo ocorre via Human/TFJS.
 */
export const extractFaceFromCanvasOrVideo = async (
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<FaceDetectionResult> => {
  try {
    await initializeFaceRecognition();

    const result = await human.detect(source);
    const face = result.face?.[0];

    if (!face || !isFaceDescriptorValid(face.embedding)) {
      return {
        detected: false,
        score: face?.score || 0
      };
    }

    const [x, y, width, height] = face.box;
    const thumbnailDataUrl = createFaceThumbnail(source, face.box);

    return {
      detected: true,
      score: face.score || face.boxScore || 0,
      box: {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height)
      },
      descriptor: Array.from(face.embedding),
      thumbnailDataUrl
    };
  } catch (error) {
    console.error('Erro no motor de reconhecimento facial:', error);
    return {
      detected: false,
      score: 0
    };
  }
};

/**
 * Retorna similaridade em percentual (0 a 100) para manter compatibilidade
 * com a interface atual da Portaria.
 */
export const calculateFaceSimilarity = (descA?: number[], descB?: number[]): number => {
  if (!isFaceDescriptorValid(descA) || !isFaceDescriptorValid(descB)) {
    return 0;
  }

  const similarity = human.match.similarity(descA, descB);
  if (!Number.isFinite(similarity)) return 0;

  return Math.max(0, Math.min(100, Math.round(similarity * 100)));
};

export const findBestFaceMatch = <T extends { faceDescriptor?: number[] }>(
  liveDescriptor: number[],
  registeredCandidates: T[],
  minimumThreshold = DEFAULT_FACE_MATCH_THRESHOLD
): VisitorMatchResult<T> => {
  if (!isFaceDescriptorValid(liveDescriptor)) {
    return {
      matched: false,
      similarity: 0,
      distance: 1
    };
  }

  let bestMatch: T | undefined;
  let maxSimilarity = 0;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const candidate of registeredCandidates) {
    if (!isFaceDescriptorValid(candidate.faceDescriptor)) continue;

    const similarity = calculateFaceSimilarity(liveDescriptor, candidate.faceDescriptor);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      bestMatch = candidate;

      const distance = human.match.distance(liveDescriptor, candidate.faceDescriptor);
      minDistance = Number.isFinite(distance) ? distance : 1;
    }
  }

  const matched = !!bestMatch && maxSimilarity >= minimumThreshold;

  return {
    matched,
    visitor: matched ? bestMatch : undefined,
    bestCandidate: bestMatch,
    similarity: maxSimilarity,
    distance: Number.isFinite(minDistance) ? minDistance : 1
  };
};
