'use strict';

// Spending and viewing public keys of the establishment, from which a customer derives the
// one-time address of each order. A column that already exists (added by hand) is kept.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('restaurants');
    for (const column of ['spend_public_key', 'view_public_key']) {
      if (!table[column]) {
        await queryInterface.addColumn('restaurants', column, Sequelize.STRING);
      }
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('restaurants', 'view_public_key');
    await queryInterface.removeColumn('restaurants', 'spend_public_key');
  }
};
