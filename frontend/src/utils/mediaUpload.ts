export type UploadableFile = {
  uri?: string;
  name?: string;
  type?: string;
  mimeType?: string;
};

const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

const readNativeLocalFile = async (uri: string) => {
  const { File } = require('expo-file-system');
  const file = new File(uri);

  return file.arrayBuffer();
};

export const getUploadContentType = (file: UploadableFile) => file.type || file.mimeType || 'application/octet-stream';

export const getUploadExtension = (file: UploadableFile, fallback = 'bin') => {
  const cleanName = file.name?.split('?')[0];
  const cleanUri = file.uri?.split('?')[0];
  const ext = cleanName?.split('.').pop() || cleanUri?.split('.').pop();

  return ext && ext !== cleanName && ext !== cleanUri ? ext : fallback;
};

export const normalizeUploadBody = async (file: UploadableFile | Blob | ArrayBuffer | Uint8Array) => {
  if (file && typeof Blob !== 'undefined' && file instanceof Blob) {
    return file;
  }

  if (file instanceof ArrayBuffer || file instanceof Uint8Array) {
    return file;
  }

  const uri = (file as UploadableFile)?.uri;
  if (!uri) {
    return file;
  }

  if (isReactNative && !uri.startsWith('http://') && !uri.startsWith('https://')) {
    return readNativeLocalFile(uri);
  }

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Could not read local media file for upload.');
  }

  return response.blob();
};
