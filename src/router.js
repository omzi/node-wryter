const router = require('express').Router();
const {
  home,
  register,
  login,
  logout,
  doesUsernameExist,
  doesEmailExist,
  authRequired,
  ifUserExists,
  userProfile,
  sharedProfileData,
  userProfileFollowers,
  userProfileFollowing,
} = require('./controllers/auth.controller');
const {
  viewCreatePost,
  createPost,
  viewPost,
  viewUpdatePost,
  updatePost,
  deletePost,
  search,
} = require('./controllers/post.controller');
const { addFollower, removeFollower } = require('./controllers/follow.controller');


// User Auth Routes
router.get('/', home);
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/doesUsernameExist', doesUsernameExist);
router.post('/doesEmailExist', doesEmailExist);

// User Profile Route
router.get('/@:username([a-z0-9]{3,30})', ifUserExists, sharedProfileData, userProfile);
router.get('/@:username([a-z0-9]{3,30})/followers', ifUserExists, sharedProfileData, userProfileFollowers);
router.get('/@:username([a-z0-9]{3,30})/following', ifUserExists, sharedProfileData, userProfileFollowing);

// Post Routes
router.get('/create-post', authRequired, viewCreatePost);
router.post('/create-post', authRequired, createPost);
router.get('/@:username([a-z0-9]{3,30})/post/:slug', ifUserExists, viewPost);
router
  .route('/@:username([a-z0-9]{3,30})/posts/edit/:slug')
  .get(authRequired, ifUserExists, viewUpdatePost)
  .post(authRequired, ifUserExists, updatePost);

router.post('/@:username([a-z0-9]{3,30})/posts/delete/:slug', authRequired, ifUserExists, deletePost);
router.post('/search', search);

// Follow Routes
router.post('/addFollowerTo/:username', authRequired, addFollower);
router.post('/removeFollowerFrom/:username', authRequired, removeFollower);


module.exports = router;
