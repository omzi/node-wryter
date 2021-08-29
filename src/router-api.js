const apiRouter = require('express').Router();
const { apiLogin, apiAuthRequired, apiIfUserExists, apiGetPostsByUsername } = require('./controllers/auth.controller');
const {
  viewCreatePost,
  apiCreatePost,
  apiDeletePost
} = require('./controllers/post.controller');
const cors = require('cors');

apiRouter.use(cors());

apiRouter.post('/register', viewCreatePost);
apiRouter.post('/login', apiLogin);
apiRouter.post('/logout', viewCreatePost);

apiRouter.post('/create-post', apiAuthRequired, apiCreatePost);
apiRouter.delete('/delete-post/@:username([a-z0-9]{3,30})/:slug', apiAuthRequired, apiIfUserExists, apiDeletePost);

apiRouter.get('/postsByAuthor/@:username([a-z0-9]{3,30})', apiIfUserExists, apiGetPostsByUsername);

module.exports = apiRouter;