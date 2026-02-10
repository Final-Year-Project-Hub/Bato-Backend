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
        const googleId = profile.id;
        const name = profile.displayName;
        const image = profile.photos?.[0]?.value;

        if (!email) return done(null, false);

        let user = await prisma.user.findUnique({ where: { email } });

        if (user) {
          if (!user.googleId) {
            user = await prisma.user.update({
              where: { email },
              data: {
                googleId,
                emailVerified: true,
                name: user.name ?? name,
                image: user.image ?? image,
              },
            });
          }
          return done(null, user);
        }

      
        user = await prisma.user.create({
          data: {
            email,
            name,
            image,
            googleId,
            emailVerified: true,
          },
        });

        return done(null, user);
      } catch (err) {
        return done(err as any, false);
      }
    }
  )
);
