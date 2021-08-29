const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const compression = require('compression');
const csrf = require('csurf');
const sanitizeHTML = require('sanitize-html');
const { createMarkdown } = require('safe-marked');
const markdown = createMarkdown({
  marked: {
    headerIds: true,
    highlight: (code, lang) => {
      code = code
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      
      const hljs = require('highlight.js');
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  }
});
const router = require('./src/router');
const prodEnv = process.env.NODE_ENV === 'production';


const sessionOptions = {
  secret: 'n5k3zuiHU8tAEh9oV4Q0jrbU',
  store: MongoStore.create({
    client: require('./db'),
    ttl: 60 * 60 * 24 * 14 // Save session for 14 days
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 14, // Expires in 14 days
    httpOnly: true
  }
}

const app = express();

app.use(compression());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/api/v1', require('./src/router-api'));

if (prodEnv) {
  sessionOptions.cookie.secure = true; // Serve secure cookies in production
  app.set('trust proxy', 1); // Trust first proxy
}

!prodEnv && app.use(require('morgan')('dev'));

app.use(session(sessionOptions));
app.use(flash());
app.use((req, res, next) => {
  res.locals.successMessages = req.flash('successMessages');
  res.locals.errorMessages = req.flash('errorMessages');
  res.locals.infoMessages = req.flash('infoMessages');
  res.locals.newUser = req.flash('newUser');
  res.locals.user = req.session.user;
  req.currentUserId = req.session.user?.id;
  req.onlineUsers = [];

  res.locals.convertMarkdown = content => {
    return markdown(content);
  }

  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));
app.use(express.static(path.join(__dirname, 'src', 'public')));

// EJS helpers
app.locals.helpers = {
  capitalise: ([first, ...rest]) => first.toUpperCase() + rest.join(''),
  // formatDateToNow: date => {
  //   return formatDistanceToNow(date, { addSuffix: true, includeSeconds: true })
  // },
  formatDate: value => {
    const dateSplit = value.split(' ');
    const date = Number(dateSplit[!!{} + !!{}]);
    const ordinal = n => n < 11 || n > 13 ? [`${n}st`, `${n}nd`, `${n}rd`, `${n}th`][Math.min((n - 1) % 10, 3)] : `${n}th`;

    dateSplit[+[]] += ','; dateSplit[!!{} + !!{}] = ordinal(date);

    return dateSplit.join(' ');
  }
}

app.use(csrf());
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use('/', router);

app.use((req, res, next) => {
  res.status(404).render('404', { URL: req.originalUrl });
});

app.use((error, req, res, next) => {
  if (error) {
    if (error.name === 'ForbiddenError' && error.code === 'EBADCSRFTOKEN') {
      req.flash('errorMessages', 'Invalid CSRF token');
      req.session.save(() => {
        req.method === 'GET' ? res.redirect(req.originalUrl) : res.redirect('/');
      });
    } else {
      res.status(500).render('404', { URL: req.originalUrl });
    }
  } else {
    res.status(404).render('404', { URL: req.originalUrl });
  }
});

// const PORT = process.env.PORT || Math.floor(Math.random() * (9.999e3 - 1e3 + 1) + 1e3);
const server = require('http').createServer(app);

const io = require('socket.io')(server);

io.use((socket, next) => {
  sessionOptions(socket.request, socket.request.res, next);
})

io.on('connection', socket => {
  console.log(`A new user connected... [${socket.id}]`);

  if (socket.request.session.user) {
    const { username, avatar } = socket.request.session.user;

    socket.emit('init', { username, avatar });
    socket.on('init', () => socket.broadcast.emit('newUser', { username }));

    socket.on('chatMessageFromUser', data => {
      const message = sanitizeHTML(data.message, { allowedTags: [], allowedAttributes: {} });

      socket.broadcast.emit('chatMessageFromServer', { message, username, avatar });
    })

    socket.on('disconnect', data => socket.broadcast.emit('userLeft', { username }));
  }
})

module.exports = server;