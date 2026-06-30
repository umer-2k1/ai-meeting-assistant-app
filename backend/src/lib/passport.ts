import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as JWTStrategy, ExtractJwt } from 'passport-jwt';
import passport from 'passport';
import prisma from './prisma.js';
import { getGoogleRedirectUri, getJwtSecret } from './auth-config.js';
import type { User } from '@prisma/client';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = getGoogleRedirectUri();
const JWT_SECRET = getJwtSecret();

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn(
    '[auth] GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for Google sign-in.'
  );
}

// ========================================
// Google OAuth Strategy
// ========================================

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_REDIRECT_URI,
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const googleId = profile.id;
          const name = profile.displayName;
          const avatarUrl = profile.photos?.[0]?.value;

          if (!email) {
            return done(new Error('No email found in Google profile'), undefined);
          }

          let user = await prisma.user.findUnique({
            where: { googleId },
          });

          if (!user) {
            user = await prisma.user.findUnique({
              where: { email },
            });

            if (user) {
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  googleId,
                  googleEmail: email,
                  accessToken,
                  refreshToken,
                  avatarUrl: avatarUrl || user.avatarUrl,
                  lastLoginAt: new Date(),
                },
              });
            } else {
              user = await prisma.user.create({
                data: {
                  email,
                  googleId,
                  googleEmail: email,
                  name,
                  avatarUrl,
                  accessToken,
                  refreshToken,
                  lastLoginAt: new Date(),
                },
              });
            }
          } else {
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                accessToken,
                refreshToken,
                name: name || user.name,
                avatarUrl: avatarUrl || user.avatarUrl,
                lastLoginAt: new Date(),
              },
            });
          }

          return done(null, user);
        } catch (error) {
          console.error('Google OAuth error:', error);

          if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 'P2002'
          ) {
            return done(
              new Error(
                'This Google account is already linked to another user. Try signing in with a different account.'
              ),
              undefined
            );
          }

          return done(error as Error, undefined);
        }
      }
    )
  );
}

// ========================================
// JWT Strategy (for API authentication)
// ========================================

if (JWT_SECRET) {
  passport.use(
    new JWTStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: JWT_SECRET,
      },
      async (payload, done) => {
        try {
          const user = await prisma.user.findUnique({
            where: { id: payload.sub },
          });

          if (!user) {
            return done(null, false);
          }

          return done(null, user);
        } catch (error) {
          return done(error, false);
        }
      }
    )
  );
}

// ========================================
// Serialization (for sessions)
// ========================================

passport.serializeUser((user, done) => {
  done(null, (user as User).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
