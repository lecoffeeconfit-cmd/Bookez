import { Alert } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { bookezSecureStorage } from './secure-storage';
import { supabase } from './supabase';

const MODERATION_NOTICE_KEY = 'bookez.image-moderation-notice.v1';
const MAX_CLIENT_BASE64_LENGTH = 2_800_000;

export type BookezImagePurpose = 'profile-photo' | 'book-cover' | 'book-image' | 'community-image';

export type PickModeratedBookezImageOptions = {
  userId?: string | null;
  purpose: BookezImagePurpose;
  projectId?: string | null;
  permissionMessage?: string;
};

export type ModeratedBookezImage = {
  asset: ImagePickerAsset;
  storagePath?: string;
};

export class BookezImageModerationError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.name = 'BookezImageModerationError';
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object';

const normalizeBase64Image = (value: string | undefined) => {
  if (!value) return '';
  const comma = value.indexOf(',');
  const payload = value.startsWith('data:') && comma >= 0 ? value.slice(comma + 1) : value;
  return payload.replace(/\s/g, '');
};

const errorCodeFromPayload = (value: unknown): string | null => {
  if (!isRecord(value)) return null;
  const candidate = typeof value.code === 'string' ? value.code : typeof value.error === 'string' ? value.error : null;
  return candidate && /^avatar_[a-z0-9_]+$/.test(candidate) ? candidate : null;
};

async function errorCodeFromFunctionError(error: unknown): Promise<string | null> {
  if (isRecord(error)) {
    const context = error.context;
    if (isRecord(context) && typeof context.json === 'function') {
      try {
        const payload = await (context.json as () => Promise<unknown>)();
        const code = errorCodeFromPayload(payload);
        if (code) return code;
      } catch {
        // The response body is optional; fall back to the safe generic error.
      }
    }
  }
  return errorCodeFromPayload(error);
}

async function confirmModerationNotice() {
  if (await bookezSecureStorage.getItem(MODERATION_NOTICE_KEY) === 'accepted') return true;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (accepted: boolean) => {
      if (settled) return;
      settled = true;
      resolve(accepted);
    };

    Alert.alert(
      'Image safety',
      'Your selected image will be sent to OpenAI to screen it for harmful content before it is saved to Bookez. Continue to agree.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => finish(false) },
        {
          text: 'Continue',
          onPress: () => {
            void bookezSecureStorage.setItem(MODERATION_NOTICE_KEY, 'accepted');
            finish(true);
          },
        },
      ],
      { cancelable: true, onDismiss: () => finish(false) },
    );
  });
}

async function invokeModeration(options: PickModeratedBookezImageOptions, imageBase64: string, accessToken: string) {
  const { data, error } = await supabase.functions.invoke<{ allowed?: unknown; storagePath?: unknown }>('moderate-image', {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      imageBase64,
      mimeType: 'image/jpeg',
      purpose: options.purpose,
      moderationNoticeAccepted: true,
      ...(options.projectId ? { projectId: options.projectId } : {}),
    },
  });

  if (error) {
    const code = await errorCodeFromFunctionError(error);
    throw new BookezImageModerationError(code ?? 'avatar_moderation_unavailable');
  }

  if (!isRecord(data) || data.allowed !== true) throw new BookezImageModerationError('avatar_moderation_unavailable');
  const storagePath = typeof data.storagePath === 'string' ? data.storagePath : undefined;
  return storagePath;
}

const imageAssetFromResult = (asset: ImagePickerAsset, processed: { uri: string; width: number; height: number }) => ({
  ...asset,
  uri: processed.uri,
  width: processed.width,
  height: processed.height,
  mimeType: 'image/jpeg',
  fileName: `bookez-${Date.now()}.jpg`,
  fileSize: undefined,
  base64: undefined,
});

export async function pickModeratedBookezImage(options: PickModeratedBookezImageOptions): Promise<ModeratedBookezImage | null> {
  let imagePickerModule: typeof import('expo-image-picker');
  let imageManipulatorModule: typeof import('expo-image-manipulator');
  try {
    [imagePickerModule, imageManipulatorModule] = await Promise.all([
      import('expo-image-picker'),
      import('expo-image-manipulator'),
    ]);
  } catch {
    throw new BookezImageModerationError('avatar_image_processing_unavailable');
  }

  const permission = await imagePickerModule.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Photo access needed', options.permissionMessage ?? 'Allow Bookez to access your photos so you can choose an image.');
    return null;
  }

  const result = await imagePickerModule.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: options.purpose === 'profile-photo' ? [1, 1] : undefined,
    quality: 0.9,
    selectionLimit: 1,
  });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;

  // Local-only books have no authenticated server to call. Preserve that
  // existing offline workflow; every image that is sent to storage is still
  // required to take the moderated path below.
  if (!options.userId) return { asset };
  if (!await confirmModerationNotice()) return null;

  let processed: { uri: string; width: number; height: number; base64?: string };
  try {
    processed = await imageManipulatorModule.manipulateAsync(
      asset.uri,
      [{ resize: { width: 512 } }],
      { base64: true, compress: 0.82, format: imageManipulatorModule.SaveFormat.JPEG },
    );
  } catch {
    throw new BookezImageModerationError('avatar_image_processing_unavailable');
  }

  const imageBase64 = normalizeBase64Image(processed.base64);
  if (!imageBase64 || imageBase64.length > MAX_CLIENT_BASE64_LENGTH) {
    throw new BookezImageModerationError('avatar_image_too_large');
  }

  const sessionResult = await supabase.auth.getSession();
  let session = sessionResult.data.session;
  if (!session || session.user.id !== options.userId) throw new BookezImageModerationError('avatar_authentication_required');

  let storagePath: string | undefined;
  try {
    storagePath = await invokeModeration(options, imageBase64, session.access_token);
  } catch (caught) {
    const code = caught instanceof BookezImageModerationError ? caught.code : await errorCodeFromFunctionError(caught);
    if (code !== 'avatar_authentication_required') throw new BookezImageModerationError(code ?? 'avatar_moderation_unavailable');

    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session;
    if (refreshed.error || !session || session.user.id !== options.userId) throw new BookezImageModerationError('avatar_authentication_required');
    storagePath = await invokeModeration(options, imageBase64, session.access_token);
  }

  return { asset: imageAssetFromResult(asset, processed), storagePath };
}

export function bookezImageModerationErrorMessage(error: unknown) {
  const code = error instanceof BookezImageModerationError ? error.code : '';
  switch (code) {
    case 'avatar_rejected':
      return 'That image could not be approved for Bookez. Please choose another image.';
    case 'avatar_rate_limited':
      return 'You have tried several images recently. Please wait a few minutes and try again.';
    case 'avatar_image_too_large':
      return 'That image is too large to process. Please choose a smaller image.';
    case 'avatar_image_processing_unavailable':
      return 'Bookez could not prepare that image. Please try another one.';
    case 'avatar_image_invalid':
      return 'That image could not be read. Please choose another one.';
    case 'avatar_request_invalid':
      return 'Bookez could not process that image. Please try again.';
    case 'avatar_authentication_required':
      return 'Please sign in again before saving this image.';
    case 'avatar_project_required':
    case 'avatar_project_unavailable':
    case 'avatar_profile_unavailable':
    case 'avatar_storage_unavailable':
    case 'avatar_moderation_configuration':
    case 'avatar_moderation_unavailable':
      return 'Image safety checks are temporarily unavailable. Please try again shortly.';
    default:
      return error instanceof Error && error.message ? error.message : 'Please try again.';
  }
}
