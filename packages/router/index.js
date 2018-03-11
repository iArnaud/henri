const RouteHandler = require('./router');

const { express, log, view } = henri;

async function init(reload = false) {
  henri.router = express.Router();
  middlewares();
  const router = new RouteHandler();
  router.prepare();
  /* istanbul ignore next */
  if (process.env.NODE_ENV !== 'production') {
    henri.router.get('/_routes', (req, res) => res.json(henri._routes));
  }
  startView(reload);
}

function startView(reload = false) {
  /* istanbul ignore next */
  if (view && !reload) {
    try {
      view.prepare().then(() => {
        view.fallback(henri.router);
        henri.start(global['_initialDelay'] || null);
      });
    } catch (error) {
      log.error('unable to start renderer: ', error);
    }
  } else {
    view && view.fallback(henri.router);
    !view && log.warn('unable to register view fallback route');
  }
}

/* istanbul ignore next */
function middlewares(router) {
  if (henri._middlewares.length > 0) {
    henri._middlewares.map(func => func());
  }
  if (henri._graphql && henri._graphql.schema) {
    henri._graphql.register();
  }
  henri.router.use((req, res, cb) => {
    res.locals._req = req;
    req._henri = {
      paths: henri._paths,
      localUrl: henri._url,
      user: req.user || {},
      query: req.query,
    };
    delete res.render;
    res.render = async (route, extras = {}) => {
      let { data = {}, graphql = null } = extras;
      data = (graphql && (await henri.graphql(graphql))) || data;
      const opts = {
        data: (graphql && data.data) || data,
        errors: graphql && data.errors,
        graphql: {
          endpoint: (henri._graphql.active && henri._graphql.endpoint) || false,
          query: graphql || false,
        },
        paths: henri._paths,
        localUrl: henri._url,
        user: req.user || {},
        query: req.query,
      };
      if (req.url.startsWith('/_data/')) {
        return res.json(opts);
      }
      /* istanbul ignore next */
      return res.format({
        html: () => view.render(req, res, route, opts),
        json: () => res.json(opts),
        default: () => view.render(req, res, route, opts),
      });
    };
    cb();
  });
}

async function reload() {
  await init(true);
  log.warn('routes reloaded');
}

henri.modules.loader(reload);

module.exports = init();

log.info('router module loaded.');
