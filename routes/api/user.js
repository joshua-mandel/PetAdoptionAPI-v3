const debug = require('debug')('app:api:user');
const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('config');
const validBody = require('../../middleware/validBody');
const { newId, insertUser, updateUser, getUserById, getUserByEmail } = require('../../database');

const registerSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().trim().min(8).required(),
  fullName: Joi.string().trim().min(1).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().trim().min(8).required(),
});

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

      // issue token
      const authPayload = {
        _id: user._id,
        role: user.role,
        email: user.email,
        fullName: user.fullName,
      };

      const authSecret = config.get('auth.secret');
      const authOptions = { expiresIn: config.get('auth.tokenExpiresIn') };
      const authToken = jwt.sign(authPayload, authSecret, authOptions);

      // create a cookie
      const cookieOptions = { httpOnly: true, maxAge: parseInt(config.get('auth.cookieMaxAge')) };
      res.cookie('authToken', authToken, cookieOptions);

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
      // issue token
      const authPayload = {
        _id: user._id,
        role: user.role,
        email: user.email,
        fullName: user.fullName,
      };

      const authSecret = config.get('auth.secret');
      const authOptions = { expiresIn: config.get('auth.tokenExpiresIn') };
      const authToken = jwt.sign(authPayload, authSecret, authOptions);

      // create a cookie
      const cookieOptions = { httpOnly: true, maxAge: parseInt(config.get('auth.cookieMaxAge')) };
      res.cookie('authToken', authToken, cookieOptions);

      res.json({ message: 'Welcome back!', userId: user._id, token: authToken });
    } else {
      res.status(400).json({ error: 'Invalid Credentials' });
    }
  } catch (err) {}
});

module.exports = router;
