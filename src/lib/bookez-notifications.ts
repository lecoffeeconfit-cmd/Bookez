import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const BOOKEZ_NOTIFICATION_CHANNEL_ID = 'bookez-writing';
const BOOKEZ_NOTIFICATION_PREFIX = 'bookez-writing-reminder:';

export type BookezWritingReminder = {
  id: string;
  label: string;
  time: string;
  days: number[];
  enabled: boolean;
  book?: BookezNotificationBook;
};

export type BookezNotificationBook = {
  title: string;
  progressPercent: number;
  wordCount: number;
  nextPartTitle?: string;
  nextPartKey?: string;
  manuscriptComplete: boolean;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestBookezNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(BOOKEZ_NOTIFICATION_CHANNEL_ID, {
      name: 'Bookez writing reminders',
      description: 'Gentle reminders to keep your books moving.',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#8B8AE8',
      sound: 'default',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const currentProvisional = Platform.OS === 'ios' && current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (current.status === Notifications.PermissionStatus.GRANTED || currentProvisional) return true;

  const requested = await Notifications.requestPermissionsAsync();
  if (requested.status === Notifications.PermissionStatus.GRANTED) return true;
  return Platform.OS === 'ios' && requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

const parseReminderTime = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim());
  if (!match) return null;
  const rawHour = Number(match[1]);
  const minute = Number(match[2]);
  if (rawHour < 1 || rawHour > 12 || minute > 59) return null;
  const hour = rawHour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return { hour, minute };
};

const notificationCopy = (book: BookezNotificationBook) => {
  if (book.manuscriptComplete) {
    return {
      body: `${book.title} is complete. Open Bookez for a calm final read-through.`,
    };
  }
  if (!book.wordCount) {
    return {
      body: `${book.nextPartTitle ?? 'Your next page'} is waiting. Even fifteen focused minutes can move this book forward.`,
    };
  }
  return {
    body: `${book.progressPercent}% complete · ${book.nextPartTitle ?? 'your next page'} is waiting. Open Bookez and make one small step.`,
  };
};

async function cancelBookezWritingNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => notification.identifier.startsWith(BOOKEZ_NOTIFICATION_PREFIX))
      .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)),
  );
}

export async function syncBookezWritingNotifications({
  enabled,
  reminders,
  book,
}: {
  enabled: boolean;
  reminders: BookezWritingReminder[];
  book: BookezNotificationBook;
}): Promise<void> {
  if (Platform.OS === 'web') return;

  await cancelBookezWritingNotifications();
  if (!enabled) return;

  let permission = await Notifications.getPermissionsAsync();
  let provisional = Platform.OS === 'ios' && permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (permission.status === Notifications.PermissionStatus.UNDETERMINED) {
    const granted = await requestBookezNotificationPermissions();
    if (!granted) return;
    permission = await Notifications.getPermissionsAsync();
    provisional = Platform.OS === 'ios' && permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }
  if (permission.status !== Notifications.PermissionStatus.GRANTED && !provisional) return;

  const schedules = reminders.flatMap((reminder) => {
    const parsedTime = parseReminderTime(reminder.time);
    if (!reminder.enabled || !parsedTime || !reminder.days.length) return [];
    const reminderBook = reminder.book ?? book;
    const copy = notificationCopy(reminderBook);
    return reminder.days.map((day) => ({
      identifier: `${BOOKEZ_NOTIFICATION_PREFIX}${reminder.id}:${day}`,
      content: {
        title: `Bookez · ${reminder.label.trim() || 'Writing session'}`,
        body: copy.body,
        sound: 'default' as const,
        data: {
          destination: 'write',
          projectTitle: reminderBook.title,
          partKey: reminderBook.nextPartKey,
          source: 'writing-reminder',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        channelId: BOOKEZ_NOTIFICATION_CHANNEL_ID,
        weekday: day + 1,
        hour: parsedTime.hour,
        minute: parsedTime.minute,
      },
    }));
  });

  await Promise.all(schedules.map((schedule) => Notifications.scheduleNotificationAsync(schedule)));
}
