const expressLayouts = require('express-ejs-layouts');

module.exports = (app) => {
  // Set up EJS layouts
  app.use(expressLayouts);
  app.set('layout', 'layouts/main');
  app.set('layout extractScripts', true);
  app.set('layout extractStyles', true);
};
