import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "./prisma";


passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
      callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`,
    },
    async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
      try {
        const email = profile.emails?.[0].value;

        if (!email) return done(null, false);

        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name: profile.displayName,
              image: profile.photos?.[0].value,
              googleId: profile.id,
              emailVerified: true,
            },
          });
        }

        done(null, user);
      } catch (err) {
        done(err, false);
      }
    }
  )
);
