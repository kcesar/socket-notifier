import { sessionOptions } from '@/lib/session';
import { withIronSessionApiRoute } from 'iron-session/next';
import { NextApiRequest, NextApiResponse } from 'next';
import { TokenPayload } from 'google-auth-library';
import { getServices } from '@/lib/server/services';

async function apiLogin(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({message: 'Login requires POST'});
    return;
  }

  try {
    let payload: TokenPayload|undefined;
    if (process.env.DEV_NETWORK_DISABLED) {
      const data = process.env.DEV_AUTH_USER ?? '{}';
      console.log('login data', data);
      payload = JSON.parse(data);
    } else {
      const { token } = req.body;
      const authClient = (await getServices()).authClient;

      const ticket = await authClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_ID,
      });

      payload = ticket.getPayload();
    }
    
    if (!payload) {
      res.status(500).json({message: 'Could not get ticket'});
      return;
    }
    if (!payload.email) {
      res.status(500).json({message: 'Could not get user email'});
      return;
    }

    console.log('domains', process.env.ALLOWED_DOMAINS, payload.hd);
    if (!payload.hd || !process.env.ALLOWED_DOMAINS?.split(',').includes(payload.hd)) {
      res.status(403).json({message: 'Unauthorized domain'});
      return;
    }

    req.session.auth = {
      email: payload.email,
      userId: payload.sub,
      ...payload,
    };

    console.log(`Logging in user ${payload.email}`);
    await req.session.save();
    res.json(req.session.auth);
  } catch (error) {
    res.status(500).json({message: (error as Error).message });
  }
  res.end();
}

export default withIronSessionApiRoute(apiLogin, sessionOptions);