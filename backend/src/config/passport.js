const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { prisma } = require('./database');
const logger = require('./logger');

function setupPassport(app) {
  app.use(passport.initialize());

  // JWT Strategy
  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: process.env.JWT_SECRET || 'fallback_secret',
      },
      async (jwtPayload, done) => {
        try {
          const user = await prisma.user.findUnique({
            where: { id: jwtPayload.sub },
            select: { id: true, email: true, name: true, role: true, isActive: true },
          });
          if (!user || !user.isActive) return done(null, false);
          return done(null, user);
        } catch (err) {
          return done(err, false);
        }
      }
    )
  );

  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here') {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            let user = await prisma.user.findUnique({
              where: { googleId: profile.id },
            });

            if (!user) {
              // Check by email first
              const existingByEmail = await prisma.user.findUnique({
                where: { email: profile.emails[0].value },
              });

              if (existingByEmail) {
                user = await prisma.user.update({
                  where: { id: existingByEmail.id },
                  data: { googleId: profile.id },
                });
              } else {
                user = await prisma.user.create({
                  data: {
                    email: profile.emails[0].value,
                    name: profile.displayName,
                    googleId: profile.id,
                    role: 'CUSTOMER',
                  },
                });
              }
            }

            return done(null, user);
          } catch (err) {
            logger.error('Google OAuth error:', err);
            return done(err, false);
          }
        }
      )
    );
    logger.info('✅ Google OAuth strategy registered');
  } else {
    logger.warn('⚠️  Google OAuth not configured (placeholder credentials detected)');
  }
}

module.exports = { setupPassport };
