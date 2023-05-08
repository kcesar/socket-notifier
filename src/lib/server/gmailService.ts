import path from 'path';
import process from 'process';
import { Observable, Subject } from 'rxjs';
import { google } from 'googleapis';

const JWT = google.auth.JWT;

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.metadata'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'google-token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'google-credentials.json');

interface MailboxInfo {
  email: string,
  history: string,
  watchTime: number,
  gmail: ReturnType<typeof google.gmail>
};

export class GmailService {
  private readonly mailboxes: Record<string, MailboxInfo> = {};
  private readonly newMailSubject = new Subject<string>();

  get newMailStream(): Observable<string> {
    return this.newMailSubject;
  }

  /**
   * 
   * @param email 
   */
  async refreshInterest(email: string) {
    if (!this.mailboxes[email]) {
      const auth = new JWT({
        keyFile: CREDENTIALS_PATH,
        scopes: SCOPES,
        subject: email,
      });
  
      await auth.authorize();
      const gmail = google.gmail({ version: 'v1', auth });

      const profile = await gmail.users.getProfile({ userId: 'me' });
      this.mailboxes[email] = {
        email,
        gmail,
        history: profile.data.historyId!,
        watchTime: 0,
      }

      console.log('Now listening for emails to ' + email);
    }
    this.refreshWatch(this.mailboxes[email]);
  }

  /**
   * 
   * @param notification 
   * @returns 
   */
  async notify(notification: { emailAddress: string, historyId: string|number }) {
    const mailbox = this.mailboxes[notification.emailAddress];
    if (!mailbox) {
      console.log('Not listening for ' + notification.emailAddress);
      return;
    }

    const response = (await mailbox.gmail.users.history.list({ userId: 'me', startHistoryId: mailbox.history })).data;
    if ((response.history ?? []).flatMap(h => h.messagesAdded ?? []).length > 0) {
      this.newMailSubject.next(notification.emailAddress);
    }
    mailbox.history = response.historyId + '';
  }

  /**
   * 
   * @param mailbox 
   */
  private async refreshWatch(mailbox: MailboxInfo) {
    const res = await mailbox.gmail.users.watch({
      userId: 'me',
      requestBody: {
        'labelIds': ['INBOX'],
        topicName: process.env.GMAIL_NOTIFICATIONS_TOPIC,
      },
    });
    if (res.status !== 200) {
      throw new Error('Failed to subscribe to email updates for ' + mailbox.email + '\n' + JSON.stringify(res));
    }
    mailbox.watchTime = new Date().getTime();
  }

  static create() {
    if (process.env.NODE_ENV === 'development') {
      // In development mode, use a global variable so that the value
      // is preserved across module reloads caused by HMR (Hot Module Replacement).
      if (!global._devGmailService) {
        global._devGmailService = new GmailService();
      }
      return global._devGmailService;
    } else {
      // In production mode, it's best to not use a global variable.
      return new GmailService();
    }
  }
}