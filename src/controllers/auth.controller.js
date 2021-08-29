const User = require('../models/User');
const Post = require('../models/Post');
const Follow = require('../models/Follow');
const jwt = require('jsonwebtoken');
const context = {  }


exports.login = (req, res) => {
  const user = new User(req.body);
  user.login().then(() => {
    req.session.user = {
      username: user.data.username,
      avatar: user.avatar,
      id: user.id
    }
    req.flash('successMessages', `Heyyy <b>${user.data.username}</b>! Welcome back 🙂`);
    req.session.save(() => res.redirect('/'));
  }).catch(error => {
    req.flash('errorMessages', error);
    req.session.save(() => {
      req.headers.referer.startsWith(req.headers.origin)
        ? res.redirect(req.headers.referer)
        : res.redirect('/')
    });
  })
}

exports.apiLogin = (req, res) => {
  const user = new User(req.body);
  user.login().then(() => {
    const userDetails = {
      username: user.data.username,
      avatar: user.avatar
    }
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ status: 'success', data: userDetails, token });
  }).catch(error => {
    res.json({ status: 'failure', error, data: {} });
  })
}

exports.apiGetPostsByUsername = async (req, res) => {
  try {
    const user = await User.findByUsername(req.params.username, req.params.slug, req.currentUserId);
    const posts = await Post.findPostsByAuthorId(user._id);

    res.json({ status: 'success', count: posts.length, data: posts });
  } catch (error) {
    res.json({ status: 'failure', error });
  }
}

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/'));
}

exports.doesUsernameExist = (req, res) => {
  User.findByUsername(req.body.username).then(() => {
    res.json(true);
  }).catch(() =>  res.json(false));
}

exports.doesEmailExist = async (req, res) => {
  const emailExists = await User.doesEmailExist(req.body.email);
  res.json(emailExists);
}

exports.register = (req, res) => {
  const user = new User(req.body);
  user.register().then(() => {
    req.session.user = {
      username: user.data.username,
      avatar: user.avatar,
      id: user.id
    }
    // Send to FE to show new user onboarding
    req.flash('newUser', true);
    req.session.save(() => res.redirect('/'));
  }).catch(errors => {
    errors.forEach(error => req.flash('errorMessages', error));
    req.session.save(() => res.redirect('/'));
  })
}

exports.home = async (req, res) => {
  if (req.session.user) {
    // Fetch current user's feed
    const feedPosts = await Post.getUserFeed(req.currentUserId);

    context.title = 'Feed';
    context.feedPosts = feedPosts;

    res.render('home-dashboard', context);
  } else {
    context.title = 'Home';

    res.render('home-guest', context);
  }
}

exports.authRequired = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    req.flash('errorMessages', 'Unauthorised! You must be logged in to proceed.');
    req.session.save(() => res.redirect('/'));
  }
}

exports.apiAuthRequired = (req, res, next) => {
  try {
    req.apiUser = jwt.verify(req.body.token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    res.json({ status: 'failure', error: 'Invalid JSON web token' });
  }
}

exports.ifUserExists = (req, res, next) => {
  User.findByUsername(req.params.username).then(userDocument => {
    req.profileUser = userDocument;
    next();
  }).catch(error => {
    res.render('404');
  });
}

exports.apiIfUserExists = (req, res, next) => {
  User.findByUsername(req.params.username).then(userDocument => {
    req.apiProfileUser = userDocument;
    next();
  }).catch(error => {
    res.json({ status: 'failure', error: 'Non-existent username' });
  });
}

exports.sharedProfileData = async (req, res, next) => {
  let isUserOnOwnProfile = false;
  let isFollowing = false;
  if (req.session.user) {
    isUserOnOwnProfile = req.profileUser._id.equals(req.currentUserId);
    isFollowing = await Follow.isUserFollowing(req.profileUser._id, req.currentUserId);
  }

  req.isUserOnOwnProfile = isUserOnOwnProfile;
  req.isFollowing = isFollowing;

  // Fetch user data count
  const postCountPromise = Post.userPostsCount(req.profileUser._id);
  const followersCountPromise = Follow.userFollowersCount(req.profileUser._id);
  const followingCountPromise = Follow.userFollowingCount(req.profileUser._id);

  const [postCount, followersCount, followingCount] = await Promise.all([postCountPromise, followersCountPromise, followingCountPromise]);

  req.postCount = postCount;
  req.followersCount = followersCount;
  req.followingCount = followingCount;

  next();
}

exports.userProfile = (req, res, next) => {
  // Fetch user posts
  Post.findPostsByAuthorId(req.profileUser._id).then(posts => {
    context.activeTab = 'profilePosts';
    context.profileUser = req.profileUser;
    context.title = `${req.profileUser.username}'s Profile`;
    context.userPosts = posts;
    context.isFollowing = req.isFollowing;
    context.isUserOnOwnProfile = req.isUserOnOwnProfile;

    context.postCount = req.postCount;
    context.followersCount = req.followersCount;
    context.followingCount = req.followingCount;

    res.render('profile', context);
  }).catch(error => {
    res.render('404');
  });
}

exports.userProfileFollowers = async (req, res, next) => {
  try {
    const followers = await Follow.getFollowersByUserId(req.profileUser._id);

    context.activeTab = 'profileFollowers';
    context.profileUser = req.profileUser;
    context.title = `${req.profileUser.username}'s Profile`;
    context.isFollowing = req.isFollowing;
    context.isUserOnOwnProfile = req.isUserOnOwnProfile;
    context.followers = followers;

    context.postCount = req.postCount;
    context.followersCount = req.followersCount;
    context.followingCount = req.followingCount;

    res.render('profile-followers', context);
  } catch (error) {
    res.render('404');
  }
}

exports.userProfileFollowing = async (req, res, next) => {
  try {
    const following = await Follow.getFollowedUsersByUserId(req.profileUser._id);

    context.activeTab = 'profileFollowing';
    context.profileUser = req.profileUser;
    context.title = `${req.profileUser.username}'s Profile`;
    context.isFollowing = req.isFollowing;
    context.isUserOnOwnProfile = req.isUserOnOwnProfile;
    context.following = following;

    context.postCount = req.postCount;
    context.followersCount = req.followersCount;
    context.followingCount = req.followingCount;

    res.render('profile-following', context);
  } catch (error) {
    res.render('404');
  }
}