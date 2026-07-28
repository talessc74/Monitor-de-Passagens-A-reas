import type { NotificationLog } from '@mpa/types';
import { db, COLLECTIONS } from '../firestore.js';

const collection = () => db.collection(COLLECTIONS.notifications);

export async function listNotifications(): Promise<NotificationLog[]> {
  const snapshot = await collection().orderBy('sentAt', 'desc').limit(100).get();
  return snapshot.docs.map((doc) => doc.data() as NotificationLog);
}

export async function createNotification(notification: NotificationLog): Promise<NotificationLog> {
  await collection().doc(notification.id).set(notification);
  return notification;
}

export async function clearNotifications(): Promise<void> {
  const snapshot = await collection().get();
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}
