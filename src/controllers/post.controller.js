const Post = require('../models/Post');
const context = {  }


exports.viewCreatePost = (req, res) => {
  context.title = 'Create Post';
  
  res.render('create-post', context);
}

exports.createPost = (req, res) => {
  const post = new Post(req.body, req.session.user.id);
  post.create().then(post => {
    req.flash('successMessages', 'Post created successfully ✨!');
    req.session.save(() => res.redirect(`/@${req.session.user.username}/post/${post.slug}`));
  }).catch(errors => {
    errors.forEach(error => req.flash('errorMessages', error));
    req.session.save(() => res.redirect('/create-post'));
  });
}

exports.apiCreatePost = (req, res) => {
  const post = new Post(req.body, req.apiUser.id);
  post.create().then(post => {
    res.json({ status: 'success', data: post, message: 'Post created successfully ✨!' });
    // req.session.save(() => res.redirect(`/@${req.session.user.username}/post/${post.slug}`));
  }).catch(errors => {
    res.json({ status: 'failure', errors });
  });
}

exports.viewPost = async (req, res) => {
  try {
    const post = await Post.findPostBySlug(req.params.username, req.params.slug, req.currentUserId);
    context.post = post;
    context.title = `${post.title} ~ @${post.author.username}`;

    res.render('view-post', context);
  } catch (error) {
    context.title = 'Post Not Found :(';
    
    res.render('404-post', context);
  }
}

exports.viewUpdatePost = async (req, res) => {
  try {
    const post = await Post.findPostBySlug(req.params.username, req.params.slug, req.currentUserId);
  
    if (post.isVisitorAuthor) {
      context.post = post;
      context.title = `Edit Post ~ @${post.author.username}`;
      context.updatedUrl = req.flash('updatedUrl').pop() || null;

      res.render('edit-post', context);
    } else {
      req.flash('errorMessages', 'Unauthorised to access this route');
      req.session.save(() => res.redirect('/'));
    }
  } catch (error) {
    res.render('404');
    // res.redirect(`/@${username}/posts`);
  }
}

exports.updatePost = (req, res) => {
  const post = new Post(req.body, req.currentUserId, req.params.slug);
  post.update(req.params.username).then(status => {
    // Post was successfully updated to the database
    // Or user with permission had validation errors
    if (status === 'success') {
      // Post was updated to db
      req.flash('successMessages', 'Post successfully updated 🦄!');
      req.flash('updatedUrl', `/@${req.params.username}/post/${post.data.slug}`);
      req.session.save(() => res.redirect(`/@${req.params.username}/posts/edit/${post.data.slug}`));
    } else {
      post.errors.forEach(error => req.flash('errorMessages', error));
      req.session.save(() => res.redirect(`/@${req.params.username}/posts/edit/${req.params.slug}`));
    }
  }).catch(error => {
    // Post with requested id does not exist
    // Or if current visitor is not the owner of the requested post
    req.flash('errorMessages', 'Unauthorised to perform that action!');
    req.session.save(() => res.redirect('/'));
  });
}

exports.deletePost = (req, res) => {
  Post.delete(req.params.username, req.params.slug, req.currentUserId).then(result => {
    req.flash('infoMessages', 'Post successfully deleted 🚮!');
    req.session.save(() => res.redirect(`/@${req.params.username}`));
  }).catch(error => {
    req.flash('errorMessages', 'Unauthorised to perform that action!');
    req.session.save(() => res.redirect('/'));
  });
}

exports.apiDeletePost = (req, res) => {
  Post.delete(req.params.username, req.params.slug, req.apiUser.id).then(result => {
    res.json({ status: 'success', data: result, message: 'Post successfully deleted 🚮!' });
  }).catch(error => {
    res.status(400).json({ status: 'failure', error });
  });
}

exports.search = (req, res) => {
  Post.search(req.body.searchQuery).then(posts => {
    res.json(posts);
  }).catch(e => {
    console.log(e);
    res.json([]);
  });
}