const express = require("express");
const cors = require("cors");

const { resolve } = require("path")

const managerRoutes =  require('./Routes/Manager');
const customerRoutes = require('./Routes/Customer');
const deliverymanRoutes = require('./Routes/Deliveryman');

require("./database");

class App {
  constructor() {
    this.server = express();

    this.middlewares();
    this.routes(); 
  }

  middlewares() {
    this.server.use(cors());
    this.server.use(express.json());
    this.server.use(
      '/files',
      express.static(resolve(__dirname, "..", "tmp", "uploads"))
    );
  }

  routes() {
    this.server.use('/manager', managerRoutes);
    this.server.use('/customer', customerRoutes);
    this.server.use('/deliveryman', deliverymanRoutes);
  }
}

module.exports = new App().server;