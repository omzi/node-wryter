const PostCollection = require('../../db').db().collection('posts');
const FollowCollection = require('../../db').db().collection('follows');
const User = require('./User');
const { ObjectId } = require('mongodb');
const slugify = require('slugify');
const sanitizeHTML = require('sanitize-html');
const getRandomId = require('../utils/generateRandomId');

// PostCollection.createIndexes([
//   { title: 1 },
//   { body: 1 }
// ])


class Post {
  constructor(data, author, requestedPostSlug) {
    this.data = data;
    this.author = author;
    this.errors = [];
    this.requestedPostSlug = requestedPostSlug;
  }

  validate() {
    if (this.data.title == '') this.errors.push('You must provide a title.');
    if (this.data.body == '') this.errors.push('Post content cannot be empty.');
  }

  sanitizeData(postRandomId) {
    if (typeof this.data.title != 'string') this.data.title = '';
    if (typeof this.data.body != 'string') this.data.body = '';

    // Get rid of bogus properties
    this.data = {
      title: this.data.title.trim(),
      body: sanitizeHTML(this.data.body.trim(), {
        allowedTags: [],
        allowedAttributes: {},
      }),
      author: ObjectId(this.author),
      slug: slugify(
        `${this.data.title} ${postRandomId ? postRandomId : getRandomId()}`,
        { lower: true, strict: true }
      ),
      createdAt: new Date(),
    };
  }

  create() {
    return new Promise(async (resolve, reject) => {
      // Step #1: Sanitize & validate post data
      this.sanitizeData();
      this.validate();

      if (!this.errors.length) {
        // Save post into database
        PostCollection.insertOne(this.data)
          .then(async (postInfo) => {
            const post = await PostCollection.findOne({
              _id: postInfo.insertedId,
            });
            resolve(post);
          })
          .catch((error) => {
            this.errors.push('Please try again later :(');
            reject(this.errors);
          });
      } else reject(this.errors);
    });
  }

  update(author) {
    return new Promise(async (resolve, reject) => {
      try {
        const post = await Post.findPostBySlug(
          author,
          this.requestedPostSlug,
          this.author
        );
        if (post.isVisitorAuthor) {
          // Actually update the database
          const status = await this.updatePost();
          resolve(status);
        } else reject();
      } catch (error) {
        reject();
      }
    });
  }

  updatePost() {
    return new Promise(async (resolve, reject) => {
      // Update post slug with original post random id
      this.sanitizeData(this.requestedPostSlug.slice(-8));
      this.validate();

      if (!this.errors.length) {
        await PostCollection.findOneAndUpdate(
          { slug: this.requestedPostSlug },
          {
            $set: {
              title: this.data.title,
              body: this.data.body,
              slug: this.data.slug,
            },
          }
        );
        resolve('success');
      } else resolve('failure');
    });
  }

  static delete(author, slug, currentUserId) {
    return new Promise(async (resolve, reject) => {
      try {
        const post = await Post.findPostBySlug(author, slug, currentUserId);

        if (post.isVisitorAuthor) {
          await PostCollection.deleteOne({ slug: post.slug });

          resolve(post);
        } else reject();
      } catch (error) {
        reject(error);
      }
    });
  }

  static postsQuery(uniqueOperations, currentUserId, endOperation) {
    return new Promise(async (resolve, reject) => {
      const aggregateOperations = uniqueOperations.concat([
        { $lookup: { from: 'users', localField: 'author', foreignField: '_id', as: 'authorDocument', } },
        { $project: {
            title: 1,
            body: 1,
            slug: 1,
            createdAt: 1,
            author: { $arrayElemAt: ['$authorDocument', 0] }
        } }
      ]);

      if (endOperation?.length) aggregateOperations.concat(endOperation);

      // Search for post slugs with the unique operation
      let posts = await PostCollection.aggregate(aggregateOperations).toArray();

      // Clean up author property in each post object
      posts = posts.map(post => {
        if (currentUserId) post.isVisitorAuthor = post.author._id.equals(currentUserId);

        post.author = {
          username: post.author.username,
          avatar: User.getAvatar(post.author.email)
        };
        return post;
      });

      resolve(posts);
    });
  }

  static findPostBySlug(author, slug, currentUserId) {
    return new Promise(async (resolve, reject) => {
      // Search for post slugs with the author username
      const posts = await Post.postsQuery(
        [{ $match: { slug } }],
        currentUserId
      );

      if (!posts.length) return reject('Invalid post slug provided for current user!');

      const post = posts.pop();

      if (post.author.username !== author) reject('Post was not created by a user with that username!');

      resolve(post);
    });
  }

  static async findPostsByAuthorId(id) {
    return await Post.postsQuery([
      { $match: { author: id } },
      { $sort: { createdAt: -1 } },
    ]);
  }

  static async userPostsCount(id) {
    return new Promise(async (resolve, reject) => {
      const postCount = await PostCollection.countDocuments({ author: id });
      resolve(postCount);
    });
  }

  static search(searchQuery) {
    return new Promise(async (resolve, reject) => {
      if (typeof searchQuery === 'string') {
        const posts = await Post.postsQuery([
          { $match: { $text: { $search: searchQuery },  } }
        ], null, [
          { $sort: { score: { $meta: "textScore" } } }
        ]);
        
        // { $regex: String(searchQuery.trim()), $options: '$i' }
        resolve(posts);
      } else reject();
    });
  }

  static async getUserFeed(id) {
    // Create an array of the user ids' that the current user follows
    let followedUsers = await FollowCollection.find({ userId: new ObjectId(id) }).toArray();
    followedUsers = followedUsers.map(followDocument => followDocument.followedId);
    
    // Look for posts where the author is in that array
    return Post.postsQuery([
      { $match: { author: { $in: followedUsers } } },
      { $sort: { createdAt: -1 } }
    ])
  }
}


module.exports = Post