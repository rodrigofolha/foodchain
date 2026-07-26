'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'restaurants',
        'latitude',
        Sequelize.FLOAT
      ),
      queryInterface.addColumn(
        'restaurants',
        'longitude',
        Sequelize.FLOAT
      )
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('restaurants', 'latitude'),
      queryInterface.removeColumn('restaurants', 'longitude')
    ]);
  }
};
