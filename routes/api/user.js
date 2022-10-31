const debug = require('debug')('app:api:user');
const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('config');
const validBody = require('../../middleware/validBody');
const validId = require('../../middleware/validId');
const { newId, insertUser, updateUser, getUserById, getUserByEmail, saveEdit } = require('../../database');

const registerSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().trim().min(8).required(),
  fullName: Joi.string().trim().min(1).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().trim().min(8).required(),
});

const updateSchema = Joi.object({
  password: Joi.string().trim().min(8),
  fullName: Joi.string().trim().min(1),
});

async function issueAuthToken(user) {
  const authPayload = {
    _id: user._id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };

  // get role names
  const roleNames = Array.isArray(user.role) ? user.role : [user.role];

  // get all of the roles in parallel
  const roles = await Promise.all(
    roleNames.map((roleName) => findRoleByName(roleName))
  );

  // combine the permission tables
  const permissions = {};
  for (const role of roles) {
    if (role && role.permissions) {
      for (const permission in role.permissions) {
        if (role.permissions[permission] === true) {
          permissions[permission] = true;
        }
      }
    }
  }

  // update the token payload
  authPayload.permissions = permissions;

  // issue token
  const authSecret = config.get('auth.secret');
  const authOptions = { expiresIn: config.get('auth.tokenExpiresIn') };
  const authToken = jwt.sign(authPayload, authSecret, authOptions);
  return authToken;
}

function setAuthCookie(res, authToken) {
  const cookieOptions = {
    httpOnly: true,
    maxAge: parseInt(config.get('auth.cookieMaxAge')),
  };
  res.cookie('authToken', authToken, cookieOptions);
}

const router = new express.Router();

router.post('/api/user/register', validBody(registerSchema), async (req, res, next) => {
  try {
    const user = { ...req.body, _id: newId(), createdDate: new Date(), role: 'customer' };

    // hash password
    const saltRounds = await bcrypt;
    user.password = await bcrypt.hash(user.password, parseInt(config.get('auth.saltRounds')));

    if (await getUserByEmail(user.email)) {
      res.status(400).json({ error: `email "${user.email}" is already in use!` });
    } else {
      const dbResult = await insertUser(user);
      debug('register result:', dbResult);

      const authToken = await issueAuthToken(user);
      setAuthCookie(res, authToken);

      res.json({ message: 'New User Registered!', userId: user._id, token: authToken });
    }
  } catch (err) {
    next(err);
  }
});
router.post('/api/user/login', validBody(loginSchema), async (req, res, next) => {
  try {
    const login = req.body;
    const user = await getUserByEmail(login.email);
    if (user && (await bcrypt.compare(login.password, user.password))) {
      
      const authToken = await issueAuthToken(user);
      setAuthCookie(res, authToken);

      res.json({ message: 'Welcome back!', userId: user._id, token: authToken });
    } else {
      res.status(400).json({ error: 'Invalid Credentials' });
    }
  } catch (err) {}
});
router.put('/api/user/me', validBody(updateSchema), async (req, res, next) => {
  // self-service update
  try {
    if (!req.auth) {
      return res.status(401).json({ error: 'You must be logged in!' });
    }

    const userId = newId(req.auth._id);
    const update = req.body;

    if (update.password) {
      const saltRounds = parseInt(config.get('auth.saltRounds'));
      update.password = await bcrypt.hash(update.password, saltRounds);
    }

    debugMain(update.password);

    const dbResult = await updateUser(userId, update);
    debug('update me result:', dbResult);

    const edit = {
      timestamp: new Date(),
      op: 'update',
      col: 'users',
      target: { userId },
      update,
      auth: req.auth,
    };
    await saveEdit(edit);
    debug('edit saved');

    const authToken = await issueAuthToken({ ...req.auth, ...update });
    setAuthCookie(res, authToken);

    res.json({ message: 'User Updated' });
  } catch (err) {
    next(err);
  }
});
router.put('/api/user/:userId', validId('userId'), validBody(updateSchema), async (req, res, next) => {
  // admin update
  try {
    const userId = req.userId;
    const update = req.body;

    if (update.password) {
      const saltRounds = parseInt(config.get('auth.saltRounds'));
      update.password = await bcrypt.hash(update.password, saltRounds);
    }

    const dbResult = await updateUser(userId, update);
    debug('update result:', dbResult);

    // issue new token when updating self
    let authToken;
    if (userId.equals(req.auth._id)) {
      authToken = await issueAuthToken({...req.auth,...update});
      setAuthCookie(res, authToken);
    }

    if (dbResult.matchedCount > 0) {
      res.json({ message: 'User Updated!', userId });
    } else {
      res.status(404).json({ error: 'User Not Found!' });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
