const { ObjectId } = require('mongodb');
const User = require('./User');
const UserCollection = require('../../db').db().collection('users');
const FollowCollection = require('../../db').db().collection('follows');


class Follow {
  constructor(followedUsername, userId) {
    this.followedUsername = followedUsername;
    this.userId = userId;
    this.errors = [];
  }

  sanitizeData() {
    if (typeof (this.followedUsername) !== 'string') this.followedUsername = '';
  }

  async validate(action) {
    // Check user's existence
    const followedAccount = await UserCollection.findOne({ username: this.followedUsername });

    if (followedAccount) {
      this.followedId = followedAccount._id;
    } else {
      this.errors.push('You cannot follow a non-existent user!');
    }

    const doesFollowAlreadyExist = await FollowCollection.findOne({ followedId: this.followedId, userId: new ObjectId(this.userId) });

    if (action === 'create') {
      if (doesFollowAlreadyExist) this.errors.push('You already follow this user!');
    }

    if (action === 'delete') {
      if (!doesFollowAlreadyExist) this.errors.push(`You are not following this user!`);
    }

    if (String(this.followedId) === String(this.userId)) this.errors.push('You cannot follow yourself!');
  }

  create() {
    return new Promise(async (resolve, reject) => {
      this.sanitizeData();
      await this.validate('create');

      if (!this.errors.length) {
        await FollowCollection.insertOne({ followedId: this.followedId, userId: new ObjectId(this.userId) });
        resolve();
      } else reject(this.errors);
    });
  }

  delete() {
    return new Promise(async (resolve, reject) => {
      this.sanitizeData();
      await this.validate('delete');

      if (!this.errors.length) {
        await FollowCollection.deleteOne({ followedId: this.followedId, userId: new ObjectId(this.userId) });
        resolve();
      } else reject(this.errors);
    });
  }

  static async isUserFollowing(followedId, userId) {
    const followDocument = await FollowCollection.findOne({ followedId, userId: ObjectId(userId) });

    return followDocument ? true : false;
  }

  static getFollowersByUserId(id) {
    return new Promise(async (resolve, reject) => {
      try {
        let followers = await FollowCollection.aggregate([
          { $match: { followedId: id } },
          { $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userDocument'
          } },
          { $project: {
            username: { $arrayElemAt: ['$userDocument.username', 0] },
            email: { $arrayElemAt: ['$userDocument.email', 0] }
          } }
        ]).toArray();

        followers = followers.map(follower => {
          return {
            username: follower.username,
            avatar: User.getAvatar(follower.email)
          }
        })

        resolve(followers);
      } catch (error) {
        reject();
      }
    });
  }

  static getFollowedUsersByUserId(id) {
    return new Promise(async (resolve, reject) => {
      try {
        let followedUsers = await FollowCollection.aggregate([
          { $match: { userId: id } },
          { $lookup: {
            from: 'users',
            localField: 'followedId',
            foreignField: '_id',
            as: 'userDocument'
          } },
          { $project: {
            username: { $arrayElemAt: ['$userDocument.username', 0] },
            email: { $arrayElemAt: ['$userDocument.email', 0] }
          } }
        ]).toArray();

        followedUsers = followedUsers.map(follower => {
          return {
            username: follower.username,
            avatar: User.getAvatar(follower.email)
          }
        })

        resolve(followedUsers);
      } catch (error) {
        reject();
      }
    });
  }

  static async userFollowersCount(id) {
    return new Promise(async (resolve, reject) => {
      const followersCount = await FollowCollection.countDocuments({ followedId: id });
      resolve(followersCount);
    });
  }

  static async userFollowingCount(id) {
    return new Promise(async (resolve, reject) => {
      const followingCount = await FollowCollection.countDocuments({ userId: id });
      resolve(followingCount);
    });
  }
}


module.exports = Follow;