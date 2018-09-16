require('dotenv').config();

const express = require('express');
const flash = require('connect-flash');
const app = express();
const sessionConfig = require('./sessionConfig');
const routes = require('./routes');
const passport = require('passport');
const compression = require('compression');
const port = parseInt(process.env.PORT) || 3000;
require('./passportConfig');
require('./dbConnection');

app.use(compression());

app.set('views', './views');
app.set('view engine', 'jsx');
app.engine('jsx', require('express-react-views').createEngine());

app.use(sessionConfig);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('client/build', { extensions: 'html' }));
}

app.use('/', routes);
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  // mongoose validation error
  if (err.errors) {
    res.status(400);
  }
  if (req.accepts(['html', 'json']) === 'json') {
    res.json(err);
  } else {
    return next(err);
  }
});

app.listen(port, () => {
  if (process.env.NODE_ENV !== 'production') {
    /* eslint-disable no-console */
    console.log('webpack dev server listening on port ' + (port + 1));
  }
});
