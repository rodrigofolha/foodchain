'use strict';

// The establishment's wallet is no longer stored: orders name the establishment
// only by a one-time address derived from its published keys.
// The orders table has a column of the same name; it is not touched here.
module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('restaurants', 'digital_address')
    ]);
  },

  // Restores the column only: the addresses that were stored are not recovered.
  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'restaurants',
        'digital_address',
        Sequelize.STRING
      )
    ]);
  }
};
