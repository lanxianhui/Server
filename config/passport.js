'use strict'

const LocalStrategy = require('passport-local').Strategy
const GoogleStrategy = require('passport-google-oauth20').Strategy
const FacebookStrategy = require('passport-facebook').Strategy
const TwitterStrategy = require('passport-twitter').Strategy
const GoogleTokenStrategy = require('passport-google-id-token')
const FacebookTokenStrategy = require('passport-facebook-token')
const TwitterTokenStrategy = require('passport-twitter-token')
const sanitize = require('mongo-sanitize')
const debug = require('debug')('tracman-passport')
const env = require('./env/env.js')
const mw = require('./middleware.js')
const User = require('./models.js').user

module.exports = (passport) => {

  // Serialize/deserialize users
  passport.serializeUser((user, done) => {
    done(null, user.id)
  })
  passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
      if (err) done(err)
      else done(null, user)
    })
  })

  // Local
  passport.use('local', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true
  }, async (req, email, password, done) => {
    debug(`Perfoming local login for ${email}`)
    try {
      let user = await User.findOne({'email': sanitize(email)})

      // No user with that email
      if (!user) {
        debug(`No user with that email`)
        return done(null, false, req.flash('warning', 'Incorrect email or password.'))

      // User exists
      } else {
        debug(`User exists. Checking password...`)

        // Check password
        let correct_password = await user.validPassword(password)

        // Password incorrect
        if (!correct_password) {
          debug(`Incorrect password`)
          return done(null, false, req.flash('warning', 'Incorrect email or password.'))

        // Successful login
        } else {
          user.isNewUser = !Boolean(user.lastLogin)
          user.lastLogin = Date.now()
          user.save()
          return done(null, user)
        }


      }
    } catch (err) {
      return done(err)
    }
  }
  ))

  // Social login
  async function socialLogin(req, service, profileId, done) {
    debug(`socialLogin() called for ${service} account ${profileId}`)
    let query = {}
    query['auth.' + service] = profileId

    // Intent to log in
    if (!req.user) {
      debug(`Searching for user with query ${query}...`)
      try {
        let user = await User.findOne(query)

        // Can't find user
        if (!user) {
          // Lazy update from old googleId field
          if (service === 'google') {
            try {
              let user = await User.findOne({ 'googleID': parseInt(profileId, 10) })

              // User exists with old schema
              if (user) {
                debug(`User ${user.id} exists with old schema.  Lazily updating...`)
                user.auth.google = profileId
                user.googleId = undefined
                try {
                  await user.save()
                  debug(`Lazily updated ${user.id}...`)
                  req.session.flashType = 'success'
                  req.session.flashMessage = 'You have been logged in. '
                  return done(null, user)
                } catch (err) {
                  debug(`Failed to save user that exists with old googleId schema!`)
                  mw.throwErr(err, req)
                  return done(err)
                }

              // No such user
              } else {
                debug(`User with ${service} account of ${profileId} not found.`)
                req.flash('warning', `There's no user for that ${service} account. `)
                return done()
              }
            } catch (err) {
              debug(`Failed to search for user with old googleID of ${profileId}. `)
              mw.throwErr(err, req)
              return done(err)
            }

          // No googleId either
          } else {
            debug(`Couldn't find ${service} user with profileID ${profileId}.`)
            req.flash('warning', `There's no user for that ${service} account. `)
            return done()
          }

        // Successfull social login
        } else {
          debug(`Found user: ${user.id}; logging in...`)
          req.session.flashType = 'success'
          req.session.flashMessage = 'You have been logged in.'
          return done(null, user)
        }
      } catch (err) {
        debug(`Failed to find user with query: ${query}`)
        mw.throwErr(err, req)
        return done(err)
      }

    // Intent to connect account
    } else {
      debug(`Attempting to connect ${service} account to ${req.user.id}...`)

      // Check for unique profileId
      debug(`Checking for unique account with query ${query}...`)
      try {
        let existing_user = await User.findOne(query)

        // Social account already in use
        if (existing_user) {
          debug(`${service} account already in use with user ${existing_user.id}`)
          req.session.flashType = 'warning'
          req.session.flashMessage = `Another user is already connected to that ${service} account. `
          return done()

        // Connect to account
        } else {
          debug(`${service} account (${profileId}) is unique; Connecting to ${req.user.id}...`)
          req.user.auth[service] = profileId
          try {
            await req.user.save()
            debug(`Successfully connected ${service} account to ${req.user.id}`)
            req.session.flashType = 'success'
            req.session.flashMessage = `${mw.capitalize(service)} account connected. `
            return done(null, req.user)
          } catch (err) {
            debug(`Failed to connect ${service} account to ${req.user.id}!`)
            return done(err)
          }
        }
      } catch (err) {
        debug(`Failed to check for unique ${service} profileId of ${profileId}!`)
        mw.throwErr(err, req)
        return done(err)
      }
    }
  }

  // Google
  passport.use('google', new GoogleStrategy({
    clientID: env.googleClientId,
    clientSecret: env.googleClientSecret,
    callbackURL: env.url + '/login/google/cb',
    passReqToCallback: true
  }, (req, accessToken, refreshToken, profile, done) => {
    socialLogin(req, 'google', profile.id, done)
  }
  )).use('google-token', new GoogleTokenStrategy({
    clientID: env.googleClientId,
    passReqToCallback: true
  }, (req, parsedToken, googleId, done) => {
    socialLogin(req, 'google', googleId, done)
  }
  ))

  // Facebook
  passport.use('facebook', new FacebookStrategy({
    clientID: env.facebookAppId,
    clientSecret: env.facebookAppSecret,
    callbackURL: env.url + '/login/facebook/cb',
    passReqToCallback: true
  }, (req, accessToken, refreshToken, profile, done) => {
    socialLogin(req, 'facebook', profile.id, done)
  }
  )).use('facebook-token', new FacebookTokenStrategy({
    clientID: env.facebookAppId,
    clientSecret: env.facebookAppSecret,
    passReqToCallback: true
  }, (req, accessToken, refreshToken, profile, done) => {
    socialLogin(req, 'facebook', profile.id, done)
  }
  ))

  // Twitter
  passport.use(new TwitterStrategy({
    consumerKey: env.twitterConsumerKey,
    consumerSecret: env.twitterConsumerSecret,
    callbackURL: env.url + '/login/twitter/cb',
    passReqToCallback: true
  }, (req, token, tokenSecret, profile, done) => {
    socialLogin(req, 'twitter', profile.id, done)
  }
  )).use('twitter-token', new TwitterTokenStrategy({
    consumerKey: env.twitterConsumerKey,
    consumerSecret: env.twitterConsumerSecret,
    passReqToCallback: true
  }, (req, token, tokenSecret, profile, done) => {
    socialLogin(req, 'twitter', profile.id, done)
  }
  ))

  return passport
}
