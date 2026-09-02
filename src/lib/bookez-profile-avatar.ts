import { BookezImageModerationError, bookezImageModerationErrorMessage, pickModeratedBookezImage } from './bookez-image-moderation';

export type BookezProfileAvatarResult = {
  path: string;
  previewUri: string;
};

export async function moderateAndUploadBookezProfileAvatar(userId: string): Promise<BookezProfileAvatarResult | null> {
  const result = await pickModeratedBookezImage({ userId, purpose: 'profile-photo' });
  if (!result) return null;
  if (!result.storagePath) throw new BookezImageModerationError('avatar_profile_unavailable');
  return { path: result.storagePath, previewUri: result.asset.uri };
}

export function profileAvatarErrorMessage(error: unknown) {
  return bookezImageModerationErrorMessage(error);
}
