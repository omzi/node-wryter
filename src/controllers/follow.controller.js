const Follow = require('../models/Follow');
const context = {  }


exports.addFollower = (req, res) => {
  console.log(req.currentUserId);
  const follow = new Follow(req.params.username, req.currentUserId);
  follow.create().then(() => {
    req.flash('successMessages', `Successfully followed <b>${req.params.username}</b> ✨!`);
    req.session.save(() => res.redirect(`/@${req.params.username}`));
  }).catch(errors => {
    errors.forEach(error => req.flash('errorMessages', error));
    req.session.save(() => res.redirect('/'));
  })
}


exports.removeFollower = (req, res) => {
  const follow = new Follow(req.params.username, req.currentUserId);
  follow.delete().then(() => {
    req.flash('infoMessages', `Successfully stopped following <b>${req.params.username}</b>.`);
    req.session.save(() => res.redirect(`/@${req.params.username}`));
  }).catch(errors => {
    errors.forEach(error => req.flash('errorMessages', error));
    req.session.save(() => res.redirect('/'));
  })
}