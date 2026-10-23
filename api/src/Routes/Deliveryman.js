const routes = require('express').Router();

const signupController = require('../app/controllers/deliveryman/signupController');
const sessionController = require('../app/controllers/deliveryman/sessionController');
const menuController = require('../app/controllers/deliveryman/menuController');
const deliverymanController = require('../app/controllers/deliveryman/deliverymanController');

// const authMiddleware = require('../app/middlewares/auth');

/*
* Public routes
*/

routes.post('/signup', signupController.store);
routes.post('/session', sessionController.store);

routes.get('/deliveryman/:id/menu', menuController.index);

// routes.use(authMiddleware);

routes.get('/informations', deliverymanController.index)

module.exports = routes;