const routes = require('express').Router();

const signupController = require('../app/controllers/customer/signupController');
const sessionController = require('../app/controllers/customer/sessionController');
const restaurantsController = require('../app/controllers/customer/restaurantsController');
const menuController = require('../app/controllers/customer/menuController');
const customerController = require('../app/controllers/customer/customerController');

//const authMiddleware = require('../app/middlewares/auth');

/*
* Public routes
*/

routes.post('/signup', signupController.store);
routes.post('/session', sessionController.store);

routes.get('/restaurants', restaurantsController.index);
routes.get('/restaurants/:id/menu', menuController.index);

//routes.use(authMiddleware);

// Orders are not sent to the API: they exist only on-chain, in encrypted form.
routes.get('/informations', customerController.index)

module.exports = routes;