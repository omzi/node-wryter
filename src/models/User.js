const UserCollection = require('../../db').db().collection('users');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const md5 = require('md5');

class User {
  constructor(user) {
    this.data = user;
    this.errors = [];
  }

  validate() {
    return new Promise(async (resolve, reject) => {
      if (this.data.username == "")
        this.errors.push('You must provide a username.');
      if (this.data.username != '' && !validator.isAlphanumeric(this.data.username))
        this.errors.push('Username must only contain letters and numbers.');
      if (!validator.isEmail(this.data.email))
        this.errors.push('You must provide a valid email address.');
      if (this.data.password == "")
        this.errors.push('You must provide a password.');
      if (this.data.password != '' && this.data.password.length < 6)
        this.errors.push('Password must be at least 6 characters.');
      if (this.data.password != '' && this.data.password.length > 50)
        this.errors.push('Password cannot exceed 50 characters.');
      if (this.data.username != '' && this.data.username.length < 3)
        this.errors.push('Username must be at least 3 characters.');
      if (this.data.username != '' && this.data.username.length > 30)
        this.errors.push('Username cannot exceed 30 characters.');

      // Check validity, then check if username has been taken
      if (this.data.username.length >= 3 && this.data.username.length <= 30 && validator.isAlphanumeric(this.data.username)) {
        let usernameExists = await UserCollection.findOne({ username: this.data.username });
        if (usernameExists) this.errors.push('Username has already been taken!');
      }

      // Check validity, then check if account with email exists
      if (validator.isEmail(this.data.email)) {
        let emailExists = await UserCollection.findOne({ email: this.data.email });
        if (emailExists) this.errors.push('Account with email already exists!');
      }

      resolve();
    });
  }

  sanitizeData() {
    if (typeof (this.data.username) != 'string') this.data.username = '';
    if (typeof (this.data.email) != 'string') this.data.email = '';
    if (typeof (this.data.password) != 'string') this.data.password = '';

    // Get rid of bogus properties
    this.data = {
      username: this.data.username.trim().toLowerCase(),
      email: this.data.email.trim().toLowerCase(),
      password: this.data.password
    }
  }

  register() {
    return new Promise(async (resolve, reject) => {
      // Step #1: Sanitize & validate user data
      this.sanitizeData();
      await this.validate();

      // Step #2: If no validation errors, save the user data
      if (!this.errors.length) {
        // Hash user password
        const salt = bcrypt.genSaltSync(10);
        this.data.password = bcrypt.hashSync(this.data.password, salt);

        const { insertedId } = await UserCollection.insertOne(this.data);
        this.id = insertedId;
        this.avatar = User.getAvatar(this.data.email);
        resolve();
      } else reject(this.errors);
    });
  }

  login() {
    return new Promise((resolve, reject) => {
      this.sanitizeData();
      UserCollection.findOne({ username: this.data.username }).then(attemptedUser => {
        if (attemptedUser && bcrypt.compareSync(this.data.password, attemptedUser.password)) {
          this.data = attemptedUser;
          this.id = attemptedUser._id;
          this.avatar = User.getAvatar(attemptedUser.email);
          resolve('Congrats!');
        } else {
          reject('Invalid credentials!');
        }
      }).catch(error => {
        reject('Please try again later!');
      })
    });
  }

  static getAvatar(userEmail) {
    return `https://gravatar.com/avatar/${md5(userEmail)}?s=32`;
  }

  static findByUsername(username) {
    return new Promise(async (resolve, reject) => {
      UserCollection.findOne({ username }).then(userDocument => {
        if (userDocument) {
          // Clean up user data
          userDocument = {
            _id: userDocument._id,
            username: userDocument.username,
            avatar: User.getAvatar(userDocument.email)
          }

          resolve(userDocument);
        } else reject();
      }).catch(error => reject());
    });
  }

  static doesEmailExist(email) {
    return new Promise(async (resolve, reject) => {
      if (typeof(email) !== 'string') {
        return resolve(false);
      }

      const user = await UserCollection.findOne({ email });
      user ? resolve(true) : resolve(false);
    });
  }
}


module.exports = User;