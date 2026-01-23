import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as jwt from 'jsonwebtoken';

admin.initializeApp();

interface InviteData {
  organizationId: string;
}

export const generateInviteLink = functions.https.onCall(
  async (data: InviteData, context: functions.https.CallableContext) => {
    const { organizationId } = data;

    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Требуется вход');
    }

    const userId = context.auth.uid;

    const orgDoc = await admin.firestore().collection('organizations').doc(organizationId).get();
    if (!orgDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Организация не найдена');
    }

    const memberSnapshot = await admin
      .firestore()
      .collection('organization_members')
      .where('organization_id', '==', organizationId)
      .where('user_id', '==', userId)
      .get();

    if (memberSnapshot.empty) {
      throw new functions.https.HttpsError('permission-denied', 'Нет доступа');
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new functions.https.HttpsError('internal', 'JWT_SECRET не задан');
    }

    const token = jwt.sign(
      { orgId: organizationId, type: 'invite' },
      jwtSecret,
      { expiresIn: '24h' }
    );

    const inviteLink = `${process.env.REACT_APP_BASE_URL || 'http://localhost:3000'}/invite/${token}`;

    return { invite_link: inviteLink };
  }
);